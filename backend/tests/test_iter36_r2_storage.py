"""Iteration 36: Direct Cloudflare R2 delivery (storage-status, signed /api/files, question-images, site-assets)."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://web-config-studio.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@lms.id"
ADMIN_PW = "Admin@12345"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- storage-status ----------
def test_storage_status_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/storage-status", timeout=20)
    assert r.status_code in (401, 403)


def test_storage_status_admin(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/storage-status", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["provider"] == "cloudflare_r2", data
    assert data.get("ok") is True, data
    assert data.get("bucket")
    assert data.get("direct_delivery") is True


# ---------- /api/upload PDF ----------
@pytest.fixture(scope="module")
def uploaded_pdf(admin_token):
    pdf = b"%PDF-1.4\n%TEST\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    files = {"file": ("TEST_sample.pdf", pdf, "application/pdf")}
    r = requests.post(f"{BASE_URL}/api/upload", headers={"Authorization": f"Bearer {admin_token}"}, files=files, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["url"].startswith("/api/files/")
    assert d["content_type"] == "application/pdf"
    return d


def test_file_token_redirects_to_r2(uploaded_pdf, admin_token):
    url = f"{BASE_URL}{uploaded_pdf['url']}?token={admin_token}"
    r = requests.get(url, allow_redirects=False, timeout=30)
    assert r.status_code == 307, (r.status_code, r.text[:200])
    loc = r.headers.get("location", "")
    assert "r2.cloudflarestorage.com" in loc or ".r2.dev" in loc, loc
    # Follow redirect and fetch bytes
    r2 = requests.get(loc, timeout=60)
    assert r2.status_code == 200
    assert r2.content.startswith(b"%PDF")
    assert "pdf" in r2.headers.get("content-type", "").lower()


def test_file_header_auth_proxy(uploaded_pdf, admin_headers):
    url = f"{BASE_URL}{uploaded_pdf['url']}"
    r = requests.get(url, headers=admin_headers, timeout=60, allow_redirects=False)
    # header auth path -> proxy returns 200 bytes (not redirect)
    assert r.status_code == 200, (r.status_code, r.text[:200])
    assert r.content.startswith(b"%PDF")


def test_file_no_auth_401(uploaded_pdf):
    r = requests.get(f"{BASE_URL}{uploaded_pdf['url']}", timeout=30, allow_redirects=False)
    assert r.status_code == 401


def test_file_nonexistent_with_token_404(admin_token):
    r = requests.get(f"{BASE_URL}/api/files/does/not/exist.pdf?token={admin_token}", allow_redirects=False, timeout=30)
    assert r.status_code == 404


# ---------- MP4 upload ----------
def test_upload_mp4_and_fetch(admin_token):
    path = "/tmp/mov_bbb.mp4"
    if not os.path.exists(path):
        pytest.skip("mp4 fixture missing")
    with open(path, "rb") as fh:
        files = {"file": ("TEST_mov_bbb.mp4", fh.read(), "video/mp4")}
    r = requests.post(f"{BASE_URL}/api/upload", headers={"Authorization": f"Bearer {admin_token}"}, files=files, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["content_type"] == "video/mp4"
    # token redirect
    red = requests.get(f"{BASE_URL}{d['url']}?token={admin_token}", allow_redirects=False, timeout=30)
    assert red.status_code == 307
    loc = red.headers.get("location", "")
    assert "r2.cloudflarestorage.com" in loc
    # Range request to simulate video seeking
    rng = requests.get(loc, headers={"Range": "bytes=0-1023"}, timeout=60)
    assert rng.status_code in (200, 206)
    assert len(rng.content) > 0
    assert "video" in rng.headers.get("content-type", "").lower() or rng.headers.get("content-type","").endswith("mp4")


# ---------- question image ----------
def test_upload_question_image_public_r2(admin_token):
    png = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 32)  # minimal-ish bytes; backend may validate by ext only
    files = {"file": ("TEST_q.png", png, "image/png")}
    r = requests.post(f"{BASE_URL}/api/questions/upload-image", headers={"Authorization": f"Bearer {admin_token}"}, files=files, timeout=60)
    assert r.status_code == 200, r.text
    url_rel = r.json().get("url") if isinstance(r.json(), dict) else r.json()
    if isinstance(url_rel, dict):
        url_rel = url_rel.get("url")
    # Backend returns plain string per routes_files.py
    if not isinstance(url_rel, str):
        url_rel = r.text.strip().strip('"')
    assert "/api/question-images/" in url_rel, url_rel
    red = requests.get(f"{BASE_URL}{url_rel}", allow_redirects=False, timeout=30)
    assert red.status_code == 302, (red.status_code, red.text[:200])
    loc = red.headers.get("location", "")
    assert "pub-74b9f7bee68a4334803c36aaf1ec775c.r2.dev" in loc, loc
    img = requests.get(loc, timeout=30)
    assert img.status_code == 200
    assert img.content[:4] == b"\x89PNG"
