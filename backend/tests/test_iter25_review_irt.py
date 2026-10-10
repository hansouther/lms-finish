"""Iter25: Admin-controlled Pembahasan (review gating) + Nilai Asli 0-100 formatting +
IRT alignment monotonic with nilai asli (uneven points per question).

Covers:
- TryoutBuilder question.explanation + explanation_image_url persisted
- ManageTryouts show_review toggle (form + PUT /review endpoint)
- Student /api/student/attempts/{id} returns review_open flag, per_question=[]
  and no answers when closed; shows items + explanation when open
- IRT alignment: percentage 100 -> irt_scaled == scale.max,
  percentage 0 -> irt_scaled == scale.min, non-decreasing after sort by percentage
- Monotonicity preserved after admin calibrate / reset / force-submit
- Exercise kind always shows review
"""
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


# --------------------------- fixtures ---------------------------
def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin@lms.id", "Admin@12345")


STUDENT_EMAILS = ["siswa@lms.id", "budi@lms.id", "siti@lms.id", "andi@lms.id",
                  "dewi@lms.id", "rizki@lms.id", "maya@lms.id"]


@pytest.fixture(scope="module")
def students():
    return {e: _login(e, "Siswa@12345") for e in STUDENT_EMAILS}


def _create_tryout(admin, title, show_review=False, kind="standalone"):
    body = {"title": title, "subject": "Matematika",
            "duration_minutes": 30, "published": True, "kind": kind,
            "irt_scale": "snbt", "show_review": show_review,
            "tab_warning_limit": 0}
    r = admin.post(f"{API}/admin/tryouts", json=body)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _add_q(admin, tid, order, points, text, correct_id="o1",
           explanation=None, explanation_image_url=None):
    payload = {
        "type": "single", "text": text,
        "options": [{"id": "o1", "text": "benar"}, {"id": "o2", "text": "salah"}],
        "correct_answers": [correct_id], "points": points, "order": order,
        "competency": "numerasi", "difficulty_label": "sedang",
    }
    if explanation is not None:
        payload["explanation"] = explanation
    if explanation_image_url is not None:
        payload["explanation_image_url"] = explanation_image_url
    r = admin.post(f"{API}/admin/tryouts/{tid}/questions", json=payload)
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def tryout_main(admin):
    """Try Out with 3 questions points 10/20/30, review closed by default."""
    tid = _create_tryout(admin, "TEST_ITER25_MAIN", show_review=False)
    q1 = _add_q(admin, tid, 1, 10, "Q1 (10pt)", explanation="Pembahasan Q1: 1+1=2")
    q2 = _add_q(admin, tid, 2, 20, "Q2 (20pt)", explanation="Pembahasan Q2: luas = p*l")
    q3 = _add_q(admin, tid, 3, 30, "Q3 (30pt)")  # no explanation
    yield {"id": tid, "q": [q1, q2, q3]}
    admin.delete(f"{API}/admin/tryouts/{tid}")


@pytest.fixture(scope="module")
def tryout_exercise(admin):
    tid = _create_tryout(admin, "TEST_ITER25_EX", show_review=False, kind="exercise")
    _add_q(admin, tid, 1, 10, "EX Q1", explanation="EX Pembahasan")
    yield tid
    admin.delete(f"{API}/admin/tryouts/{tid}")


# ---------------- helpers ----------------
def _submit(session, tid, qids, answers_map):
    """answers_map: {qid: option_id or None}"""
    r = session.post(f"{API}/student/tryouts/{tid}/start")
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    answers = {qid: [opt] for qid, opt in answers_map.items() if opt}
    r = session.post(f"{API}/student/attempts/{aid}/submit", json={"answers": answers})
    assert r.status_code == 200, r.text
    return aid, r.json()


# ---------------- explanation persistence ----------------
def test_question_explanation_persists(admin, tryout_main):
    r = admin.get(f"{API}/admin/tryouts/{tryout_main['id']}/questions")
    assert r.status_code == 200
    qs = {q["id"]: q for q in r.json()}
    q1 = qs[tryout_main["q"][0]]
    q3 = qs[tryout_main["q"][2]]
    assert q1.get("explanation") == "Pembahasan Q1: 1+1=2"
    assert (q3.get("explanation") or "") == ""

    # Update to add explanation (via PUT)
    payload = {"type": "single", "text": "Q3 (30pt)",
               "options": q3["options"], "correct_answers": q3["correct_answers"],
               "points": 30, "order": 3, "competency": "numerasi",
               "difficulty_label": "sedang",
               "explanation": "Pembahasan Q3 baru",
               "explanation_image_url": "/uploads/dummy.png"}
    r = admin.put(f"{API}/admin/questions/{q3['id']}", json=payload)
    assert r.status_code == 200, r.text
    r = admin.get(f"{API}/admin/tryouts/{tryout_main['id']}/questions")
    q3b = {q["id"]: q for q in r.json()}[tryout_main["q"][2]]
    assert q3b.get("explanation") == "Pembahasan Q3 baru"
    assert q3b.get("explanation_image_url") == "/uploads/dummy.png"


