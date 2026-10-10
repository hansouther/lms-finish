"""Quick regression after Emergent-dependency removal (iter 19)."""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://web-config-studio.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@lms.id"
ADMIN_PASSWORD = "Admin@12345"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    # cookies should be set
    assert "access_token" in s.cookies or any("access" in c.name for c in s.cookies), f"no cookies set: {dict(s.cookies)}"
    return s


@pytest.fixture(scope="module")
def admin_headers(admin_session):
    return admin_session


def test_auth_me(admin_headers):
    r = admin_headers.get(f"{BASE_URL}/api/auth/me", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("email") == ADMIN_EMAIL
    assert data.get("role") == "admin"


def test_payments_config():
    r = requests.get(f"{BASE_URL}/api/payments/config", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, dict)
    # should be disabled since no Midtrans keys
    assert data.get("enabled") in (False, None), data


# tiny 1x1 PNG
PNG_BYTES = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
    "0000000D49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
)


def test_file_upload_and_fetch(admin_headers):
    files = {"file": ("test.png", io.BytesIO(PNG_BYTES), "image/png")}
    r = admin_headers.post(f"{BASE_URL}/api/upload", files=files, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "url" in data and data["url"].startswith("/api/files/")
    path = data["url"].replace("/api/files/", "")

    r2 = admin_headers.get(f"{BASE_URL}/api/files/{path}", timeout=30)
    assert r2.status_code == 200, r2.text
    assert r2.content == PNG_BYTES, "roundtrip bytes mismatch"


def test_tutor_upload_doc(admin_headers):
    files = {"file": ("doc.png", io.BytesIO(PNG_BYTES), "image/png")}
    r = admin_headers.post(f"{BASE_URL}/api/auth/upload-doc", files=files, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "url" in data and data["url"].startswith("/api/files/")
    # verify fetchable
    path = data["url"].replace("/api/files/", "")
    r2 = admin_headers.get(f"{BASE_URL}/api/files/{path}", timeout=30)
    assert r2.status_code == 200
    assert r2.content == PNG_BYTES
