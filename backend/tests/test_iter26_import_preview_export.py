"""Iter26: Import preview/validate/import-rows + Question Bank Excel export (re-importable) + gambar_pembahasan."""
import io
import os
import zipfile

import openpyxl
import pytest
import requests


def _read_frontend_env():
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/")
API = f"{BASE_URL}/api"


# ============ Fixtures ============
@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": "admin@lms.id", "password": "Admin@12345"})
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def tryout(admin):
    body = {"title": "TEST_ITER26_IMP", "subject": "Matematika",
            "duration_minutes": 30, "published": False, "kind": "standalone"}
    r = admin.post(f"{API}/admin/tryouts", json=body)
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    yield tid
    # Cleanup
    admin.delete(f"{API}/admin/tryouts/{tid}")


# PNG magic bytes for tiny valid image
_PNG = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
        b"\xc0\x00\x00\x00\x03\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82")


def _xlsx_bytes(rows, headers=None):
    headers = headers or ["type", "text", "option_a", "option_b", "option_c", "option_d",
                          "correct", "points", "competency", "tingkat", "bidang", "materi",
                          "pembahasan", "gambar", "gambar_pembahasan"]
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for r in rows:
        ws.append([r.get(h, "") for h in headers])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _good_rows(n=3):
    return [{"type": "single", "text": f"Soal {i} 2+{i}=?", "option_a": "1", "option_b": "2",
             "option_c": "3", "option_d": "4", "correct": "D" if i == 2 else "A",
             "points": 10, "competency": "numerasi", "tingkat": "mudah",
             "bidang": "Matematika", "materi": "Aritmatika",
             "pembahasan": f"Pembahasan {i}"} for i in range(n)]


