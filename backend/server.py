import os
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from database import db, client
from seed import seed, seed_content, migrate_analysis
import routes_auth, routes_public, routes_admin, routes_student, routes_tutor, routes_proctor, routes_files, routes_classes, routes_payments

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="LMS RBAC Platform")

# Konfigurasi CORS ditempatkan di sini agar aktif sebelum rute dan middleware lain diproses
default_origins = [
    "http://localhost:3000",
    "https://lms-binara-production.up.railway.app",
    "https://binaralms.com",
    "https://www.binaralms.com",
]
env_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
allowed_origins = env_origins if env_origins else default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_folder = os.path.join(ROOT_DIR, "uploads")
os.makedirs(upload_folder, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_folder), name="uploads")

app.include_router(routes_auth.router)
app.include_router(routes_public.router)
app.include_router(routes_admin.router)
app.include_router(routes_student.router)
app.include_router(routes_tutor.router)
app.include_router(routes_proctor.router)
app.include_router(routes_files.router)
app.include_router(routes_classes.router)
app.include_router(routes_payments.router)

@app.get("/api/")
async def root():
    return {"message": "LMS RBAC API aktif"}

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("id", unique=True)
    await db.attempts.create_index([("student_id", 1), ("tryout_id", 1)])
    await db.questions.create_index("tryout_id")
    await db.login_attempts.create_index("identifier")
    await db.favorites.create_index([("tutor_id", 1), ("student_id", 1), ("course_id", 1)], unique=True)
    await db.lessons.create_index("course_id")
    await db.lesson_progress.create_index([("student_id", 1), ("lesson_id", 1)], unique=True)
    await db.payments.create_index("order_id", unique=True)
    await db.payments.create_index([("student_id", 1), ("item_type", 1), ("item_id", 1)])
    await db.tryout_access.create_index([("student_id", 1), ("tryout_id", 1)], unique=True)
    await seed(os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"])
    await seed_content()
    await migrate_analysis()
    from routes_admin import backfill_question_bidang
    await backfill_question_bidang()
    await db.users.update_many({"status": {"$exists": False}}, {"$set": {"status": "approved"}})
    
    legacy = await db.teaching_slots.find({"sessions": {"$exists": False}, "date": {"$exists": True}}, {"_id": 0}).to_list(500)
    for sl in legacy:
        await db.teaching_slots.update_one({"id": sl["id"]}, {"$set": {"sessions": [{
            "id": f"{sl['id']}__s1", "no": 1, "date": sl.get("date"),
            "start_time": sl.get("start_time"), "end_time": sl.get("end_time"), "topic": sl.get("notes"),
        }]}})
    logger.info("Startup complete: indexes ensured and seed executed.")

@app.on_event("shutdown")
async def shutdown():
    client.close()