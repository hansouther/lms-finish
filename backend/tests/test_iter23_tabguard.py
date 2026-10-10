"""Iter23: Tab-guard violations, shuffle question/options, question bank copy."""
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
ADMIN_EMAIL = "admin@lms.id"
ADMIN_PASS = "Admin@12345"
STU_EMAIL = "budi@lms.id"
STU_PASS = "Siswa@12345"
STU2_EMAIL = "siti@lms.id"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def student():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": STU_EMAIL, "password": STU_PASS})
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def student2():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": STU2_EMAIL, "password": STU_PASS})
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def tryout_a(admin):
    """Tryout A with shuffle flags OFF and 5 questions."""
    body = {
        "title": "TEST_ITER23_A", "description": "x", "subject": "Matematika",
        "duration_minutes": 30, "published": True, "kind": "standalone",
        "shuffle_questions": False, "shuffle_options": False,
    }
    r = admin.post(f"{API}/admin/tryouts", json=body)
    assert r.status_code == 200
    tid = r.json()["id"]
    for i in range(5):
        q = {
            "type": "single", "text": f"Q{i} TEST_ITER23",
            "options": [{"id": "o1", "text": "A"}, {"id": "o2", "text": "B"},
                        {"id": "o3", "text": "C"}, {"id": "o4", "text": "D"}],
            "correct_answers": ["o1"], "points": 1, "order": i + 1, "competency": "numerasi",
        }
        rq = admin.post(f"{API}/admin/tryouts/{tid}/questions", json=q)
        assert rq.status_code == 200
    yield tid
    admin.delete(f"{API}/admin/tryouts/{tid}")


@pytest.fixture(scope="module")
def tryout_b(admin):
    body = {
        "title": "TEST_ITER23_B", "subject": "Fisika",
        "duration_minutes": 30, "published": True, "kind": "standalone",
    }
    r = admin.post(f"{API}/admin/tryouts", json=body)
    assert r.status_code == 200
    tid = r.json()["id"]
    yield tid
    admin.delete(f"{API}/admin/tryouts/{tid}")


# ---------- Shuffle: admin flags persisted ----------
def test_shuffle_flags_persist(admin, tryout_a):
    r = admin.put(f"{API}/admin/tryouts/{tryout_a}", json={
        "title": "TEST_ITER23_A", "description": "x", "subject": "Matematika",
        "duration_minutes": 30, "published": True, "kind": "standalone",
        "shuffle_questions": True, "shuffle_options": True,
    })
    assert r.status_code == 200
    rows = admin.get(f"{API}/admin/tryouts").json()
    t = next(x for x in rows if x["id"] == tryout_a)
    assert t["shuffle_questions"] is True
    assert t["shuffle_options"] is True


# ---------- Shuffle: deterministic per student & stable across reload ----------
def test_shuffle_stable_for_student(student, tryout_a):
    r1 = student.get(f"{API}/student/tryouts/{tryout_a}").json()
    r2 = student.get(f"{API}/student/tryouts/{tryout_a}").json()
    ids1 = [q["id"] for q in r1["questions"]]
    ids2 = [q["id"] for q in r2["questions"]]
    assert ids1 == ids2, "Order must be stable across refresh for the same student"
    opts1 = [[o["id"] for o in q.get("options", [])] for q in r1["questions"]]
    opts2 = [[o["id"] for o in q.get("options", [])] for q in r2["questions"]]
    assert opts1 == opts2, "Options order must be stable across refresh"


def test_shuffle_different_students_may_differ(student, student2, tryout_a):
    r1 = student.get(f"{API}/student/tryouts/{tryout_a}").json()
    r2 = student2.get(f"{API}/student/tryouts/{tryout_a}").json()
    ids1 = [q["id"] for q in r1["questions"]]
    ids2 = [q["id"] for q in r2["questions"]]
    # Deterministic per user ⇒ with 5 items and 2 users, highly likely different
    assert isinstance(ids1, list) and len(ids1) == 5
    assert isinstance(ids2, list) and len(ids2) == 5


# ---------- Shuffle OFF ----------
def test_shuffle_off_preserves_order(admin, student, tryout_b):
    # add 3 questions
    for i in range(3):
        admin.post(f"{API}/admin/tryouts/{tryout_b}/questions", json={
            "type": "single", "text": f"B{i}",
            "options": [{"id": "o1", "text": "A"}, {"id": "o2", "text": "B"}],
            "correct_answers": ["o1"], "points": 1, "order": i + 1,
        })
    r = student.get(f"{API}/student/tryouts/{tryout_b}").json()
    texts = [q["text"] for q in r["questions"]]
    assert texts == ["B0", "B1", "B2"]


