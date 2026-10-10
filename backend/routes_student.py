from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, List
import random

from database import db
from utils import new_id, now_iso, class_sessions
from security import require_roles
from grading import strip_answers, grade_attempt
import analysis
import irt
from tryout_session import schedule_status, remaining_seconds, answered_count

router = APIRouter(prefix="/api/student", tags=["student"])
student_only = require_roles("student")


@router.get("/recommendations")
async def recommendations(user: dict = Depends(student_only)):
    """Rekomendasi latihan/materi otomatis untuk area terlemah siswa (dari hasil analisis)."""
    rep = await analysis.build_report([user["id"]])
    if not rep["recap"]:
        return {"has_data": False, "recommendations": None}
    r = rep["recap"][0]
    return {
        "has_data": True,
        "avg": r["avg_percentage"],
        "weakest_subject": r["weakest_subject"],
        "weakest_competency": r["weakest_competency"],
        "numerasi_pct": r["numerasi_pct"],
        "literasi_pct": r["literasi_pct"],
        "recommendations": r["recommendations"],
    }


class SubmitBody(BaseModel):
    answers: Dict[str, List[str]]


class LessonCompleteBody(BaseModel):
    completed: bool = True


BADGES = [
    {"code": "video_master", "label": "Ahli Video", "desc": "Menyelesaikan semua video pembelajaran"},
    {"code": "exercise_champion", "label": "Juara Latihan", "desc": "Menuntaskan semua latihan bernilai"},
    {"code": "perfect_score", "label": "Nilai Sempurna", "desc": "Meraih 100% pada sebuah latihan"},
    {"code": "course_complete", "label": "Kelas Tuntas", "desc": "Semua video & latihan selesai"},
]


async def _enrolled_course_ids(student_id: str):
    rows = await db.enrollments.find({"student_id": student_id}, {"_id": 0}).to_list(200)
    return [r["course_id"] for r in rows]


