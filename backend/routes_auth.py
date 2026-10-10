import os
import uuid
import asyncio
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from pydantic import BaseModel, EmailStr

from database import db
from utils import new_id, now_iso
from security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, get_current_user, get_jwt_secret,
)
from storage import put_object, MIME_TYPES, APP_NAME
import jwt

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
MAX_ATTEMPTS = 5
LOCK_MINUTES = 15


class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None
    school_id: str | None = None
    grade: str | None = None
    goal: str | None = None


class RegisterProctorBody(BaseModel):
    name: str          # nama PIC / penanggung jawab
    email: EmailStr
    password: str
    phone: str | None = None
    school_name: str   # nama sekolah (teks bebas, ditautkan admin saat verifikasi)


class RegisterTutorBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str | None = None


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleBody(BaseModel):
    token: str


def _public_user(user: dict) -> dict:
    user.pop("password_hash", None)
    return user


async def _issue_session(user: dict, response: Response):
    access = create_access_token(user["id"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"access_token": access, "refresh_token": refresh}


@router.post("/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "student",
        "status": "approved",
        "phone": body.phone,
        "school_id": body.school_id,
        "grade": body.grade,
        "goal": body.goal,
        "picture": None,
        "auth_provider": "password",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    tokens = await _issue_session(user, response)
    return {**_public_user({k: v for k, v in user.items() if k != "_id"}), **tokens}


@router.post("/register/proctor")
async def register_proctor(body: RegisterProctorBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "proctor",
        "status": "pending",
        "phone": body.phone,
        "school_id": None,
        "school_name_text": body.school_name,
        "picture": None,
        "auth_provider": "password",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    tokens = await _issue_session(user, response)
    return {**_public_user({k: v for k, v in user.items() if k != "_id"}), **tokens}


@router.post("/register/tutor")
async def register_tutor(body: RegisterTutorBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "tutor",
        "status": "pending",
        "phone": body.phone,
        "school_id": None,
        "qualifications": [],
        "cv_url": None, "cv_name": None, "certificates": [],
        "picture": None,
        "auth_provider": "password",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    tokens = await _issue_session(user, response)
    return {**_public_user({k: v for k, v in user.items() if k != "_id"}), **tokens}


@router.post("/become-tutor")
async def become_tutor(user: dict = Depends(get_current_user)):
    if user["role"] not in ("student", "tutor"):
        raise HTTPException(status_code=400, detail="Peran akun tidak dapat diubah menjadi tentor")
    await db.users.update_one({"id": user["id"]}, {"$set": {"role": "tutor", "status": "pending"}})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated


@router.post("/upload-doc")
async def upload_doc(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    allowed = {"pdf", "png", "jpg", "jpeg"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Format tidak didukung. Gunakan PDF, PNG, atau JPEG.")
    data = await file.read()
    if ext in {"png", "jpg", "jpeg"} and len(data) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran gambar maksimal 2 MB.")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran berkas maksimal 10 MB.")
    file_id = uuid.uuid4().hex
    path = f"{APP_NAME}/docs/{user['id']}/{file_id}.{ext}"
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    try:
        result = await asyncio.to_thread(put_object, path, data, content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal mengunggah berkas: {e}")
    await db.files.insert_one({
        "id": file_id, "storage_path": result["path"], "original_filename": file.filename,
        "content_type": content_type, "size": result.get("size", len(data)),
        "uploaded_by": user["id"], "is_deleted": False, "created_at": now_iso(),
    })
    return {"url": f"/api/files/{result['path']}", "name": file.filename, "type": content_type, "size": result.get("size", len(data))}


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi nanti.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        new_count = (attempt.get("count", 0) if attempt else 0) + 1
        locked_until = (datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)).isoformat() if new_count >= MAX_ATTEMPTS else None
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$set": {"identifier": identifier, "count": new_count, "locked_until": locked_until}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")

    await db.login_attempts.delete_one({"identifier": identifier})
    tokens = await _issue_session(user, response)
    return {**_public_user({k: v for k, v in user.items() if k != "_id"}), **tokens}


@router.post("/google/session")
async def google_session(body: GoogleBody, response: Response):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Konfigurasi Google Client ID tidak ditemukan")
        
    try:
        # Memverifikasi token langsung ke server Google secara mandiri
        idinfo = id_token.verify_oauth2_token(
            body.token, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Token Google tidak valid atau kedaluwarsa")
        
    # Mengambil data dari payload Google
    email = idinfo["email"].lower()
    name = idinfo.get("name")
    picture = idinfo.get("picture")
    
    # Logika database LMS Anda tetap sama
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "id": new_id(),
            "email": email,
            "password_hash": None,
            "name": name or email.split("@")[0],
            "role": "student",
            "status": "approved",
            "phone": None,
            "school_id": None,
            "grade": None,
            "goal": None,
            "picture": picture,
            "auth_provider": "google",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    else:
        if picture and not user.get("picture"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"picture": picture}})
            user["picture"] = picture
            
    tokens = await _issue_session(user, response)
    return {**_public_user({k: v for k, v in user.items() if k != "_id"}), **tokens}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token") or request.headers.get("X-Refresh-Token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak ada refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Refresh token tidak valid")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Tipe token salah")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
    access = create_access_token(user["id"], user["role"])
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=86400, path="/")
    return {"ok": True, "access_token": access}


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


class ProfileBody(BaseModel):
    name: str | None = None
    phone: str | None = None
    grade: str | None = None
    goal: str | None = None
    school_id: str | None = None
    school_name_text: str | None = None
    cv_url: str | None = None
    cv_name: str | None = None
    certificates: list | None = None
    qualifications: list | None = None


def _clean_quals(lst):
    """Rapikan kualifikasi: strip, buang kosong, dedupe (case-insensitive) sambil pertahankan tampilan asli."""
    seen, out = set(), []
    for x in (lst or []):
        s = str(x).strip()
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out


class ChangePasswordBody(BaseModel):
    current_password: str | None = None
    new_password: str


@router.put("/profile")
async def update_profile(body: ProfileBody, user: dict = Depends(get_current_user)):
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.phone is not None:
        updates["phone"] = body.phone
    if user["role"] == "student":
        if body.grade is not None:
            updates["grade"] = body.grade
        if body.goal is not None:
            updates["goal"] = body.goal
        if body.school_id is not None:
            updates["school_id"] = body.school_id or None
    if user["role"] == "proctor" and body.school_name_text is not None:
        updates["school_name_text"] = body.school_name_text
    if user["role"] == "tutor":
        if body.cv_url is not None:
            updates["cv_url"] = body.cv_url
            updates["cv_name"] = body.cv_name
        if body.certificates is not None:
            updates["certificates"] = body.certificates
        if body.qualifications is not None:
            updates["qualifications"] = _clean_quals(body.qualifications)
    if not updates:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated


@router.post("/change-password")
async def change_password(body: ChangePasswordBody, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if full.get("password_hash"):
        if not body.current_password or not verify_password(body.current_password, full["password_hash"]):
            raise HTTPException(status_code=400, detail="Kata sandi saat ini salah")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Kata sandi baru minimal 6 karakter")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}