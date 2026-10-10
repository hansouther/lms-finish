"""Iteration 7 backend tests: public course detail, admin pending-count, profile, change-password."""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://ujian-aman-2.preview.emergentagent.com").rstrip("/")

ADMIN = ("admin@lms.id", "Admin@12345")
STUDENT = ("siswa@lms.id", "Siswa@12345")
TUTOR = ("tutor@lms.id", "Tutor@12345")
PROCTOR = ("proktor@lms.id", "Proktor@12345")


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return s


# ---------- Public Course Detail ----------
class TestPublicCourseDetail:
    def test_get_course_utbk(self):
        r = requests.get(f"{BASE}/api/public/courses/course_utbk", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["course"]["id"] == "course_utbk"
        assert "syllabus" in d and isinstance(d["syllabus"], list)
        assert d["lesson_count"] == len(d["syllabus"])
        assert d["lesson_count"] >= 2, f"expected >=2 lessons, got {d['lesson_count']}"
        assert "tutors" in d and isinstance(d["tutors"], list)

    def test_get_course_phys_has_rina(self):
        r = requests.get(f"{BASE}/api/public/courses/course_phys", timeout=15)
        assert r.status_code == 200
        d = r.json()
        names = [t["name"] for t in d.get("tutors", [])]
        assert any("Rina" in n for n in names), f"expected Rina, got {names}"

    def test_get_course_invalid_404(self):
        r = requests.get(f"{BASE}/api/public/courses/does_not_exist_xyz", timeout=15)
        assert r.status_code == 404


# ---------- Admin Pending Count ----------
class TestAdminPending:
    def test_pending_count_and_stats(self):
        s = _login(*ADMIN)
        r = s.get(f"{BASE}/api/admin/pending-count", timeout=15)
        assert r.status_code == 200
        c0 = r.json()["count"]
        r = s.get(f"{BASE}/api/admin/stats", timeout=15)
        assert r.status_code == 200
        stats = r.json()
        assert "pending_verifications" in stats
        assert stats["pending_verifications"] == c0

    def test_pending_flow_creates_and_cleans(self):
        # register a new student -> pending
        email = f"test_iter7_{int(time.time())}@example.com"
        r = requests.post(f"{BASE}/api/auth/register", json={
            "name": "TEST Iter7 Student", "email": email, "password": "TempPass@123"
        }, timeout=15)
        assert r.status_code == 200, r.text
        new_user = r.json()
        assert new_user["status"] == "pending"

        # admin sees pending count>=1 and can delete
        adm = _login(*ADMIN)
        c = adm.get(f"{BASE}/api/admin/pending-count", timeout=15).json()["count"]
        assert c >= 1
        # cleanup
        d = adm.delete(f"{BASE}/api/admin/users/{new_user['id']}", timeout=15)
        assert d.status_code == 200


# ---------- Profile Update ----------
class TestProfile:
    def test_student_profile_update(self):
        s = _login(*STUDENT)
        orig = s.get(f"{BASE}/api/auth/me", timeout=15).json()
        new_phone = "0812" + str(int(time.time()))[-7:]
        r = s.put(f"{BASE}/api/auth/profile", json={
            "name": orig["name"], "phone": new_phone,
            "grade": orig.get("grade") or "Kelas 12 IPA",
            "goal": orig.get("goal") or "PTN",
        }, timeout=15)
        assert r.status_code == 200, r.text
        upd = r.json()
        assert upd["phone"] == new_phone
        # verify persisted
        me = s.get(f"{BASE}/api/auth/me", timeout=15).json()
        assert me["phone"] == new_phone

    def test_proctor_school_name_update(self):
        s = _login(*PROCTOR)
        orig = s.get(f"{BASE}/api/auth/me", timeout=15).json()
        r = s.put(f"{BASE}/api/auth/profile", json={
            "name": orig["name"], "phone": orig.get("phone") or "081200000000",
            "school_name_text": orig.get("school_name_text") or "SMA Test",
        }, timeout=15)
        assert r.status_code == 200
        assert "school_name_text" in r.json()

    def test_admin_and_tutor_profile(self):
        for creds in (ADMIN, TUTOR):
            s = _login(*creds)
            orig = s.get(f"{BASE}/api/auth/me", timeout=15).json()
            r = s.put(f"{BASE}/api/auth/profile", json={
                "name": orig["name"], "phone": orig.get("phone") or "081211112222",
            }, timeout=15)
            assert r.status_code == 200, f"{creds[0]} -> {r.status_code} {r.text}"


# ---------- Change Password ----------
class TestChangePassword:
    def test_wrong_current_400(self):
        s = _login(*STUDENT)
        r = s.post(f"{BASE}/api/auth/change-password",
                   json={"current_password": "WrongPass!!", "new_password": "NewPass@1234"}, timeout=15)
        assert r.status_code == 400

    def test_short_password_400(self):
        s = _login(*STUDENT)
        r = s.post(f"{BASE}/api/auth/change-password",
                   json={"current_password": STUDENT[1], "new_password": "abc"}, timeout=15)
        assert r.status_code == 400

    def test_change_and_revert(self):
        s = _login(*STUDENT)
        new_pwd = "TempPwd@9876"
        r = s.post(f"{BASE}/api/auth/change-password",
                   json={"current_password": STUDENT[1], "new_password": new_pwd}, timeout=15)
        assert r.status_code == 200, r.text
        # login with new
        r2 = requests.post(f"{BASE}/api/auth/login",
                           json={"email": STUDENT[0], "password": new_pwd}, timeout=15)
        assert r2.status_code == 200
        # revert
        s2 = requests.Session()
        s2.post(f"{BASE}/api/auth/login", json={"email": STUDENT[0], "password": new_pwd}, timeout=15)
        r3 = s2.post(f"{BASE}/api/auth/change-password",
                     json={"current_password": new_pwd, "new_password": STUDENT[1]}, timeout=15)
        assert r3.status_code == 200
        # confirm demo login works again
        r4 = requests.post(f"{BASE}/api/auth/login",
                           json={"email": STUDENT[0], "password": STUDENT[1]}, timeout=15)
        assert r4.status_code == 200