# ---------------- show_review toggle ----------------
def test_toggle_review_endpoint(admin, tryout_main):
    tid = tryout_main["id"]
    # Fetch current
    r = admin.get(f"{API}/admin/tryouts")
    assert r.status_code == 200
    rec = next(t for t in r.json() if t["id"] == tid)
    assert rec.get("show_review") is False

    # Open review
    r = admin.put(f"{API}/admin/tryouts/{tid}/review", json={"show_review": True})
    assert r.status_code == 200
    assert r.json()["show_review"] is True

    r = admin.get(f"{API}/admin/tryouts")
    rec = next(t for t in r.json() if t["id"] == tid)
    assert rec.get("show_review") is True

    # Close again
    r = admin.put(f"{API}/admin/tryouts/{tid}/review", json={"show_review": False})
    assert r.status_code == 200 and r.json()["show_review"] is False


# ---------------- IRT alignment + review gating end-to-end ----------------
@pytest.fixture(scope="module")
def submitted_attempts(admin, tryout_main, students):
    """Have 5 students submit varying answers.
    Points: Q1=10, Q2=20, Q3=30 (total 60).
    - siti: all correct     60 -> 100%
    - budi: Q1+Q2 correct   30 -> 50%
    - andi: Q3 correct      30 -> 50%
    - dewi: Q2 correct      20 -> 33.33%
    - rizki: none correct    0 -> 0%
    """
    tid = tryout_main["id"]
    q1, q2, q3 = tryout_main["q"]
    plan = {
        "siti@lms.id":  {q1: "o1", q2: "o1", q3: "o1"},
        "budi@lms.id":  {q1: "o1", q2: "o1", q3: "o2"},
        "andi@lms.id":  {q1: "o2", q2: "o2", q3: "o1"},
        "dewi@lms.id":  {q1: "o2", q2: "o1", q3: "o2"},
        "rizki@lms.id": {q1: "o2", q2: "o2", q3: "o2"},
    }
    out = {}
    for email, ans in plan.items():
        aid, result = _submit(students[email], tid, [q1, q2, q3], ans)
        out[email] = {"attempt_id": aid, "percentage": result["percentage"],
                      "irt_scaled": result.get("irt_scaled")}
    return out


def test_percentages_from_submit(submitted_attempts):
    sa = submitted_attempts
    assert sa["siti@lms.id"]["percentage"] == pytest.approx(100.0, abs=0.01)
    assert sa["budi@lms.id"]["percentage"] == pytest.approx(50.0, abs=0.01)
    assert sa["andi@lms.id"]["percentage"] == pytest.approx(50.0, abs=0.01)
    assert sa["dewi@lms.id"]["percentage"] == pytest.approx(33.33, abs=0.01)
    assert sa["rizki@lms.id"]["percentage"] == pytest.approx(0.0, abs=0.01)


def _check_monotonic(results, scale_min=0, scale_max=1000):
    """results: list of dicts with percentage and irt_scaled."""
    # Pin: 100 -> max, 0 -> min
    for r in results:
        if r["percentage"] >= 100.0 - 1e-6:
            assert r["irt_scaled"] == scale_max, f"pct 100 must map to {scale_max}, got {r['irt_scaled']}"
        if r["percentage"] <= 1e-6:
            assert r["irt_scaled"] == scale_min, f"pct 0 must map to {scale_min}, got {r['irt_scaled']}"
    # Higher nilai asli never gets lower IRT; equal nilai may differ (response pattern)
    sorted_r = sorted(results, key=lambda r: (r["percentage"], r["irt_scaled"]))
    irts = [r["irt_scaled"] for r in sorted_r]
    for i in range(1, len(irts)):
        assert irts[i] >= irts[i-1], (
            f"IRT not monotonic: {[(r['percentage'], r['irt_scaled']) for r in sorted_r]}"
        )


def test_results_endpoint_monotonic(admin, tryout_main, submitted_attempts):
    r = admin.get(f"{API}/admin/tryouts/{tryout_main['id']}/results")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 5
    # endpoint returns percentage & irt_scaled fields
    for row in data:
        assert "percentage" in row and "irt_scaled" in row
    _check_monotonic(data)


