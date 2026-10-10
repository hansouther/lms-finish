"""Seed a tryout with VERY long questions for iter31 scroll-bug testing."""
import os, requests, sys, uuid

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://cbt-tryout-1.preview.emergentagent.com").rstrip("/")

def login(session, email, password):
    r = session.post(f"{BASE}/api/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()

def main():
    s = requests.Session()
    login(s, "admin@lms.id", "Admin@12345")
    hdr = {}

    # Build long text (~3200 chars, several paragraphs)
    para = ("Perhatikan paragraf panjang berikut yang sengaja dibuat sangat panjang untuk menguji perilaku scroll pada halaman ujian. "
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam quis nibh eget mi gravida pulvinar. Pellentesque euismod turpis quis odio hendrerit, nec placerat purus tincidunt. "
            "Suspendisse potenti. Vivamus eu urna nec risus porttitor placerat. Donec ac dapibus justo, in iaculis sapien. Mauris at ante vel elit lobortis gravida. ")
    long_text = ("SOAL PANJANG UNTUK UJI SCROLL (iter31):\n\n" + (para + "\n\n") * 8 + "Berdasarkan uraian di atas, manakah pernyataan berikut yang paling tepat?")

    title = f"TEST_IT31_LONG_{uuid.uuid4().hex[:6]}"
    body = {
        "title": title,
        "description": "iter31 scroll test",
        "subject": "Tes Potensi Skolastik",
        "duration_minutes": 60,
        "published": True,
        "kind": "standalone",
        "tab_warning_limit": 0,  # skip fullscreen gate
        "price": 0,
    }
    r = s.post(f"{BASE}/api/admin/tryouts", json=body, headers=hdr)
    r.raise_for_status()
    tid = r.json()["id"]
    print("Tryout id:", tid, "title:", title)

    def opt(txt):
        return {"id": uuid.uuid4().hex[:8], "text": txt}

    questions = [
        {"type": "single", "text": long_text, "options": [
            opt("Opsi A — penjelasan singkat jawaban A"),
            opt("Opsi B — penjelasan singkat jawaban B"),
            opt("Opsi C — penjelasan singkat jawaban C"),
            opt("Opsi D — penjelasan singkat jawaban D"),
            opt("Opsi E — penjelasan singkat jawaban E"),
        ], "correct_answers": [], "points": 4, "order": 0},
        {"type": "multiple", "text": long_text, "options": [
            opt("Pernyataan 1"), opt("Pernyataan 2"), opt("Pernyataan 3"),
            opt("Pernyataan 4"), opt("Pernyataan 5"),
        ], "correct_answers": [], "points": 4, "order": 1},
        {"type": "truefalse", "text": long_text, "options": [], "correct_answers": [], "points": 2, "order": 2},
        {"type": "truefalse_multi", "text": long_text, "options": [
            opt("Klaim 1"), opt("Klaim 2"), opt("Klaim 3"), opt("Klaim 4"),
        ], "correct_answers": [], "points": 4, "order": 3},
        {"type": "essay", "text": long_text, "options": [], "correct_answers": ["jawaban"], "points": 4, "order": 4},
    ]
    for q in questions:
        q["points"] = q.get("points", 1)
        r = s.post(f"{BASE}/api/admin/tryouts/{tid}/questions", json=q, headers=hdr)
        r.raise_for_status()
    print("Added", len(questions), "questions.")
    print("DONE")
    print("TRYOUT_ID", tid)

if __name__ == "__main__":
    main()
