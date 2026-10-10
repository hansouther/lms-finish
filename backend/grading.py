"""Auto-grading logic for the CBT / Try Out engine.

Question types:
- single      : one correct option (pilihan ganda)
- multiple    : several correct options (pilihan ganda kompleks) -> exact set match
- truefalse   : benar / salah
- truefalse_multi : satu stimulus + beberapa pernyataan benar/salah; nilai proporsional
- essay        : free text, case-insensitive & trimmed match against accepted answers
"""


def strip_answers(q: dict) -> dict:
    """Return a student-safe version of a question (no correct answers)."""
    return {
        "id": q["id"],
        "type": q["type"],
        "text": q["text"],
        "image_url": q.get("image_url"),
        "options": q.get("options", []),
        "tf_labels": q.get("tf_labels"),
        "points": q.get("points", 1),
        "order": q.get("order", 0),
    }


def grade_question(q: dict, ans) -> int:
    t = q["type"]
    correct = q.get("correct_answers", []) or []
    points = int(q.get("points", 1))
    ans = ans or []
    if isinstance(ans, str):
        ans = [ans]

    if t == "truefalse_multi":
        key = {c.split(":", 1)[0]: c.split(":", 1)[1] for c in correct if ":" in c}
        if not key:
            return 0
        given = {a.split(":", 1)[0]: a.split(":", 1)[1] for a in ans if isinstance(a, str) and ":" in a}
        hits = sum(1 for sid, v in key.items() if given.get(sid) == v)
        return round(points * hits / len(key))

    ok = False
    if t == "single":
        ok = len(ans) == 1 and ans[0] in correct
    elif t == "multiple":
        ok = len(ans) > 0 and set(ans) == set(correct)
    elif t == "truefalse":
        ok = len(ans) == 1 and ans[0].strip().lower() in [c.strip().lower() for c in correct]
    elif t == "essay":
        norm = [a.strip().lower() for a in ans if a is not None]
        accepted = [c.strip().lower() for c in correct]
        ok = len(norm) == 1 and norm[0] in accepted

    return points if ok else 0


def grade_attempt(questions: list, answers: dict) -> dict:
    """answers: {question_id: [values]}. Returns score summary + per-question results."""
    per_question = []
    score = 0
    max_score = 0
    for q in questions:
        pts = int(q.get("points", 1))
        max_score += pts
        student_ans = answers.get(q["id"], [])
        earned = grade_question(q, student_ans)
        score += earned
        per_question.append({
            "question_id": q["id"],
            "type": q["type"],
            "student_answer": student_ans,
            "correct_answers": q.get("correct_answers", []),
            "points": pts,
            "earned": earned,
            "correct": earned == pts and pts > 0,
        })
    percentage = round((score / max_score) * 100, 2) if max_score else 0.0
    return {
        "score": score,
        "max_score": max_score,
        "percentage": percentage,
        "per_question": per_question,
    }