# ---------- Question bank + copy ----------
def test_question_bank_and_copy(admin, tryout_a, tryout_b):
    bank = admin.get(f"{API}/admin/question-bank", params={"exclude": tryout_b}).json()
    src = next((x for x in bank if x["id"] == tryout_a), None)
    assert src is not None, "Expected tryout_a available as source"
    qids = [q["id"] for q in src["questions"]][:3]
    r = admin.post(f"{API}/admin/tryouts/{tryout_b}/questions/copy", json={"question_ids": qids})
    assert r.status_code == 200
    assert r.json()["copied"] == 3
    # Verify copied
    qs = admin.get(f"{API}/admin/tryouts/{tryout_b}/questions").json()
    assert any(q.get("copied_from") in qids for q in qs)


# ---------- Violation endpoint ----------
@pytest.fixture
def fresh_tryout(admin):
    body = {"title": "TEST_ITER23_V", "subject": "Umum", "duration_minutes": 30,
            "published": True, "kind": "standalone"}
    r = admin.post(f"{API}/admin/tryouts", json=body)
    tid = r.json()["id"]
    admin.post(f"{API}/admin/tryouts/{tid}/questions", json={
        "type": "single", "text": "V1",
        "options": [{"id": "o1", "text": "A"}, {"id": "o2", "text": "B"}],
        "correct_answers": ["o1"], "points": 1, "order": 1,
    })
    yield tid
    admin.delete(f"{API}/admin/tryouts/{tid}")


def test_violation_counts_and_auto_submit(admin, student, fresh_tryout):
    # reset any prior
    tid = fresh_tryout
    s = student
    att = s.post(f"{API}/student/tryouts/{tid}/start").json()
    aid = att["id"]
    counts = []
    for i in range(4):
        r = s.post(f"{API}/student/attempts/{aid}/violation", json={"answers": {}})
        assert r.status_code == 200
        d = r.json()
        counts.append(d["count"])
        assert d["auto_submitted"] is False
    assert counts == [1, 2, 3, 4]
    # 5th should auto-submit
    r = s.post(f"{API}/student/attempts/{aid}/violation", json={"answers": {}})
    assert r.status_code == 200
    d = r.json()
    assert d["count"] == 5
    assert d["auto_submitted"] is True
    # Attempt now submitted
    detail = s.get(f"{API}/student/attempts/{aid}").json()
    assert detail["status"] == "submitted"
    assert detail.get("auto_submit_reason") == "tab_violation"
    # 409 on further violation after submit
    r2 = s.post(f"{API}/student/attempts/{aid}/violation", json={"answers": {}})
    assert r2.status_code == 409


def test_violation_rejects_exercise(admin, student):
    # Create a course + exercise
    cr = admin.post(f"{API}/admin/courses", json={"title": "TEST_ITER23_C", "description": "x",
                                                 "subject": "Umum", "price": 0, "active": True}).json()
    cid = cr["id"]
    ex = admin.post(f"{API}/admin/courses/{cid}/exercises", json={"title": "TEST_ITER23_EX",
                                                                   "duration_minutes": 10}).json()
    eid = ex["id"]
    admin.post(f"{API}/admin/tryouts/{eid}/questions", json={
        "type": "single", "text": "E1",
        "options": [{"id": "o1", "text": "A"}, {"id": "o2", "text": "B"}],
        "correct_answers": ["o1"], "points": 1, "order": 1,
    })
    # Enroll student
    student.post(f"{API}/student/courses/{cid}/enroll")
    att = student.post(f"{API}/student/tryouts/{eid}/start").json()
    r = student.post(f"{API}/student/attempts/{att['id']}/violation", json={"answers": {}})
    assert r.status_code == 400
    # cleanup
    admin.delete(f"{API}/admin/tryouts/{eid}")
    admin.delete(f"{API}/admin/courses/{cid}")


# ---------- Monitor/results cheat_total persists after reset ----------
def test_cheat_total_persists_after_reset(admin, student, fresh_tryout):
    tid = fresh_tryout
    att = student.post(f"{API}/student/tryouts/{tid}/start").json()
    aid = att["id"]
    for _ in range(3):
        student.post(f"{API}/student/attempts/{aid}/violation", json={"answers": {}})
    # admin reset
    r = admin.post(f"{API}/admin/tryouts/{tid}/attempts/{aid}/reset")
    assert r.status_code == 200
    mon = admin.get(f"{API}/admin/tryouts/{tid}/monitor").json()
    retake_rows = [r for r in mon["rows"] if r["status"] == "retake_pending"]
    assert retake_rows, "Expected a retake_pending row"
    assert retake_rows[0]["cheat_total"] >= 3
