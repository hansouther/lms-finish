"""Site settings & asset upload tests (iter34)."""
import io
import os
import requests
import pytest

def _base():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        from pathlib import Path
        for line in Path("/app/frontend/.env").read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                url = line.split("=", 1)[1].strip()
                break
    return url.rstrip("/")

BASE = _base()
ADMIN = {"email": "admin@lms.id", "password": "Admin@12345"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Public endpoint ---
def test_public_site_settings_defaults():
    r = requests.get(f"{BASE}/api/public/site-settings", timeout=20)
    assert r.status_code == 200
    data = r.json()
    for k in ("site_name", "loader_enabled", "loader_bg_color", "loader_style"):
        assert k in data


# --- Admin GET/PUT auth ---
def test_admin_settings_requires_auth():
    r = requests.get(f"{BASE}/api/admin/site-settings", timeout=20)
    assert r.status_code in (401, 403)


def test_admin_settings_forbidden_for_non_admin():
    # try a known non-admin student test account (seeded via earlier iterations) – skip if cannot login
    r = requests.post(f"{BASE}/api/auth/login", json={"email": "student@lms.id", "password": "Student@12345"}, timeout=20)
    if r.status_code != 200:
        pytest.skip("No student account to test 403")
    tok = r.json()["access_token"]
    r2 = requests.get(f"{BASE}/api/admin/site-settings", headers={"Authorization": f"Bearer {tok}"}, timeout=20)
    assert r2.status_code == 403


def test_admin_get_settings(admin_headers):
    r = requests.get(f"{BASE}/api/admin/site-settings", headers=admin_headers, timeout=20)
    assert r.status_code == 200
    assert "site_name" in r.json()


def test_put_settings_validation_bad_color(admin_headers):
    body = _default_body()
    body["loader_bg_color"] = "not-a-color"
    r = requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)
    assert r.status_code == 422


def test_put_settings_validation_bad_url(admin_headers):
    body = _default_body()
    body["logo_url"] = "ftp://foo.example/x.png"
    r = requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)
    assert r.status_code == 422


def test_put_and_persistence(admin_headers):
    body = _default_body()
    body["site_name"] = "TEST_Binara"
    body["loader_message"] = "TEST pesan muat"
    r = requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json()["site_name"] == "TEST_Binara"

    # Verify via public endpoint
    g = requests.get(f"{BASE}/api/public/site-settings", timeout=20)
    assert g.json()["site_name"] == "TEST_Binara"
    assert g.json()["loader_message"] == "TEST pesan muat"

    # Restore
    body["site_name"] = "Binara LMS"
    body["loader_message"] = "Mohon tunggu, sedang menyiapkan halaman..."
    requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)


# --- R2 asset upload ---
def _default_body():
    r = requests.get(f"{BASE}/api/public/site-settings", timeout=20)
    return r.json()


def _png_bytes():
    # Minimal 1x1 PNG
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
    )


def test_upload_png_returns_public_r2_url(admin_headers):
    files = {"file": ("test.png", _png_bytes(), "image/png")}
    r = requests.post(f"{BASE}/api/admin/site-assets", files=files, headers=admin_headers, timeout=60)
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("https://pub-74b9f7bee68a4334803c36aaf1ec775c.r2.dev/"), url
    # Public fetch
    g = requests.get(url, timeout=30)
    assert g.status_code == 200
    assert g.headers.get("content-type", "").startswith("image/")


def test_upload_rejects_txt(admin_headers):
    files = {"file": ("x.txt", b"hello", "text/plain")}
    r = requests.post(f"{BASE}/api/admin/site-assets", files=files, headers=admin_headers, timeout=30)
    assert r.status_code == 400


def test_upload_requires_admin():
    files = {"file": ("test.png", _png_bytes(), "image/png")}
    r = requests.post(f"{BASE}/api/admin/site-assets", files=files, timeout=30)
    assert r.status_code in (401, 403)
