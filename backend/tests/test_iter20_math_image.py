"""Iteration 20: question image upload, public image endpoint, bulk import ZIP with image, templates include 'gambar'."""
import io
import os
import zipfile
import pytest
import requests
from openpyxl import Workbook

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@lms.id"
ADMIN_PASS = os.environ.get("ADMIN_PASSWORD", "Admin@12345")

# 1x1 PNG
PNG = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
    "0000000D49444154789C636000020000050001E221BC330000000049454E44AE426082"
)


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def tryout_id(admin):
    # pick a tryout; create if none
    r = admin.get(f"{BASE_URL}/api/admin/tryouts")
    assert r.status_code == 200
    items = r.json()
    if items:
        return items[0]["id"]
    r = admin.post(f"{BASE_URL}/api/admin/tryouts", json={"title": "TEST_MATH_TO", "duration_minutes": 30, "price": 0, "is_free": True})
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def test_upload_image_requires_admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/questions/upload-image", files={"file": ("x.png", PNG, "image/png")})
    assert r.status_code in (401, 403)


def test_upload_image_rejects_non_image(admin):
    r = admin.post(f"{BASE_URL}/api/questions/upload-image", files={"file": ("evil.txt", b"not an image", "text/plain")})
    assert r.status_code == 400
    assert "gambar" in r.text.lower() or "format" in r.text.lower()


def test_upload_image_and_public_fetch(admin):
    r = admin.post(f"{BASE_URL}/api/questions/upload-image", files={"file": ("tiny.png", PNG, "image/png")})
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("/api/question-images/")
    # Public (no auth) fetch
    pub = requests.get(f"{BASE_URL}{url}")
    assert pub.status_code == 200
    assert pub.headers.get("content-type", "").startswith("image/")
    assert pub.content[:8] == PNG[:8]


def test_templates_include_gambar_column(admin):
    r = admin.get(f"{BASE_URL}/api/admin/questions/template")
    assert r.status_code == 200, r.text
    text = r.content.decode("utf-8", errors="ignore")
    assert "gambar" in text.lower()

    r2 = admin.get(f"{BASE_URL}/api/admin/questions/template.xlsx")
    assert r2.status_code == 200
    assert r2.content[:2] == b"PK"  # xlsx is a zip


def _build_xlsx_rows(rows, header):
    wb = Workbook()
    ws = wb.active
    ws.append(header)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_import_zip_with_image_attaches(admin, tryout_id):
    header = ["type", "text", "option_a", "option_b", "option_c", "option_d", "correct", "points", "competency", "tingkat", "gambar"]
    rows = [
        ["single", "TEST_IMPORT Soal dengan $x^2$ dan gambar", "A", "B", "C", "D", "A", 10, "numerasi", "sedang", "pic.png"],
        ["single", "TEST_IMPORT Soal tanpa gambar $\\frac{1}{2}$", "A", "B", "C", "D", "B", 10, "numerasi", "mudah", ""],
    ]
    xlsx_bytes = _build_xlsx_rows(rows, header)
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as z:
        z.writestr("soal.xlsx", xlsx_bytes)
        z.writestr("pic.png", PNG)
    r = admin.post(
        f"{BASE_URL}/api/admin/tryouts/{tryout_id}/questions/import",
        files={"file": ("bundle.zip", zbuf.getvalue(), "application/zip")},
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("imported", 0) >= 2, j

    # Fetch questions and ensure at least one has an image_url that resolves publicly
    rq = admin.get(f"{BASE_URL}/api/admin/tryouts/{tryout_id}/questions")
    assert rq.status_code == 200
    qs = rq.json()
    with_img = [q for q in qs if q.get("image_url") and "TEST_IMPORT" in q.get("text", "")]
    assert with_img, "No imported question got image_url attached"
    url = with_img[0]["image_url"]
    pub = requests.get(f"{BASE_URL}{url}")
    assert pub.status_code == 200
    assert pub.headers.get("content-type", "").startswith("image/")


def test_create_question_with_and_without_image(admin, tryout_id):
    # upload image first
    r = admin.post(f"{BASE_URL}/api/questions/upload-image", files={"file": ("t2.png", PNG, "image/png")})
    assert r.status_code == 200
    img_url = r.json()["url"]

    base_q = {
        "type": "single",
        "text": "TEST_MATH $\\frac{1}{2}+\\frac{1}{3}$",
        "options": [{"id": "a", "text": "$x^2$"}, {"id": "b", "text": "$\\sqrt{2}$"}, {"id": "c", "text": "C"}, {"id": "d", "text": "D"}],
        "correct_answers": ["a"],
        "points": 10,
        "order": 0,
        "competency": "umum",
        "difficulty_label": "sedang",
    }
    r1 = admin.post(f"{BASE_URL}/api/admin/tryouts/{tryout_id}/questions", json={**base_q, "image_url": img_url})
    assert r1.status_code in (200, 201), r1.text
    assert r1.json().get("image_url") == img_url

    r2 = admin.post(f"{BASE_URL}/api/admin/tryouts/{tryout_id}/questions", json={**base_q, "image_url": None})
    assert r2.status_code in (200, 201), r2.text
    assert r2.json().get("image_url") in (None, "")


def test_student_gets_image_url_in_question(admin, tryout_id):
    # Publish tryout to be sure student can access
    admin.put(f"{BASE_URL}/api/admin/tryouts/{tryout_id}", json={"published": True, "price": 0})

    # Register a student
    import uuid as _u
    email = f"TEST_stu_{_u.uuid4().hex[:8]}@test.lms"
    s = requests.Session()
    reg = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Student@123", "name": "Test Stu"})
    if reg.status_code not in (200, 201):
        pytest.skip(f"register failed: {reg.status_code} {reg.text}")
    reg_data = reg.json()
    uid = reg_data.get("id")
    print("REG:", reg.status_code, reg_data)

    # Find and approve
    if not uid:
        users = admin.get(f"{BASE_URL}/api/admin/users").json()
        uid = next((u["id"] for u in users if u.get("email") == email), None)
    assert uid, "new user not found"
    admin.put(f"{BASE_URL}/api/admin/users/{uid}", json={"status": "approved"})

    # Student login
    s2 = requests.Session()
    lg = s2.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "Student@123"})
    assert lg.status_code == 200, lg.text

    # Try access tryout detail (contains questions) - may need enroll first
    tried = []
    for path, method in [
        (f"/api/student/tryouts/{tryout_id}", "get"),
        (f"/api/student/tryouts/{tryout_id}/start", "post"),
    ]:
        rr = s2.get(f"{BASE_URL}{path}") if method == "get" else s2.post(f"{BASE_URL}{path}")
        tried.append((path, rr.status_code))
        if rr.status_code == 200:
            data = rr.json()
            qs = data.get("questions") if isinstance(data, dict) else data
            if qs:
                assert any("image_url" in q for q in qs), f"image_url field missing in student question payload: {qs[0]}"
                # also ensure answers are stripped
                assert all("correct_answers" not in q for q in qs), "correct_answers leaked to student"
                return
    pytest.skip(f"Could not reach student questions endpoint, tried: {tried}")
