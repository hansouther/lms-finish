"""Tests for the new 'Benar/Salah Majemuk' (truefalse_multi) feature + tf_labels on truefalse.

Covers:
- Templates (CSV/XLSX) contain truefalse_multi row + label_benar/label_salah columns.
- Admin can create truefalse_multi questions via API with tf_labels + options + correct_answers like 'o1:true'.
- Admin can update tf_labels on existing truefalse question.
- Student fetches questions with tf_labels but WITHOUT correct_answers.
- Full attempt lifecycle: start -> submit mixed answers -> partial score for truefalse_multi (points*hits/total rounded).
- CSV import creates truefalse_multi questions with proper correct_answers + tf_labels.
"""
import io
import os
import re
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@lms.id")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
TRYOUT_ID = "to_3"


def _login_session(email, pwd):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=20)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def admin_h():
    return _login_session(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def student():
    """Create & approve a student via admin to run attempt flow."""
    email = "test_iter21_stud@example.com"
    pwd = "StudentPass123!"
    requests.post(f"{BASE_URL}/api/auth/register", json={"name": "Iter21 Student", "email": email, "password": pwd}, timeout=20)
    admin = _login_session(ADMIN_EMAIL, ADMIN_PASSWORD)
    users = admin.get(f"{BASE_URL}/api/admin/users?role=student", timeout=20).json()
    me = next((u for u in users if u["email"] == email), None)
    assert me, "student not created"
    if me.get("status") != "approved":
        admin.put(f"{BASE_URL}/api/admin/users/{me['id']}", json={"status": "approved"}, timeout=20)
    s = _login_session(email, pwd)
    return {"id": me["id"], "session": s}


# -------- Templates --------
def test_template_csv_contains_tf_multi_and_labels(admin_h):
    r = admin_h.get(f"{BASE_URL}/api/admin/questions/template", timeout=20)
    assert r.status_code == 200
    text = r.text
    assert "label_benar" in text and "label_salah" in text
    assert "truefalse_multi" in text
    assert "Sesuai" in text and "Tidak Sesuai" in text


def test_template_xlsx_contains_tf_multi_and_labels(admin_h):
    r = admin_h.get(f"{BASE_URL}/api/admin/questions/template.xlsx", timeout=20)
    assert r.status_code == 200
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(r.content), read_only=True)
    ws = wb["Soal"]
    headers = [str(c.value or "").lower() for c in next(ws.iter_rows(min_row=1, max_row=1))]
    assert "label_benar" in headers and "label_salah" in headers
    rows = list(ws.iter_rows(values_only=True))
    has_tfm = any(r and r[0] == "truefalse_multi" for r in rows)
    assert has_tfm


# -------- CRUD truefalse_multi --------
_created_qids = []


