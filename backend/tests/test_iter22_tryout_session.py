"""Iteration 22: Admin-controlled Try Out session (schedule + monitor + reset/retake)."""
import os
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_PWD = os.environ.get("ADMIN_PASSWORD") or "Admin@12345"


def _login_session(email, pwd):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login_session("admin@lms.id", ADMIN_PWD)


@pytest.fixture(scope="module")
def student():
    return _login_session("siswa@lms.id", "Siswa@12345")


def _create_tryout(admin, start_at, end_at, title_suffix="iter22", published=True, duration=10):
    body = {
        "title": f"TEST_TRYOUT_{title_suffix}_{int(time.time()*1000)}",
        "description": "Iteration22 test",
        "subject": "Umum",
        "duration_minutes": duration,
        "start_at": start_at,
        "end_at": end_at,
        "published": published,
        "kind": "standalone",
        "irt_scale": "snbt",
        "price": 0,
    }
    r = admin.post(f"{BASE_URL}/api/admin/tryouts", json=body, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _add_question(admin, tryout_id, order=1):
    q = {
        "type": "single", "text": f"Q{order}",
        "options": [{"id": "o1", "text": "A"}, {"id": "o2", "text": "B"}],
        "correct_answers": ["o1"], "points": 10, "order": order, "competency": "umum",
    }
    r = admin.post(f"{BASE_URL}/api/admin/tryouts/{tryout_id}/questions", json=q, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _delete_tryout(admin, tid):
    admin.delete(f"{BASE_URL}/api/admin/tryouts/{tid}", timeout=15)


# ----- 1. Admin tryout list has schedule_status -----
class TestAdminTryoutListing:
    def test_admin_list_has_schedule_status(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/tryouts", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for t in items:
            assert "schedule_status" in t
            assert t["schedule_status"] in ("upcoming", "open", "closed")
            assert "in_progress_count" in t


# ----- 2. Student list exposes schedule_status / retake_granted -----
class TestStudentTryoutList:
    def test_student_list_exposes_schedule_fields(self, student):
        r = student.get(f"{BASE_URL}/api/student/tryouts", timeout=15)
        assert r.status_code == 200
        for t in r.json():
            assert "schedule_status" in t
            assert "retake_granted" in t


# ----- 3. Upcoming/closed enforcement -----
class TestScheduleEnforcement:
    def test_upcoming_blocks_start_and_detail(self, admin, student):
        future_start = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        future_end = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        t = _create_tryout(admin, future_start, future_end, "upcoming")
        tid = t["id"]
        try:
            _add_question(admin, tid)
            r = student.get(f"{BASE_URL}/api/student/tryouts/{tid}", timeout=15)
            assert r.status_code == 403, r.text
            r = student.post(f"{BASE_URL}/api/student/tryouts/{tid}/start", timeout=15)
            assert r.status_code == 403, r.text
        finally:
            _delete_tryout(admin, tid)

    def test_closed_blocks_start(self, admin, student):
        past_start = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
        past_end = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        t = _create_tryout(admin, past_start, past_end, "closed")
        tid = t["id"]
        try:
            _add_question(admin, tid)
            r = student.post(f"{BASE_URL}/api/student/tryouts/{tid}/start", timeout=15)
            assert r.status_code == 403, r.text
            assert "ditutup" in r.text.lower()
        finally:
            _delete_tryout(admin, tid)


# ----- 4. Autosave progress + timer from server -----
class TestAutosaveAndTimer:
    def test_start_progress_timer(self, admin, student):
        now = datetime.now(timezone.utc)
        t = _create_tryout(admin, (now - timedelta(hours=1)).isoformat(),
                           (now + timedelta(days=1)).isoformat(), "open", duration=15)
        tid = t["id"]
        try:
            q = _add_question(admin, tid)
            r = student.post(f"{BASE_URL}/api/student/tryouts/{tid}/start", timeout=15)
            assert r.status_code == 200, r.text
            att = r.json()
            assert "remaining_seconds" in att
            rem1 = att["remaining_seconds"]
            assert 0 < rem1 <= 15 * 60
            attempt_id = att["id"]

            r2 = student.put(
                f"{BASE_URL}/api/student/attempts/{attempt_id}/progress",
                json={"answers": {q["id"]: ["o1"]}}, timeout=15,
            )
            assert r2.status_code == 200, r2.text
            assert r2.json().get("saved_at")

            time.sleep(2)
            r3 = student.post(f"{BASE_URL}/api/student/tryouts/{tid}/start", timeout=15)
            assert r3.status_code == 200
            att3 = r3.json()
            assert att3["id"] == attempt_id, "should return same in-progress attempt (timer not reset)"
            assert att3["remaining_seconds"] <= rem1, "timer must not reset"
            assert att3.get("answers", {}).get(q["id"]) == ["o1"]
        finally:
            _delete_tryout(admin, tid)


# ----- 5. Admin monitor + reset/retake flow -----
class TestMonitorAndReset:
    def test_monitor_and_reset(self, admin, student):
        now = datetime.now(timezone.utc)
        t = _create_tryout(admin, (now - timedelta(hours=1)).isoformat(),
                           (now + timedelta(days=1)).isoformat(), "monitor", duration=20)
        tid = t["id"]
        try:
            q = _add_question(admin, tid)
            r = student.post(f"{BASE_URL}/api/student/tryouts/{tid}/start", timeout=15)
            assert r.status_code == 200
            attempt_id = r.json()["id"]
            student.put(f"{BASE_URL}/api/student/attempts/{attempt_id}/progress",
                        json={"answers": {q["id"]: ["o1"]}}, timeout=15)

            r = admin.get(f"{BASE_URL}/api/admin/tryouts/{tid}/monitor", timeout=15)
            assert r.status_code == 200, r.text
            data = r.json()
            assert "summary" in data and "rows" in data and "server_now" in data
            assert data["tryout"]["schedule_status"] == "open"
            row = next((x for x in data["rows"] if x["attempt_id"] == attempt_id), None)
            assert row is not None
            assert row["status"] == "in_progress"
            assert row["answered_count"] == 1
            assert row["total_questions"] == 1
            assert row["remaining_seconds"] > 0

            r = admin.post(f"{BASE_URL}/api/admin/tryouts/{tid}/attempts/{attempt_id}/reset", timeout=15)
            assert r.status_code == 200, r.text

            r_bad = student.put(f"{BASE_URL}/api/student/attempts/{attempt_id}/progress",
                                json={"answers": {q["id"]: ["o1"]}}, timeout=15)
            assert r_bad.status_code in (404, 409), f"expected 404/409 got {r_bad.status_code}"

            r = admin.get(f"{BASE_URL}/api/admin/tryouts/{tid}/monitor", timeout=15)
            rp = [x for x in r.json()["rows"] if x["status"] == "retake_pending"]
            assert len(rp) == 1

            r = student.get(f"{BASE_URL}/api/student/tryouts", timeout=15)
            tr = next((x for x in r.json() if x["id"] == tid), None)
            assert tr and tr["retake_granted"] is True
        finally:
            _delete_tryout(admin, tid)

    def test_retake_bypasses_closed_schedule(self, admin, student):
        now = datetime.now(timezone.utc)
        t = _create_tryout(admin, (now - timedelta(hours=2)).isoformat(),
                           (now + timedelta(hours=1)).isoformat(), "closedretake", duration=15)
        tid = t["id"]
        try:
            q = _add_question(admin, tid)
            r = student.post(f"{BASE_URL}/api/student/tryouts/{tid}/start", timeout=15)
            assert r.status_code == 200
            aid = r.json()["id"]
            r = admin.post(f"{BASE_URL}/api/admin/tryouts/{tid}/attempts/{aid}/reset", timeout=15)
            assert r.status_code == 200
            r = admin.put(f"{BASE_URL}/api/admin/tryouts/{tid}", json={
                "title": t["title"], "subject": "Umum", "duration_minutes": 15,
                "start_at": (now - timedelta(days=2)).isoformat(),
                "end_at": (now - timedelta(hours=1)).isoformat(),
                "published": True, "kind": "standalone", "irt_scale": "snbt", "price": 0,
            }, timeout=15)
            assert r.status_code == 200
            r = student.post(f"{BASE_URL}/api/student/tryouts/{tid}/start", timeout=15)
            assert r.status_code == 200, f"retake must bypass closed schedule: {r.text}"
            att = r.json()
            assert att["remaining_seconds"] > 10 * 60
        finally:
            _delete_tryout(admin, tid)

    def test_cancel_retake(self, admin, student):
        now = datetime.now(timezone.utc)
        t = _create_tryout(admin, (now - timedelta(hours=1)).isoformat(),
                           (now + timedelta(days=1)).isoformat(), "cancelretake")
        tid = t["id"]
        try:
            q = _add_question(admin, tid)
            r = student.post(f"{BASE_URL}/api/student/tryouts/{tid}/start", timeout=15)
            aid = r.json()["id"]
            admin.post(f"{BASE_URL}/api/admin/tryouts/{tid}/attempts/{aid}/reset", timeout=15)
            m = admin.get(f"{BASE_URL}/api/admin/tryouts/{tid}/monitor", timeout=15).json()
            sid = m["rows"][0]["student_id"]
            r = admin.delete(f"{BASE_URL}/api/admin/tryouts/{tid}/retakes/{sid}", timeout=15)
            assert r.status_code == 200
            r = student.get(f"{BASE_URL}/api/student/tryouts", timeout=15)
            tr = next((x for x in r.json() if x["id"] == tid), None)
            assert tr and tr["retake_granted"] is False
        finally:
            _delete_tryout(admin, tid)


# ----- 6. Force submit grades saved answers -----
class TestForceSubmit:
    def test_force_submit_uses_saved_answers(self, admin, student):
        now = datetime.now(timezone.utc)
        t = _create_tryout(admin, (now - timedelta(hours=1)).isoformat(),
                           (now + timedelta(days=1)).isoformat(), "forcesubmit")
        tid = t["id"]
        try:
            q = _add_question(admin, tid)
            r = student.post(f"{BASE_URL}/api/student/tryouts/{tid}/start", timeout=15)
            aid = r.json()["id"]
            student.put(f"{BASE_URL}/api/student/attempts/{aid}/progress",
                        json={"answers": {q["id"]: ["o1"]}}, timeout=15)
            r = admin.post(f"{BASE_URL}/api/admin/tryouts/{tid}/attempts/{aid}/force-submit", timeout=15)
            assert r.status_code == 200, r.text
            assert r.json()["percentage"] in (100, 100.0)
        finally:
            _delete_tryout(admin, tid)
