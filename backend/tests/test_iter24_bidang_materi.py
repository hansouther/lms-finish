"""Iter24: Question bank by bidang/materi + per-tryout tab_warning_limit."""
import os
import pytest
import requests


def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        return None
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": "admin@lms.id", "password": "Admin@12345"})
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def student():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": "budi@lms.id", "password": "Siswa@12345"})
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def tryout_src(admin):
    body = {"title": "TEST_ITER24_SRC", "subject": "Matematika",
            "duration_minutes": 30, "published": True, "kind": "standalone",
            "tab_warning_limit": 3}
    r = admin.post(f"{API}/admin/tryouts", json=body)
    assert r.status_code == 200
    tid = r.json()["id"]
    # Three questions: two with bidang+materi, one left to backfill from subject
    qs = [
        {"text": "SRC Q1 Aljabar", "bidang": "Matematika", "materi": "Aljabar",
         "competency": "numerasi"},
        {"text": "SRC Q2 Geometri", "bidang": "Matematika", "materi": "Geometri",
         "competency": "numerasi"},
        {"text": "SRC Q3 no materi", "competency": "numerasi"},
    ]
    for i, q in enumerate(qs):
        payload = {"type": "single", "text": q["text"],
                   "options": [{"id": "o1", "text": "A"}, {"id": "o2", "text": "B"}],
                   "correct_answers": ["o1"], "points": 1, "order": i + 1,
                   "competency": q.get("competency")}
        if "bidang" in q:
            payload["bidang"] = q["bidang"]
        if "materi" in q:
            payload["materi"] = q["materi"]
        rq = admin.post(f"{API}/admin/tryouts/{tid}/questions", json=payload)
        assert rq.status_code == 200, rq.text
    yield tid
    admin.delete(f"{API}/admin/tryouts/{tid}")


@pytest.fixture(scope="module")
def tryout_dst(admin):
    body = {"title": "TEST_ITER24_DST", "subject": "Fisika",
            "duration_minutes": 30, "published": True, "kind": "standalone"}
    r = admin.post(f"{API}/admin/tryouts", json=body)
    assert r.status_code == 200
    tid = r.json()["id"]
    yield tid
    admin.delete(f"{API}/admin/tryouts/{tid}")


# ---------------- Question Bank facets + filters ----------------
def test_bidang_defaulting(admin, tryout_src):
    """Q with no bidang should default to tryout subject on create."""
    qs = admin.get(f"{API}/admin/tryouts/{tryout_src}/questions").json()
    q3 = next(q for q in qs if q["text"] == "SRC Q3 no materi")
    assert q3.get("bidang") == "Matematika", f"Expected default subject, got {q3.get('bidang')}"


def test_question_bank_facets(admin, tryout_src):
    r = admin.get(f"{API}/admin/question-bank")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data and "facets" in data
    facets = data["facets"]
    assert "bidang" in facets and "materi" in facets
    assert "Matematika" in facets["bidang"]
    mat_materi = facets["materi"].get("Matematika", [])
    assert "Aljabar" in mat_materi and "Geometri" in mat_materi


