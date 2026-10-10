"""Loader media (GIF/video) backend tests (iter35)."""
import io
import os
import struct
import zlib
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
def admin_headers():
    r = requests.post(f"{BASE}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def baseline(admin_headers):
    r = requests.get(f"{BASE}/api/admin/site-settings", headers=admin_headers, timeout=20)
    assert r.status_code == 200
    return r.json()


# minimal 1x1 GIF89a bytes
TINY_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff"
    b"!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


# ---- Loader_mode / fit validation ----

def test_put_accepts_custom_mode(admin_headers, baseline):
    body = {**baseline, "loader_mode": "custom", "loader_media_url": "", "loader_media_fit": "contain"}
    r = requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["loader_mode"] == "custom"
    assert data["loader_media_fit"] == "contain"


def test_put_accepts_media_mode_with_https_url(admin_headers, baseline):
    body = {**baseline, "loader_mode": "media",
            "loader_media_url": "https://www.w3schools.com/html/mov_bbb.mp4",
            "loader_media_fit": "cover"}
    r = requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["loader_mode"] == "media"
    assert data["loader_media_url"].startswith("https://")
    assert data["loader_media_fit"] == "cover"


def test_put_accepts_site_assets_relative_url(admin_headers, baseline):
    body = {**baseline, "loader_mode": "media",
            "loader_media_url": "/api/site-assets/abc.gif",
            "loader_media_fit": "contain"}
    r = requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text


def test_put_rejects_invalid_mode(admin_headers, baseline):
    body = {**baseline, "loader_mode": "weird"}
    r = requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)
    assert r.status_code == 422


def test_put_rejects_invalid_fit(admin_headers, baseline):
    body = {**baseline, "loader_media_fit": "stretch"}
    r = requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)
    assert r.status_code == 422


def test_put_rejects_bad_media_url(admin_headers, baseline):
    body = {**baseline, "loader_media_url": "ftp://evil/foo.mp4"}
    r = requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)
    assert r.status_code == 422


# ---- Asset upload: GIF and MP4 ----

def test_upload_gif_asset(admin_headers):
    files = {"file": ("tiny.gif", io.BytesIO(TINY_GIF), "image/gif")}
    r = requests.post(f"{BASE}/api/admin/site-assets", headers=admin_headers, files=files, timeout=30)
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.endswith(".gif")
    # ensure publicly fetchable (either R2 or /api/site-assets/)
    full = url if url.startswith("http") else f"{BASE}{url}"
    g = requests.get(full, timeout=30)
    assert g.status_code == 200
    assert g.content[:6] in (b"GIF87a", b"GIF89a")


def _tiny_mp4():
    # Minimal ftyp box so extension is accepted; backend only checks extension & size
    return b"\x00\x00\x00\x18ftypisom\x00\x00\x00\x00isomiso2mp41" + b"\x00" * 32


def test_upload_mp4_asset(admin_headers):
    files = {"file": ("tiny.mp4", io.BytesIO(_tiny_mp4()), "video/mp4")}
    r = requests.post(f"{BASE}/api/admin/site-assets", headers=admin_headers, files=files, timeout=30)
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.endswith(".mp4")


def test_upload_video_too_large(admin_headers):
    # 15MB + 1 byte
    big = b"\x00" * (15 * 1024 * 1024 + 1)
    files = {"file": ("big.mp4", io.BytesIO(big), "video/mp4")}
    r = requests.post(f"{BASE}/api/admin/site-assets", headers=admin_headers, files=files, timeout=60)
    assert r.status_code == 400


def test_upload_image_too_large(admin_headers):
    big = b"\x00" * (5 * 1024 * 1024 + 1)
    files = {"file": ("big.gif", io.BytesIO(big), "image/gif")}
    r = requests.post(f"{BASE}/api/admin/site-assets", headers=admin_headers, files=files, timeout=60)
    assert r.status_code == 400


def test_upload_rejects_unknown_ext(admin_headers):
    files = {"file": ("x.txt", io.BytesIO(b"hello"), "text/plain")}
    r = requests.post(f"{BASE}/api/admin/site-assets", headers=admin_headers, files=files, timeout=20)
    assert r.status_code == 400


# ---- Restore defaults ----

def test_zz_restore_defaults(admin_headers, baseline):
    body = {**baseline,
            "site_name": "Binara LMS",
            "loader_mode": "custom",
            "loader_media_url": "",
            "loader_media_fit": "contain"}
    r = requests.put(f"{BASE}/api/admin/site-settings", json=body, headers=admin_headers, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["loader_mode"] == "custom"
    assert data["loader_media_url"] == ""
    assert data["site_name"] == "Binara LMS"