def test_create_truefalse_multi_question(admin_h):
    payload = {
        "type": "truefalse_multi",
        "text": "Baca teks berikut. Rani membeli 3 buku Rp5.000 per buku bayar Rp20.000.",
        "options": [
            {"id": "o1", "text": "Total harga Rp15.000"},
            {"id": "o2", "text": "Kembalian Rp10.000"},
            {"id": "o3", "text": "Jika 4 buku uangnya pas"},
        ],
        "correct_answers": ["o1:true", "o2:false", "o3:true"],
        "tf_labels": ["Sesuai", "Tidak Sesuai"],
        "points": 15,
        "competency": "numerasi",
        "difficulty_label": "sedang",
    }
    r = admin_h.post(f"{BASE_URL}/api/admin/tryouts/{TRYOUT_ID}/questions", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    q = r.json()
    assert q["type"] == "truefalse_multi"
    assert q["tf_labels"] == ["Sesuai", "Tidak Sesuai"]
    assert set(q["correct_answers"]) == {"o1:true", "o2:false", "o3:true"}
    _created_qids.append(q["id"])


def test_question_appears_in_list_with_labels(admin_h):
    r = admin_h.get(f"{BASE_URL}/api/admin/tryouts/{TRYOUT_ID}/questions", timeout=20)
    assert r.status_code == 200
    q = next((x for x in r.json() if x["id"] == _created_qids[0]), None)
    assert q is not None
    assert q["tf_labels"] == ["Sesuai", "Tidak Sesuai"]


def test_update_tf_labels_on_truefalse_question(admin_h):
    # create a truefalse question
    payload = {
        "type": "truefalse", "text": "Pernyataan: Bumi bulat.",
        "options": [], "correct_answers": ["true"], "tf_labels": ["Fakta", "Opini"],
        "points": 5, "competency": "literasi", "difficulty_label": "mudah",
    }
    r = admin_h.post(f"{BASE_URL}/api/admin/tryouts/{TRYOUT_ID}/questions", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    qid = r.json()["id"]
    _created_qids.append(qid)
    # verify via GET
    lst = admin_h.get(f"{BASE_URL}/api/admin/tryouts/{TRYOUT_ID}/questions", timeout=20).json()
    q = next(x for x in lst if x["id"] == qid)
    assert q["tf_labels"] == ["Fakta", "Opini"]
    # update labels
    payload2 = {**payload, "tf_labels": ["Ya", "Tidak"]}
    r2 = admin_h.put(f"{BASE_URL}/api/admin/questions/{qid}", json=payload2, timeout=20)
    assert r2.status_code == 200
    lst2 = admin_h.get(f"{BASE_URL}/api/admin/tryouts/{TRYOUT_ID}/questions", timeout=20).json()
    q2 = next(x for x in lst2 if x["id"] == qid)
    assert q2["tf_labels"] == ["Ya", "Tidak"]


# -------- Student view --------
def test_student_view_strips_correct_answers_keeps_tf_labels(student):
    r = student["session"].get(f"{BASE_URL}/api/student/tryouts/{TRYOUT_ID}", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    qs = data.get("questions") or []
    tfm = next((q for q in qs if q["id"] == _created_qids[0]), None)
    assert tfm is not None
    assert "correct_answers" not in tfm
    assert tfm.get("tf_labels") == ["Sesuai", "Tidak Sesuai"]
    assert len(tfm["options"]) == 3


# -------- Partial scoring --------
def test_submit_attempt_and_partial_score(student):
    # start attempt
    r = student["session"].post(f"{BASE_URL}/api/student/tryouts/{TRYOUT_ID}/start", timeout=20)
    assert r.status_code == 200, r.text
    attempt = r.json()
    attempt_id = attempt["id"]

    # fetch questions to answer them
    data = student["session"].get(f"{BASE_URL}/api/student/tryouts/{TRYOUT_ID}", timeout=20).json()
    qs = data["questions"]

    answers = {}
    for q in qs:
        if q["id"] == _created_qids[0]:
            # 2 of 3 correct: o1:true (correct), o2:true (wrong, key=false), o3:true (correct)
            answers[q["id"]] = ["o1:true", "o2:true", "o3:true"]
        else:
            answers[q["id"]] = []

    # submit
    r = student["session"].post(
        f"{BASE_URL}/api/student/attempts/{attempt_id}/submit",
        json={"answers": answers}, timeout=30,
    )
    assert r.status_code == 200, r.text
    res = r.json()
    # fetch attempt detail
    detail = student["session"].get(f"{BASE_URL}/api/student/attempts/{attempt_id}", timeout=20).json()
    pq = next(p for p in detail["per_question"] if p["question_id"] == _created_qids[0])
    # 15 pts * 2/3 = 10
    assert pq["earned"] == 10, f"expected 10 got {pq['earned']} (points={pq['points']})"
    assert pq["points"] == 15
    assert pq["type"] == "truefalse_multi"


# -------- CSV import --------
def test_csv_import_truefalse_multi(admin_h):
    csv_text = (
        "type,text,option_a,option_b,option_c,option_d,correct,points,competency,tingkat,gambar,label_benar,label_salah\n"
        'truefalse_multi,"TEST_IMPORT_TFM stimulus",Pernyataan A,Pernyataan B,Pernyataan C,,"B;S;B",15,numerasi,sedang,,Sesuai,Tidak Sesuai\n'
    )
    files = {"file": ("tfm.csv", csv_text.encode("utf-8"), "text/csv")}
    r = admin_h.post(f"{BASE_URL}/api/admin/tryouts/{TRYOUT_ID}/questions/import", files=files, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["imported"] == 1, body
    assert body["errors"] == [], body
    # find the imported question
    lst = admin_h.get(f"{BASE_URL}/api/admin/tryouts/{TRYOUT_ID}/questions", timeout=20).json()
    imported = [q for q in lst if q["type"] == "truefalse_multi" and "TEST_IMPORT_TFM" in q.get("text", "")]
    assert imported, "imported question not found"
    q = imported[0]
    assert q["tf_labels"] == ["Sesuai", "Tidak Sesuai"]
    assert set(q["correct_answers"]) == {"o1:true", "o2:false", "o3:true"}
    _created_qids.append(q["id"])


# -------- Cleanup --------
def test_zz_cleanup(admin_h):
    """Delete all test-created questions and any pre-existing TEST_ questions beyond the first 5 seed."""
    # Delete all questions we tracked
    for qid in _created_qids:
        admin_h.delete(f"{BASE_URL}/api/admin/questions/{qid}", timeout=20)
    # Also delete any question beyond order 5 to clean iter20's seed
    lst = admin_h.get(f"{BASE_URL}/api/admin/tryouts/{TRYOUT_ID}/questions", timeout=20).json()
    seed_cutoff = 5
    deleted = 0
    for q in lst:
        # keep first 5 seed questions (lowest order)
        if (q.get("order") or 0) > seed_cutoff:
            admin_h.delete(f"{BASE_URL}/api/admin/questions/{q['id']}", timeout=20)
            deleted += 1
    print(f"Deleted {deleted} test questions beyond order {seed_cutoff}")
