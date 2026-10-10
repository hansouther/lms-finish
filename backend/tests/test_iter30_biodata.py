"""Iter30: remove student admin verification; biodata-complete flow."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000").rstrip("/")
# When running inside the container, hit backend via REACT_APP_BACKEND_URL from frontend/.env


def _front_env():
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return BASE_URL


BASE = _front_env()


@pytest.fixture
def sess():
    return requests.Session()


def login(sess, email, password):
    r = sess.post(f"{BASE}/api/auth/login", json={"email": email, "password": password})
    return r


# ---------- Backend: student register -> approved + instant access ----------

def test_student_register_approved_and_student_endpoint_accessible(sess):
    email = f"test_iter30_{int(time.time()*1000)}@example.com"
    body = {
        "name": "TEST Iter30",
        "email": email,
        "password": "Secret#12345",
        "phone": "0812",
        "school_id": "school_nusantara",
        "grade": "12 IPA",
        "goal": "UTBK",
    }
    r = sess.post(f"{BASE}/api/auth/register", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "approved"
    assert data["role"] == "student"

    # instant access to student endpoint - should NOT 403
    r2 = sess.get(f"{BASE}/api/student/tryouts")
    assert r2.status_code == 200, r2.text


# ---------- Backend: proctor/tutor register still pending ----------

def test_proctor_register_still_pending(sess):
    email = f"test_iter30_prok_{int(time.time()*1000)}@example.com"
    r = sess.post(f"{BASE}/api/auth/register/proctor", json={
        "name": "TEST Prok", "email": email, "password": "Secret#12345",
        "phone": "0812", "school_name": "SMA TEST",
    })
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending"


def test_tutor_register_still_pending(sess):
    email = f"test_iter30_tutor_{int(time.time()*1000)}@example.com"
    r = sess.post(f"{BASE}/api/auth/register/tutor", json={
        "name": "TEST Tutor", "email": email, "password": "Secret#12345", "phone": "0812",
    })
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending"


# ---------- Backend: existing seeded students are approved (migration) ----------

def test_seeded_students_approved(sess):
    r = login(sess, "siswa@lms.id", "Siswa@12345")
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    # Can hit student API even without grade (biodata guard is only client side)
    r2 = sess.get(f"{BASE}/api/student/tryouts")
    assert r2.status_code == 200


# ---------- Backend: PUT /auth/profile saves school_id + grade ----------

def test_profile_update_saves_school_grade(sess):
    assert login(sess, "siswa@lms.id", "Siswa@12345").status_code == 200
    r = sess.put(f"{BASE}/api/auth/profile", json={
        "school_id": "school_nusantara", "grade": "12 IPA TEST", "phone": "0812", "goal": "x",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["grade"] == "12 IPA TEST"
    # Verify persistence via /auth/me
    r2 = sess.get(f"{BASE}/api/auth/me")
    assert r2.status_code == 200
    assert r2.json()["grade"] == "12 IPA TEST"


# ---------- Regression: admin, tutor, proctor login ----------

@pytest.mark.parametrize("email,password,role", [
    ("admin@lms.id", "Admin@12345", "admin"),
    ("tutor@lms.id", "Tutor@12345", "tutor"),
    ("proktor@lms.id", "Proktor@12345", "proctor"),
])
def test_regression_logins(email, password, role):
    s = requests.Session()
    r = login(s, email, password)
    assert r.status_code == 200, r.text
    assert r.json()["role"] == role