# ============ Preview tests ============
def test_preview_xlsx_all_valid(admin, tryout):
    data = _xlsx_bytes(_good_rows(3))
    r = admin.post(f"{API}/admin/questions/import/preview",
                   files={"file": ("soal.xlsx", data,
                                   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["valid"] == 3 and j["invalid"] == 0
    assert len(j["rows"]) == 3
    for row in j["rows"]:
        assert row["ok"] is True
        assert row["error"] is None
        assert row["question"] is not None


def test_preview_xlsx_mixed(admin):
    rows = _good_rows(2) + [{"type": "single", "text": "", "option_a": "x",
                             "option_b": "y", "correct": "A", "points": 5}]
    data = _xlsx_bytes(rows)
    r = admin.post(f"{API}/admin/questions/import/preview",
                   files={"file": ("soal.xlsx", data, "application/octet-stream")})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["valid"] == 2
    assert j["invalid"] == 1
    assert j["rows"][2]["ok"] is False
    assert j["rows"][2]["error"]


def test_preview_zip_with_images(admin):
    rows = [{"type": "single", "text": "Lihat gambar", "option_a": "a", "option_b": "b",
             "option_c": "c", "option_d": "d", "correct": "A", "points": 10,
             "competency": "numerasi", "tingkat": "mudah", "bidang": "Matematika",
             "materi": "Geometri", "pembahasan": "lihat pembahasan",
             "gambar": "segitiga.png", "gambar_pembahasan": "pembahasan_segitiga.png"}]
    xlsx = _xlsx_bytes(rows)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("soal.xlsx", xlsx)
        zf.writestr("segitiga.png", _PNG)
        zf.writestr("pembahasan_segitiga.png", _PNG)
    r = admin.post(f"{API}/admin/questions/import/preview",
                   files={"file": ("import.zip", buf.getvalue(), "application/zip")})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["valid"] == 1 and j["invalid"] == 0
    raw = j["rows"][0]["raw"]
    # ZIP image uploaded and replaced with /api/question-images URL
    assert raw["gambar"].startswith(("/api/", "http")), f"gambar not URL: {raw['gambar']}"
    assert raw["gambar_pembahasan"].startswith(("/api/", "http")), raw["gambar_pembahasan"]
    q = j["rows"][0]["question"]
    assert q["image_url"]
    assert q["explanation_image_url"]


# ============ Validate tests ============
def test_validate_rows_endpoint(admin):
    rows = _good_rows(1) + [{"type": "single", "text": "x"}]  # second row invalid
    r = admin.post(f"{API}/admin/questions/import/validate", json={"rows": rows})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["valid"] == 1 and j["invalid"] == 1


# ============ Import rows ============
def test_import_rows_only_valid(admin, tryout):
    rows = _good_rows(3)
    # Mark one invalid in the submitted rows -> should be skipped
    rows[1] = {"type": "single", "text": "bad"}
    r = admin.post(f"{API}/admin/tryouts/{tryout}/questions/import-rows", json={"rows": rows})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["imported"] == 2
    # Verify via GET
    g = admin.get(f"{API}/admin/tryouts/{tryout}/questions")
    assert g.status_code == 200
    qs = g.json()
    assert len(qs) == 2
    # bidang default to tryout subject when missing (ours set 'Matematika' explicitly)
    assert all(q.get("bidang") == "Matematika" for q in qs)


def test_import_rows_bidang_defaults_to_subject(admin, tryout):
    rows = [{"type": "single", "text": "No bidang q", "option_a": "x", "option_b": "y",
             "option_c": "z", "option_d": "w", "correct": "A", "points": 5,
             "competency": "numerasi", "tingkat": "mudah", "materi": "umum",
             "pembahasan": "p"}]
    r = admin.post(f"{API}/admin/tryouts/{tryout}/questions/import-rows", json={"rows": rows})
    assert r.status_code == 200, r.text
    assert r.json()["imported"] == 1
    g = admin.get(f"{API}/admin/tryouts/{tryout}/questions").json()
    last = [q for q in g if q["text"] == "No bidang q"][0]
    assert last["bidang"] == "Matematika"


# ============ Legacy import ============
def test_legacy_import_still_works(admin, tryout):
    data = _xlsx_bytes(_good_rows(1))
    r = admin.post(f"{API}/admin/tryouts/{tryout}/questions/import",
                   files={"file": ("legacy.xlsx", data, "application/octet-stream")})
    assert r.status_code == 200, r.text
    assert r.json()["imported"] == 1


# ============ Export ============
def test_export_has_headers_and_sumber(admin, tryout):
    r = admin.get(f"{API}/admin/question-bank/export", params={"bidang": "Matematika"})
    assert r.status_code == 200, r.text
    assert "spreadsheet" in r.headers.get("content-type", "").lower() or "xlsx" in r.headers.get("content-type", "")
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    ws = wb["Soal"] if "Soal" in wb.sheetnames else wb.active
    headers = [c.value for c in ws[1]]
    assert "gambar_pembahasan" in headers
    assert "sumber_tryout" in headers
    assert "type" in headers and "text" in headers and "correct" in headers
    assert ws.max_row >= 2  # at least one row


def test_export_reimportable_all_valid(admin):
    # Export filtered to our test tryout's bidang+materi
    r = admin.get(f"{API}/admin/question-bank/export",
                  params={"bidang": "Matematika", "materi": "Aritmatika"})
    assert r.status_code == 200
    data = r.content
    # Feed back to preview
    r2 = admin.post(f"{API}/admin/questions/import/preview",
                    files={"file": ("reexport.xlsx", data, "application/octet-stream")})
    assert r2.status_code == 200, r2.text
    j = r2.json()
    assert j["valid"] > 0
    assert j["invalid"] == 0, f"Re-importing export should be all valid. Errors: {[r['error'] for r in j['rows'] if not r['ok']]}"


# ============ Template endpoint sanity ============
def test_template_includes_gambar_pembahasan(admin):
    r = admin.get(f"{API}/admin/questions/template")
    assert r.status_code == 200
    assert "gambar_pembahasan" in r.text.splitlines()[0]
    r = admin.get(f"{API}/admin/questions/template.xlsx")
    assert r.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(r.content))
    headers = [c.value for c in wb.active[1]]
    assert "gambar_pembahasan" in headers