def test_review_closed_gating(students, tryout_main, submitted_attempts):
    """When show_review=False (default), student result page hides per_question/answers."""
    aid = submitted_attempts["siti@lms.id"]["attempt_id"]
    s = students["siti@lms.id"]
    r = s.get(f"{API}/student/attempts/{aid}")
    assert r.status_code == 200
    data = r.json()
    assert data.get("review_open") is False
    assert data.get("per_question") == []
    assert "answers" not in data  # must be stripped
    # percentage still returned so student sees nilai + irt
    assert "percentage" in data
    assert "irt_scaled" in data


def test_review_open_shows_items_and_explanation(admin, students, tryout_main, submitted_attempts):
    tid = tryout_main["id"]
    # open review
    r = admin.put(f"{API}/admin/tryouts/{tid}/review", json={"show_review": True})
    assert r.status_code == 200
    aid = submitted_attempts["budi@lms.id"]["attempt_id"]
    r = students["budi@lms.id"].get(f"{API}/student/attempts/{aid}")
    assert r.status_code == 200
    data = r.json()
    assert data.get("review_open") is True
    pq = data.get("per_question") or []
    assert len(pq) == 3
    # explanation text should be surfaced on Q1 and Q2 (not Q3 default: has 'Pembahasan Q3 baru' from earlier update)
    exps = {p["question_id"]: p.get("explanation") for p in pq}
    assert exps[tryout_main["q"][0]] == "Pembahasan Q1: 1+1=2"
    assert exps[tryout_main["q"][1]] == "Pembahasan Q2: luas = p*l"
    assert exps[tryout_main["q"][2]] == "Pembahasan Q3 baru"
    # close again for later tests
    admin.put(f"{API}/admin/tryouts/{tid}/review", json={"show_review": False})


def test_calibrate_preserves_monotonic(admin, tryout_main):
    r = admin.post(f"{API}/admin/tryouts/{tryout_main['id']}/calibrate")
    assert r.status_code == 200
    r2 = admin.get(f"{API}/admin/tryouts/{tryout_main['id']}/results")
    _check_monotonic(r2.json())


def test_reset_preserves_monotonic(admin, students, tryout_main, submitted_attempts):
    """Admin reset+regrade: percentages & irt remain monotonic for remaining submitted attempts."""
    tid = tryout_main["id"]
    # Reset dewi's attempt (then she won't be present in results until re-submits; monotonic still holds)
    aid = submitted_attempts["dewi@lms.id"]["attempt_id"]
    r = admin.post(f"{API}/admin/tryouts/{tid}/attempts/{aid}/reset")
    assert r.status_code == 200
    r2 = admin.get(f"{API}/admin/tryouts/{tid}/results")
    _check_monotonic(r2.json())


def test_force_submit_preserves_monotonic(admin, students, tryout_main):
    """Have maya start but not submit, then admin force-submit; monotonic maintained."""
    tid = tryout_main["id"]
    s = students["maya@lms.id"]
    # Maya may already have no attempt. Start one.
    r = s.post(f"{API}/student/tryouts/{tid}/start")
    assert r.status_code == 200, r.text
    aid = r.json()["id"]
    # Force submit via admin (no answers → 0%)
    r = admin.post(f"{API}/admin/tryouts/{tid}/attempts/{aid}/force-submit")
    assert r.status_code == 200
    assert r.json()["percentage"] == pytest.approx(0.0, abs=0.01)
    r2 = admin.get(f"{API}/admin/tryouts/{tid}/results")
    rows = r2.json()
    _check_monotonic(rows)
    # Maya at 0% must be irt_scaled == 0
    maya = next(a for a in rows if a["id"] == aid)
    assert maya["irt_scaled"] == 0


# ---------------- Exercise kind always shows review ----------------
def test_exercise_review_always_open(admin, students, tryout_exercise):
    tid = tryout_exercise
    # fetch qid
    r = admin.get(f"{API}/admin/tryouts/{tid}/questions")
    qs = r.json()
    qid = qs[0]["id"]
    correct = qs[0]["correct_answers"][0]
    s = students["rizki@lms.id"]
    r = s.post(f"{API}/student/tryouts/{tid}/start")
    assert r.status_code == 200
    aid = r.json()["id"]
    r = s.post(f"{API}/student/attempts/{aid}/submit",
               json={"answers": {qid: [correct]}})
    assert r.status_code == 200
    # Even though show_review=False on exercise, student should get full review
    r = s.get(f"{API}/student/attempts/{aid}")
    assert r.status_code == 200
    data = r.json()
    assert data.get("review_open") is True
    assert len(data.get("per_question") or []) == 1
    assert data["per_question"][0].get("explanation") == "EX Pembahasan"
