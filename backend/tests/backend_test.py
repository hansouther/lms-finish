"""Backend API tests for LMS RBAC Platform.
Covers: auth, RBAC, public routes, student CBT flow, admin CRUD, tutor bidding, proctor isolation.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cbt-tryout-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@lms.id", "Admin@12345"),
    "tutor": ("tutor@lms.id", "Tutor@12345"),
    "proctor": ("proktor@lms.id", "Proktor@12345"),
    "student": ("siswa@lms.id", "Siswa@12345"),
    "student2": ("rizki@lms.id", "Siswa@12345"),
}


def login(role):
    s = requests.Session()
    email, pw = CREDS[role]
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"login {role} failed: {r.status_code} {r.text}"
    return s


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin(): return login("admin")

@pytest.fixture(scope="module")
def tutor(): return login("tutor")

@pytest.fixture(scope="module")
def proctor(): return login("proctor")

@pytest.fixture(scope="module")
def student(): return login("student")


# ---------- Health / Auth ----------
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200

    @pytest.mark.parametrize("role", ["admin", "tutor", "proctor", "student"])
    def test_login_and_me(self, role):
        s = login(role)
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == role.rstrip("2") if role.startswith("student") else data["role"] == role
        assert "password_hash" not in data

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@lms.id", "password": "wrong"})
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- RBAC ----------
class TestRBAC:
    def test_student_cannot_access_admin(self, student):
        r = student.get(f"{API}/admin/stats")
        assert r.status_code == 403

    def test_student_cannot_access_proctor(self, student):
        r = student.get(f"{API}/proctor/dashboard")
        assert r.status_code == 403

    def test_tutor_cannot_access_admin(self, tutor):
        r = tutor.get(f"{API}/admin/stats")
        assert r.status_code == 403

    def test_proctor_cannot_access_tutor(self, proctor):
        r = proctor.get(f"{API}/tutor/dashboard")
        assert r.status_code == 403


# ---------- Public ----------
class TestPublic:
    def test_news(self):
        r = requests.get(f"{API}/public/news"); assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_calendar(self):
        r = requests.get(f"{API}/public/calendar"); assert r.status_code == 200

    def test_courses(self):
        r = requests.get(f"{API}/public/courses"); assert r.status_code == 200

    def test_stats(self):
        r = requests.get(f"{API}/public/stats"); assert r.status_code == 200
        data = r.json()
        for k in ("students", "tutors", "courses", "schools"):
            assert k in data

    def test_partnership_submit(self):
        payload = {
            "org_name": "TEST_Org", "contact_name": "TEST Contact",
            "email": "test_partner@example.com", "phone": "0800",
            "org_type": "SMA", "student_count": 100, "message": "hello"
        }
        r = requests.post(f"{API}/public/partnerships", json=payload)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------- Student CBT critical flow ----------
class TestStudentCBT:
    def test_active_tryout_exists_and_full_flow(self, student):
        r = student.get(f"{API}/student/tryouts")
        assert r.status_code == 200
        tryouts = r.json()
        active = next((t for t in tryouts if "Aktif" in t.get("title", "")), None)
        assert active, f"No active tryout found: {[t['title'] for t in tryouts]}"
        tid = active["id"]

        # If already submitted from previous run, can't resubmit — skip live-take but validate detail
        if active.get("attempt_status") == "submitted":
            pytest.skip("Active tryout already submitted for this student in prior run")

        # Fetch detail (answers stripped)
        r = student.get(f"{API}/student/tryouts/{tid}")
        assert r.status_code == 200
        detail = r.json()
        questions = detail["questions"]
        assert len(questions) >= 4, "Expected at least 4 question types"
        for q in questions:
            assert "correct_answers" not in q, "Answers must be stripped from student payload"

        # Start
        r = student.post(f"{API}/student/tryouts/{tid}/start")
        assert r.status_code == 200
        attempt = r.json()
        attempt_id = attempt["id"]

        # Build answers - pick first option for choice types, "jakarta" for essay, "true" for tf
        answers = {}
        for q in questions:
            qid = q["id"]
            if q["type"] in ("single",):
                answers[qid] = [q["options"][0]["id"]] if q.get("options") else []
            elif q["type"] == "multiple":
                answers[qid] = [q["options"][0]["id"]] if q.get("options") else []
            elif q["type"] == "truefalse":
                answers[qid] = ["true"]
            elif q["type"] == "essay":
                # try 'JAKARTA' uppercase to verify case-insensitive grading
                answers[qid] = ["JAKARTA"]

        r = student.post(f"{API}/student/attempts/{attempt_id}/submit", json={"answers": answers})
        assert r.status_code == 200, r.text
        result = r.json()
        assert "score" in result and "max_score" in result and "percentage" in result
        assert result["max_score"] > 0

        # Verify detail page has per_question review with keys
        r = student.get(f"{API}/student/attempts/{attempt_id}")
        assert r.status_code == 200
        detail = r.json()
        assert detail["status"] == "submitted"
        assert isinstance(detail.get("per_question", []), list) and len(detail["per_question"]) == len(questions)

        # Verify case-insensitive essay grading: find essay question and check it was correct
        essay_q_ids = [q["id"] for q in questions if q["type"] == "essay"]
        if essay_q_ids:
            eq_id = essay_q_ids[0]
            pq = next((p for p in detail["per_question"] if p["question_id"] == eq_id), None)
            assert pq and pq.get("correct") is True, f"Essay case-insensitive grading failed: {pq}"


# ---------- Student enrollment ----------
class TestStudentCourses:
    def test_enroll_flow(self, student):
        r = student.get(f"{API}/student/courses")
        assert r.status_code == 200
        courses = r.json()
        assert courses
        target = next((c for c in courses if not c.get("enrolled")), None) or courses[0]
        r = student.post(f"{API}/student/courses/{target['id']}/enroll")
        assert r.status_code in (200, 400)  # 400 if already enrolled

    def test_materials(self, student):
        r = student.get(f"{API}/student/materials")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Admin tryout builder ----------
class TestAdminTryout:
    def test_create_tryout_and_questions(self, admin):
        r = admin.post(f"{API}/admin/tryouts", json={
            "title": "TEST_Tryout", "subject": "Matematika",
            "duration_minutes": 30, "published": True
        })
        assert r.status_code == 200
        tid = r.json()["id"]

        for qbody in [
            {"type": "single", "text": "1+1=?", "options": [
                {"id": "a", "text": "1"}, {"id": "b", "text": "2"}],
                "correct_answers": ["b"], "points": 1, "order": 1},
            {"type": "multiple", "text": "Bilangan genap", "options": [
                {"id": "a", "text": "2"}, {"id": "b", "text": "3"}, {"id": "c", "text": "4"}],
                "correct_answers": ["a", "c"], "points": 2, "order": 2},
            {"type": "truefalse", "text": "Bumi bulat", "options": [],
                "correct_answers": ["true"], "points": 1, "order": 3},
            {"type": "essay", "text": "Ibukota RI", "options": [],
                "correct_answers": ["jakarta"], "points": 2, "order": 4},
        ]:
            r = admin.post(f"{API}/admin/tryouts/{tid}/questions", json=qbody)
            assert r.status_code == 200, r.text

        r = admin.get(f"{API}/admin/tryouts/{tid}/questions")
        assert r.status_code == 200
        assert len(r.json()) == 4

        # cleanup
        admin.delete(f"{API}/admin/tryouts/{tid}")


# ---------- Admin CRUD ----------
class TestAdminCRUD:
    def test_stats(self, admin):
        r = admin.get(f"{API}/admin/stats"); assert r.status_code == 200

    def test_news_crud(self, admin):
        r = admin.post(f"{API}/admin/news", json={"title": "TEST_News", "content": "x", "category": "Info", "published": True})
        assert r.status_code == 200
        nid = r.json()["id"]
        # verify shows on public
        pub = requests.get(f"{API}/public/news").json()
        assert any(n["id"] == nid for n in pub)
        admin.delete(f"{API}/admin/news/{nid}")

    def test_calendar_create_visible_public(self, admin):
        r = admin.post(f"{API}/admin/calendar", json={"title": "TEST_Event", "date": "2026-06-01", "type": "academic"})
        assert r.status_code == 200
        eid = r.json()["id"]
        pub = requests.get(f"{API}/public/calendar").json()
        assert any(e["id"] == eid for e in pub)
        admin.delete(f"{API}/admin/calendar/{eid}")

    def test_course_create_visible_public(self, admin):
        r = admin.post(f"{API}/admin/courses", json={"title": "TEST_Course", "description": "d", "subject": "Kimia", "active": True})
        assert r.status_code == 200
        cid = r.json()["id"]
        pub = requests.get(f"{API}/public/courses").json()
        assert any(c["id"] == cid for c in pub)
        admin.delete(f"{API}/admin/courses/{cid}")

    def test_broadcast_create(self, admin):
        r = admin.post(f"{API}/admin/broadcasts", json={"title": "TEST_BC", "message": "m"})
        assert r.status_code == 200
        admin.delete(f"{API}/admin/broadcasts/{r.json()['id']}")

    def test_school_and_user_create(self, admin):
        r = admin.post(f"{API}/admin/schools", json={"name": "TEST_School", "city": "Jakarta"})
        assert r.status_code == 200
        sid = r.json()["id"]
        r = admin.post(f"{API}/admin/users", json={
            "name": "TEST User", "email": "test_new_user@example.com",
            "password": "Test@12345", "role": "student", "school_id": sid
        })
        assert r.status_code == 200
        uid = r.json()["id"]
        admin.delete(f"{API}/admin/users/{uid}")

    def test_partnership_list_and_update(self, admin):
        r = admin.get(f"{API}/admin/partnerships"); assert r.status_code == 200
        items = r.json()
        if items:
            pid = items[0]["id"]
            r = admin.put(f"{API}/admin/partnerships/{pid}?status=reviewed")
            assert r.status_code == 200


# ---------- Admin slot assignment ----------
class TestAdminSlots:
    def test_list_and_assign(self, admin):
        r = admin.get(f"{API}/admin/slots"); assert r.status_code == 200
        slots = r.json()
        open_slot_with_bids = None
        for s in slots:
            if s["status"] == "open" and s.get("bid_count", 0) > 0:
                open_slot_with_bids = s
                break
        if open_slot_with_bids:
            r = admin.get(f"{API}/admin/slots/{open_slot_with_bids['id']}/bids")
            assert r.status_code == 200
            bids = r.json()
            assert bids
            r = admin.post(f"{API}/admin/slots/{open_slot_with_bids['id']}/assign/{bids[0]['id']}")
            assert r.status_code == 200
            # verify status changed
            slots_after = admin.get(f"{API}/admin/slots").json()
            updated = next(s for s in slots_after if s["id"] == open_slot_with_bids["id"])
            assert updated["status"] == "confirmed"


# ---------- Tutor ----------
class TestTutor:
    def test_dashboard_and_open_slots(self, tutor):
        r = tutor.get(f"{API}/tutor/dashboard"); assert r.status_code == 200
        r = tutor.get(f"{API}/tutor/slots/open"); assert r.status_code == 200
        slots = r.json()
        # qualification flags present
        if slots:
            assert "qualified" in slots[0]

    def test_calendar(self, tutor):
        r = tutor.get(f"{API}/tutor/calendar"); assert r.status_code == 200

    def test_materials_crud(self, tutor):
        r = tutor.post(f"{API}/tutor/materials", json={
            "title": "TEST_Material", "description": "d", "visibility": "public"
        })
        assert r.status_code == 200
        mid = r.json()["id"]
        tutor.delete(f"{API}/tutor/materials/{mid}")


# ---------- Proctor isolation ----------
class TestProctorIsolation:
    def test_dashboard_school(self, proctor):
        r = proctor.get(f"{API}/proctor/dashboard"); assert r.status_code == 200
        d = r.json()
        assert d["school"]["name"] == "SMA Nusantara 1", d

    def test_only_school_students(self, proctor):
        r = proctor.get(f"{API}/proctor/students")
        assert r.status_code == 200
        students = r.json()
        names = [s["name"] for s in students]
        # Must include Nusantara students
        expected_names = ["Ahmad Fauzi", "Budi Santoso", "Siti Nurhaliza", "Andi Pratama", "Dewi Lestari"]
        for n in expected_names:
            assert any(n in x for x in names), f"Missing {n} in {names}"
        # Must NOT include other-school students
        for forbidden in ["Rizki", "Maya"]:
            for n in names:
                assert forbidden not in n, f"Isolation leak: {n}"

    def test_monitoring(self, proctor):
        r = proctor.get(f"{API}/proctor/monitoring"); assert r.status_code == 200

    def test_analytics(self, proctor):
        r = proctor.get(f"{API}/proctor/analytics"); assert r.status_code == 200
        data = r.json()
        assert "per_student" in data and "class_trend" in data
        # Has meaningful trend from seeded historical attempts
        assert data["class_trend"], "class_trend should have data from seeded attempts"

    def test_reports_and_csv(self, proctor):
        r = proctor.get(f"{API}/proctor/reports"); assert r.status_code == 200
        r = proctor.get(f"{API}/proctor/reports/csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "Nama Siswa" in r.text

    def test_broadcasts(self, proctor):
        r = proctor.get(f"{API}/proctor/broadcasts"); assert r.status_code == 200


# ---------- Logout ----------
class TestLogout:
    def test_logout_clears_session(self):
        s = login("student")
        r = s.post(f"{API}/auth/logout"); assert r.status_code == 200
        r = s.get(f"{API}/auth/me"); assert r.status_code == 401
