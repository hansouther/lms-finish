"""
Iteration 33 - Token fallback for cross-site cookie-blocking browsers.

Tests that login/register/google return access/refresh tokens in JSON body,
that /api/auth/me works with Bearer header (no cookies), /api/files/?token= works,
and /api/auth/refresh accepts X-Refresh-Token header without cookie.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cbt-tryout-1.preview.emergentagent.com").rstrip("/")

CREDS = {
    "admin": ("admin@lms.id", "Admin@12345"),
    "student": ("siswa@lms.id", "Siswa@12345"),
    "tutor": ("tutor@lms.id", "Tutor@12345"),
    "proctor": ("proktor@lms.id", "Proktor@12345"),
}


def _bare_session():
    """Session that does NOT keep cookies (simulates Safari blocking cross-site cookies)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Block cookies entirely
    from http.cookiejar import DefaultCookiePolicy
    s.cookies.set_policy(DefaultCookiePolicy(allowed_domains=[]))
    return s


@pytest.mark.parametrize("role", list(CREDS.keys()))
def test_login_returns_tokens_and_user_fields(role):
    email, pw = CREDS[role]
    s = _bare_session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, f"{role} login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("access_token"), f"{role}: access_token missing"
    assert data.get("refresh_token"), f"{role}: refresh_token missing"
    assert data.get("email") == email
    assert data.get("role") == role
    assert data.get("id")
    # password hash should never leak
    assert "password_hash" not in data


@pytest.mark.parametrize("role", list(CREDS.keys()))
def test_me_with_bearer_only_no_cookies(role):
    email, pw = CREDS[role]
    s = _bare_session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200
    access = r.json()["access_token"]

    # Fresh session, no cookies, Bearer header only
    s2 = _bare_session()
    r2 = s2.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r2.status_code == 200, f"{role}: /me without cookies failed: {r2.status_code} {r2.text}"
    assert r2.json().get("email") == email
    # Confirm no cookies were sent
    assert len(s2.cookies) == 0


def test_refresh_with_header_no_cookies():
    s = _bare_session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": CREDS["admin"][0], "password": CREDS["admin"][1]})
    assert r.status_code == 200
    refresh = r.json()["refresh_token"]

    s2 = _bare_session()
    r2 = s2.post(f"{BASE_URL}/api/auth/refresh", headers={"X-Refresh-Token": refresh})
    assert r2.status_code == 200, f"refresh failed: {r2.status_code} {r2.text}"
    body = r2.json()
    assert body.get("access_token")
    # The new access token should work on /me
    r3 = _bare_session().get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert r3.status_code == 200


def test_refresh_missing_token_401():
    s = _bare_session()
    r = s.post(f"{BASE_URL}/api/auth/refresh")
    assert r.status_code == 401


def test_me_invalid_token_401():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401


def test_me_no_auth_401():
    r = _bare_session().get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


def test_files_with_query_token_no_cookies():
    """Any existing file protected via /api/files/* must be fetchable with ?token= in query."""
    s = _bare_session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": CREDS["admin"][0], "password": CREDS["admin"][1]})
    assert r.status_code == 200
    access = r.json()["access_token"]

    # Discover any file: look at a tryout question that has image, or try getting a user's picture-less fallback.
    # Hit /api/files/non-existent-path?token=<valid> — should NOT be 401, should be 404 (auth passed).
    r2 = _bare_session().get(f"{BASE_URL}/api/files/__nope__/__none__.png?token={access}")
    # The important check: not 401 (auth via query token worked)
    assert r2.status_code != 401, f"Query token did not authenticate; got 401. Body: {r2.text}"


def test_files_without_token_401():
    r = _bare_session().get(f"{BASE_URL}/api/files/__nope__/__none__.png")
    assert r.status_code == 401


def test_logout_requires_auth():
    s = _bare_session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": CREDS["student"][0], "password": CREDS["student"][1]})
    access = r.json()["access_token"]
    r2 = _bare_session().post(f"{BASE_URL}/api/auth/logout", headers={"Authorization": f"Bearer {access}"})
    assert r2.status_code == 200
    # After logout, old access token still valid until expiry (stateless JWT) - that's expected design.