def test_question_bank_filter_by_bidang_materi(admin, tryout_src):
    r = admin.get(f"{API}/admin/question-bank",
                  params={"bidang": "Matematika", "materi": "Aljabar"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert all(it["bidang"] == "Matematika" and it["materi"] == "Aljabar" for it in items)
    # search text
    r2 = admin.get(f"{API}/admin/question-bank", params={"q": "Geometri"})
    items2 = r2.json()["items"]
    assert any("Geometri" in it["text"] for it in items2)
    assert all("Geometri" in it["text"] or "geometri" in it["text"].lower() for it in items2)


def test_question_bank_exclude(admin, tryout_src):
    r = admin.get(f"{API}/admin/question-bank", params={"exclude": tryout_src})
    items = r.json()["items"]
    assert all(it["tryout_id"] != tryout_src for it in items)


def test_question_bank_filter_competency(admin, tryout_src):
    r = admin.get(f"{API}/admin/question-bank", params={"competency": "numerasi"})
    items = r.json()["items"]
    assert all(it.get("competency") == "numerasi" for it in items)


# ---------------- Bulk materi ----------------
def test_bulk_materi(admin, tryout_src):
    qs = admin.get(f"{API}/admin/tryouts/{tryout_src}/questions").json()
    qids = [q["id"] for q in qs[:2]]
    r = admin.post(f"{API}/admin/tryouts/{tryout_src}/questions/bulk-materi",
                   json={"question_ids": qids, "materi": "Trigonometri"})
    assert r.status_code == 200
    assert r.json()["updated"] == 2
    # Verify
    qs2 = admin.get(f"{API}/admin/tryouts/{tryout_src}/questions").json()
    updated = {q["id"]: q["materi"] for q in qs2}
    for qid in qids:
        assert updated[qid] == "Trigonometri"


def test_bulk_materi_empty_payload_rejected(admin, tryout_src):
    r = admin.post(f"{API}/admin/tryouts/{tryout_src}/questions/bulk-materi",
                   json={"question_ids": [], "materi": "Statistika"})
    assert r.status_code == 400


# ---------------- Copy question-bank (excludes current tryout) ----------------
def test_copy_from_bank(admin, tryout_src, tryout_dst):
    bank = admin.get(f"{API}/admin/question-bank", params={"exclude": tryout_dst}).json()
    src_ids = [it["id"] for it in bank["items"] if it["tryout_id"] == tryout_src]
    assert len(src_ids) >= 2
    r = admin.post(f"{API}/admin/tryouts/{tryout_dst}/questions/copy",
                   json={"question_ids": src_ids[:2]})
    assert r.status_code == 200
    assert r.json()["copied"] == 2
    qs = admin.get(f"{API}/admin/tryouts/{tryout_dst}/questions").json()
    assert any(q.get("copied_from") in src_ids for q in qs)


# ---------------- tab_warning_limit ----------------
def test_tab_limit_persists(admin, tryout_src):
    rows = admin.get(f"{API}/admin/tryouts").json()
    t = next(x for x in rows if x["id"] == tryout_src)
    assert t.get("tab_warning_limit") == 3


def test_tab_limit_default_is_5(admin, tryout_dst):
    rows = admin.get(f"{API}/admin/tryouts").json()
    t = next(x for x in rows if x["id"] == tryout_dst)
    # Default when not specified
    assert t.get("tab_warning_limit") in (5, None)


def test_tab_limit_422_above_20(admin):
    body = {"title": "TEST_ITER24_BAD", "subject": "Umum",
            "duration_minutes": 10, "published": False, "kind": "standalone",
            "tab_warning_limit": 25}
    r = admin.post(f"{API}/admin/tryouts", json=body)
    assert r.status_code == 422
    if r.status_code == 200:  # cleanup if bug
        admin.delete(f"{API}/admin/tryouts/{r.json()['id']}")


def test_tab_limit_0_disables_detection(admin, student):
    body = {"title": "TEST_ITER24_ZERO", "subject": "Umum",
            "duration_minutes": 10, "published": True, "kind": "standalone",
            "tab_warning_limit": 0}
    r = admin.post(f"{API}/admin/tryouts", json=body)
    tid = r.json()["id"]
    try:
        admin.post(f"{API}/admin/tryouts/{tid}/questions", json={
            "type": "single", "text": "Z1",
            "options": [{"id": "o1", "text": "A"}, {"id": "o2", "text": "B"}],
            "correct_answers": ["o1"], "points": 1, "order": 1,
        })
        # student starts
        att = student.post(f"{API}/student/tryouts/{tid}/start").json()
        aid = att["id"]
        # student detail should surface tab_warning_limit=0
        detail = student.get(f"{API}/student/tryouts/{tid}").json()
        assert detail.get("tab_warning_limit") == 0
        # violation endpoint should 400
        rv = student.post(f"{API}/student/attempts/{aid}/violation", json={"answers": {}})
        assert rv.status_code == 400
    finally:
        admin.delete(f"{API}/admin/tryouts/{tid}")


def test_tab_limit_2_auto_submit_on_second(admin, student):
    body = {"title": "TEST_ITER24_LIM2", "subject": "Umum",
            "duration_minutes": 10, "published": True, "kind": "standalone",
            "tab_warning_limit": 2}
    r = admin.post(f"{API}/admin/tryouts", json=body)
    tid = r.json()["id"]
    try:
        admin.post(f"{API}/admin/tryouts/{tid}/questions", json={
            "type": "single", "text": "L2",
            "options": [{"id": "o1", "text": "A"}, {"id": "o2", "text": "B"}],
            "correct_answers": ["o1"], "points": 1, "order": 1,
        })
        att = student.post(f"{API}/student/tryouts/{tid}/start").json()
        aid = att["id"]
        r1 = student.post(f"{API}/student/attempts/{aid}/violation", json={"answers": {}})
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["count"] == 1 and d1["auto_submitted"] is False and d1["max"] == 2
        r2 = student.post(f"{API}/student/attempts/{aid}/violation", json={"answers": {}})
        d2 = r2.json()
        assert d2["count"] == 2 and d2["auto_submitted"] is True
        detail = student.get(f"{API}/student/attempts/{aid}").json()
        assert detail["status"] == "submitted"
        assert detail.get("auto_submit_reason") == "tab_violation"
    finally:
        admin.delete(f"{API}/admin/tryouts/{tid}")


def test_tab_limit_update(admin, tryout_dst):
    r = admin.put(f"{API}/admin/tryouts/{tryout_dst}", json={
        "title": "TEST_ITER24_DST", "subject": "Fisika",
        "duration_minutes": 30, "published": True, "kind": "standalone",
        "tab_warning_limit": 10,
    })
    assert r.status_code == 200
    rows = admin.get(f"{API}/admin/tryouts").json()
    t = next(x for x in rows if x["id"] == tryout_dst)
    assert t.get("tab_warning_limit") == 10