@router.get("/notifications")
async def notifications_list(user: dict = Depends(student_only)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": items, "unread": unread}


@router.post("/notifications/read")
async def notifications_read(user: dict = Depends(student_only)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


async def _course_bundle(student_id: str, course_id: str):
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        return None
    lessons = await db.lessons.find({"course_id": course_id}, {"_id": 0}).sort("order", 1).to_list(200)
    prog = await db.lesson_progress.find(
        {"student_id": student_id, "course_id": course_id, "completed": True}, {"_id": 0}
    ).to_list(500)
    completed_ids = {p["lesson_id"] for p in prog}
    for l in lessons:
        l["completed"] = l["id"] in completed_ids

    exercises = await db.tryouts.find(
        {"course_id": course_id, "kind": "exercise", "published": True}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    ex_ids = [ex["id"] for ex in exercises]

    # Batch: question counts for all exercises in one aggregation
    qc_map = {}
    if ex_ids:
        async for row in db.questions.aggregate([
            {"$match": {"tryout_id": {"$in": ex_ids}}},
            {"$group": {"_id": "$tryout_id", "count": {"$sum": 1}}},
        ]):
            qc_map[row["_id"]] = row["count"]

    # Batch: all submitted attempts for this student across those exercises in one query
    att_map = {}
    if ex_ids:
        all_atts = await db.attempts.find(
            {"student_id": student_id, "tryout_id": {"$in": ex_ids}, "status": "submitted"},
            {"_id": 0, "per_question": 0},
        ).to_list(2000)
        for a in all_atts:
            att_map.setdefault(a["tryout_id"], []).append(a)

    ex_out = []
    for ex in exercises:
        qc = qc_map.get(ex["id"], 0)
        if qc == 0:
            continue
        ex["question_count"] = qc
        atts = att_map.get(ex["id"], [])
        if atts:
            best = max(atts, key=lambda a: a.get("percentage", 0))
            ex.update({"attempt_status": "submitted", "attempts_count": len(atts),
                       "best_attempt_id": best["id"], "my_percentage": best.get("percentage"),
                       "my_score": best.get("score"), "my_max": best.get("max_score")})
        else:
            ex.update({"attempt_status": None, "attempts_count": 0, "best_attempt_id": None,
                       "my_percentage": None, "my_score": None, "my_max": None})
        ex_out.append(ex)

    taken = [e for e in ex_out if e["attempt_status"] == "submitted"]
    total_points = sum(e["my_score"] or 0 for e in taken)
    average = round(sum(e["my_percentage"] for e in taken) / len(taken), 1) if taken else 0
    lessons_total = len(lessons)
    lessons_completed = sum(1 for l in lessons if l["completed"])
    progress = {
        "lessons_completed": lessons_completed, "lessons_total": lessons_total,
        "percent": round(lessons_completed / lessons_total * 100) if lessons_total else 0,
    }
    grade = {"total_points": total_points, "average": average, "taken": len(taken), "total": len(ex_out)}

    video_master = lessons_total > 0 and lessons_completed == lessons_total
    exercise_champion = len(ex_out) > 0 and len(taken) == len(ex_out)
    perfect = any((e["my_percentage"] or 0) >= 100 for e in taken)
    course_complete = video_master and exercise_champion
    earned = {"video_master": video_master, "exercise_champion": exercise_champion,
              "perfect_score": perfect, "course_complete": course_complete}
    achievements = [{**b, "earned": earned.get(b["code"], False)} for b in BADGES]
    return {"course": course, "lessons": lessons, "exercises": ex_out,
            "grade": grade, "progress": progress, "achievements": achievements}


@router.get("/dashboard")
async def dashboard(user: dict = Depends(student_only)):
    sid = user["id"]
    enrollments = await db.enrollments.count_documents({"student_id": sid})
    attempts = await db.attempts.find({"student_id": sid, "status": "submitted"}, {"_id": 0}).to_list(200)
    avg = round(sum(a["percentage"] for a in attempts) / len(attempts), 1) if attempts else 0
    available_to = await db.tryouts.count_documents({"published": True, "kind": {"$ne": "exercise"}})
    materials = await db.materials.count_documents({"visibility": "public"})
    recent = sorted(attempts, key=lambda a: a.get("submitted_at", ""), reverse=True)[:5]
    badges = []
    for cid in await _enrolled_course_ids(sid):
        bundle = await _course_bundle(sid, cid)
        if not bundle:
            continue
        for a in bundle["achievements"]:
            if a["earned"]:
                badges.append({"course_title": bundle["course"]["title"], "code": a["code"], "label": a["label"]})
    return {
        "enrollments": enrollments,
        "completed_tryouts": len(attempts),
        "avg_score": avg,
        "available_tryouts": available_to,
        "public_materials": materials,
        "recent_attempts": recent,
        "badges": badges,
    }


@router.get("/courses")
async def courses(user: dict = Depends(student_only)):
    items = await db.courses.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    enrolled = set(await _enrolled_course_ids(user["id"]))
    for c in items:
        c["enrolled"] = c["id"] in enrolled
    return items


@router.post("/courses/{course_id}/enroll")
async def enroll(course_id: str, user: dict = Depends(student_only)):
    course = await db.courses.find_one({"id": course_id, "active": True}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Kursus tidak ditemukan")
    exists = await db.enrollments.find_one({"course_id": course_id, "student_id": user["id"]})
    if exists:
        raise HTTPException(status_code=400, detail="Anda sudah terdaftar di kursus ini")
    if int(course.get("price") or 0) > 0:
        raise HTTPException(status_code=402, detail="Kursus ini berbayar. Selesaikan pembayaran untuk mendaftar.")
    await db.enrollments.insert_one({
        "id": new_id(),
        "course_id": course_id,
        "student_id": user["id"],
        "status": "active",
        "enrolled_at": now_iso(),
    })
    return {"ok": True}


@router.get("/enrollments")
async def my_enrollments(user: dict = Depends(student_only)):
    rows = await db.enrollments.find({"student_id": user["id"]}, {"_id": 0}).to_list(200)
    course_ids = [r["course_id"] for r in rows]
    courses = await db.courses.find({"id": {"$in": course_ids}}, {"_id": 0}).to_list(200)
    cmap = {c["id"]: c for c in courses}
    for r in rows:
        r["course"] = cmap.get(r["course_id"])
    return rows


@router.get("/courses/{course_id}/learn")
async def course_learn(course_id: str, user: dict = Depends(student_only)):
    if not await db.enrollments.find_one({"course_id": course_id, "student_id": user["id"]}):
        raise HTTPException(status_code=403, detail="Anda belum terdaftar di kursus ini")
    bundle = await _course_bundle(user["id"], course_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Kursus tidak ditemukan")
    return bundle


@router.post("/lessons/{lesson_id}/complete")
async def complete_lesson(lesson_id: str, body: LessonCompleteBody, user: dict = Depends(student_only)):
    lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Pelajaran tidak ditemukan")
    if not await db.enrollments.find_one({"course_id": lesson["course_id"], "student_id": user["id"]}):
        raise HTTPException(status_code=403, detail="Anda belum terdaftar di kursus ini")
    await db.lesson_progress.update_one(
        {"student_id": user["id"], "lesson_id": lesson_id},
        {"$set": {
            "id": new_id(), "student_id": user["id"], "course_id": lesson["course_id"],
            "lesson_id": lesson_id, "completed": body.completed, "completed_at": now_iso(),
        }},
        upsert=True,
    )
    return {"ok": True, "completed": body.completed}


@router.get("/materials")
async def materials(user: dict = Depends(student_only)):
    course_ids = await _enrolled_course_ids(user["id"])
    query = {"$or": [{"visibility": "public"}, {"visibility": "private", "course_id": {"$in": course_ids}}]}
    items = await db.materials.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    tutor_ids = list({m["tutor_id"] for m in items if m.get("tutor_id")})
    tutors = await db.users.find({"id": {"$in": tutor_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    tmap = {t["id"]: t["name"] for t in tutors}
    for m in items:
        m["tutor_name"] = tmap.get(m.get("tutor_id"), "Tim Akademik")
    return items


@router.get("/schedule")
async def schedule(user: dict = Depends(student_only)):
    course_ids = await _enrolled_course_ids(user["id"])
    slots = await db.teaching_slots.find(
        {"status": "confirmed", "$or": [{"course_id": {"$in": course_ids}}, {"open_to_all": True}]},
        {"_id": 0},
    ).sort("date", 1).to_list(200)
    tutor_ids = list({s["tutor_id"] for s in slots if s.get("tutor_id")})
    tutors = await db.users.find({"id": {"$in": tutor_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    tmap = {t["id"]: t["name"] for t in tutors}
    for s in slots:
        s["tutor_name"] = tmap.get(s.get("tutor_id"), "-")
        s["sessions"] = class_sessions(s)
        s["material_count"] = await db.class_materials.count_documents({"slot_id": s["id"]})
    return slots


@router.get("/classes/{slot_id}")
async def student_class_detail(slot_id: str, user: dict = Depends(student_only)):
    slot = await db.teaching_slots.find_one({"id": slot_id, "status": "confirmed"}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Kelas tidak ditemukan")
    course_ids = await _enrolled_course_ids(user["id"])
    if not (slot.get("open_to_all") or slot.get("course_id") in course_ids):
        raise HTTPException(status_code=403, detail="Anda tidak terdaftar pada kelas ini")
    slot["sessions"] = class_sessions(slot)
    materials = await db.class_materials.find({"slot_id": slot_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    att = await db.attendance.find({"slot_id": slot_id, "student_id": user["id"]}, {"_id": 0}).to_list(200)
    my_attendance = {a["session_id"]: a["status"] for a in att if a.get("session_id")}
    tutor = await db.users.find_one({"id": slot.get("tutor_id")}, {"_id": 0, "name": 1})
    slot["tutor_name"] = tutor["name"] if tutor else "-"
    return {"slot": slot, "materials": materials, "my_attendance": my_attendance}


@router.get("/tryouts")
async def tryouts(user: dict = Depends(student_only)):
    items = await db.tryouts.find({"published": True, "kind": {"$ne": "exercise"}}, {"_id": 0}).sort("start_at", -1).to_list(100)
    my_attempts = await db.attempts.find({"student_id": user["id"]}, {"_id": 0, "per_question": 0}).to_list(200)
    amap = {a["tryout_id"]: a for a in my_attempts}
    access = {r["tryout_id"] for r in await db.tryout_access.find({"student_id": user["id"]}, {"_id": 0, "tryout_id": 1}).to_list(500)}
    grants = {r["tryout_id"] for r in await db.tryout_retakes.find({"student_id": user["id"], "used": False}, {"_id": 0, "tryout_id": 1}).to_list(500)}
    tids = [t["id"] for t in items]
    qc_map = {}
    if tids:
        async for row in db.questions.aggregate([
            {"$match": {"tryout_id": {"$in": tids}}},
            {"$group": {"_id": "$tryout_id", "count": {"$sum": 1}}},
        ]):
            qc_map[row["_id"]] = row["count"]
    for t in items:
        t["question_count"] = qc_map.get(t["id"], 0)
        att = amap.get(t["id"])
        t["attempt_status"] = att["status"] if att else None
        t["attempt_id"] = att["id"] if att else None
        t["my_percentage"] = att.get("percentage") if att and att["status"] == "submitted" else None
        t["price"] = int(t.get("price") or 0)
        t["has_access"] = t["price"] <= 0 or t["id"] in access or att is not None
        t["schedule_status"] = schedule_status(t)
        t["retake_granted"] = t["id"] in grants
    return items


@router.get("/tryouts/{tryout_id}")
async def tryout_detail(tryout_id: str, user: dict = Depends(student_only)):
    t = await db.tryouts.find_one({"id": tryout_id, "published": True}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Try Out tidak ditemukan")
    if int(t.get("price") or 0) > 0 and t.get("kind") != "exercise":
        has_attempt = await db.attempts.find_one({"tryout_id": tryout_id, "student_id": user["id"]})
        has_access = await db.tryout_access.find_one({"tryout_id": tryout_id, "student_id": user["id"]})
        if not has_attempt and not has_access:
            raise HTTPException(status_code=402, detail="Try Out ini berbayar. Selesaikan pembayaran untuk mengerjakan.")
    if t.get("kind") != "exercise" and schedule_status(t) == "upcoming":
        if not await db.attempts.find_one({"tryout_id": tryout_id, "student_id": user["id"]}) and \
                not await db.tryout_retakes.find_one({"tryout_id": tryout_id, "student_id": user["id"], "used": False}):
            raise HTTPException(status_code=403, detail="Try Out belum dibuka. Silakan kembali sesuai jadwal.")
    questions = await db.questions.find({"tryout_id": tryout_id}, {"_id": 0}).sort("order", 1).to_list(200)
    if t.get("kind") == "exercise":
        random.shuffle(questions)
        for q in questions:
            if q.get("options") and q.get("type") != "truefalse_multi":
                random.shuffle(q["options"])
    t["questions"] = [strip_answers(q) for q in questions]
    return t


@router.post("/tryouts/{tryout_id}/start")
async def start_attempt(tryout_id: str, user: dict = Depends(student_only)):
    t = await db.tryouts.find_one({"id": tryout_id, "published": True}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Try Out tidak ditemukan")
    is_exercise = t.get("kind") == "exercise"
    in_progress = await db.attempts.find_one(
        {"tryout_id": tryout_id, "student_id": user["id"], "status": "in_progress"}, {"_id": 0}
    )
    if in_progress:
        return {**in_progress, "remaining_seconds": remaining_seconds(in_progress, t)}
    grant = None
    if not is_exercise:
        grant = await db.tryout_retakes.find_one({"tryout_id": tryout_id, "student_id": user["id"], "used": False}, {"_id": 0})
        state = schedule_status(t)
        if not grant and state == "upcoming":
            raise HTTPException(status_code=403, detail="Try Out belum dibuka. Silakan kembali sesuai jadwal.")
        if not grant and state == "closed":
            raise HTTPException(status_code=403, detail="Try Out sudah ditutup.")
        submitted = await db.attempts.find_one(
            {"tryout_id": tryout_id, "student_id": user["id"], "status": "submitted"}, {"_id": 0}
        )
        if submitted:
            raise HTTPException(status_code=400, detail="Anda sudah menyelesaikan Try Out ini")
        if int(t.get("price") or 0) > 0 and not await db.tryout_access.find_one(
                {"tryout_id": tryout_id, "student_id": user["id"]}):
            raise HTTPException(status_code=402, detail="Try Out ini berbayar. Selesaikan pembayaran untuk mengerjakan.")
    attempt = {
        "id": new_id(),
        "tryout_id": tryout_id,
        "student_id": user["id"],
        "status": "in_progress",
        "answers": {},
        "score": 0,
        "max_score": 0,
        "percentage": 0,
        "per_question": [],
        "started_at": now_iso(),
        "submitted_at": None,
        "duration_minutes": t.get("duration_minutes", 60),
        "bypass_schedule": bool(grant),
        "answered_count": 0,
        "last_saved_at": None,
    }
    await db.attempts.insert_one(attempt)
    if grant:
        await db.tryout_retakes.update_one({"id": grant["id"]}, {"$set": {"used": True, "used_at": now_iso()}})
    out = {k: v for k, v in attempt.items() if k != "_id"}
    return {**out, "remaining_seconds": remaining_seconds(attempt, t)}


class ProgressBody(BaseModel):
    answers: Dict[str, List[str]]


@router.put("/attempts/{attempt_id}/progress")
async def save_progress(attempt_id: str, body: ProgressBody, user: dict = Depends(student_only)):
    attempt = await db.attempts.find_one({"id": attempt_id, "student_id": user["id"]}, {"_id": 0, "status": 1})
    if not attempt:
        raise HTTPException(status_code=404, detail="Percobaan tidak ditemukan")
    if attempt["status"] != "in_progress":
        raise HTTPException(status_code=409, detail="Percobaan sudah dikumpulkan atau direset admin")
    saved_at = now_iso()
    await db.attempts.update_one({"id": attempt_id}, {"$set": {
        "answers": body.answers, "answered_count": answered_count(body.answers), "last_saved_at": saved_at}})
    return {"ok": True, "saved_at": saved_at}


async def _recalibrate_tryout(tryout_id: str):
    """Kalibrasi ulang parameter IRT butir dari seluruh attempt tersubmit (auto)."""
    questions = await db.questions.find({"tryout_id": tryout_id}, {"_id": 0}).to_list(1000)
    attempts = await db.attempts.find(
        {"tryout_id": tryout_id, "status": "submitted"}, {"_id": 0}
    ).to_list(10000)
    params = irt.calibrate(questions, attempts)
    for qid, p in params.items():
        await db.questions.update_one({"id": qid}, {"$set": p})


@router.post("/attempts/{attempt_id}/submit")
async def submit_attempt(attempt_id: str, body: SubmitBody, background: BackgroundTasks, user: dict = Depends(student_only)):
    attempt = await db.attempts.find_one({"id": attempt_id, "student_id": user["id"]}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Percobaan tidak ditemukan")
    if attempt["status"] == "submitted":
        raise HTTPException(status_code=400, detail="Percobaan sudah dikumpulkan")
    questions = await db.questions.find({"tryout_id": attempt["tryout_id"]}, {"_id": 0}).to_list(200)
    tryout = await db.tryouts.find_one({"id": attempt["tryout_id"]}, {"_id": 0})
    result = grade_attempt(questions, body.answers)
    irt_score = irt.score_attempt(questions, result.get("per_question"), irt.resolve_scale(tryout))
    await db.attempts.update_one(
        {"id": attempt_id},
        {"$set": {
            "answers": body.answers,
            "status": "submitted",
            "submitted_at": now_iso(),
            **result,
            **irt_score,
        }},
    )
    # Kalibrasi ulang parameter IRT secara otomatis dari data jawaban terbaru
    background.add_task(_recalibrate_tryout, attempt["tryout_id"])
    return {"ok": True, "score": result["score"], "max_score": result["max_score"],
            "percentage": result["percentage"], **irt_score}


@router.get("/attempts")
async def my_attempts(user: dict = Depends(student_only)):
    rows = await db.attempts.find({"student_id": user["id"], "status": "submitted"}, {"_id": 0, "per_question": 0}).to_list(200)
    tids = list({r["tryout_id"] for r in rows})
    tos = await db.tryouts.find({"id": {"$in": tids}}, {"_id": 0}).to_list(200)
    tmap = {t["id"]: t for t in tos}
    for r in rows:
        r["tryout"] = tmap.get(r["tryout_id"])
    return sorted(rows, key=lambda r: r.get("submitted_at", ""), reverse=True)


@router.get("/attempts/{attempt_id}")
async def attempt_detail(attempt_id: str, user: dict = Depends(student_only)):
    attempt = await db.attempts.find_one({"id": attempt_id, "student_id": user["id"]}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Hasil tidak ditemukan")
    t = await db.tryouts.find_one({"id": attempt["tryout_id"]}, {"_id": 0})
    questions = await db.questions.find({"tryout_id": attempt["tryout_id"]}, {"_id": 0}).sort("order", 1).to_list(200)
    qmap = {q["id"]: q for q in questions}
    for pq in attempt.get("per_question", []):
        q = qmap.get(pq["question_id"])
        if q:
            pq["text"] = q["text"]
            pq["image_url"] = q.get("image_url")
            pq["options"] = q.get("options", [])
            pq["tf_labels"] = q.get("tf_labels")
    attempt["tryout"] = t
    return attempt
