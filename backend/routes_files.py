import uuid
import asyncio
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Response

from database import db
from utils import now_iso
from security import require_roles, get_current_user
from storage import put_object, get_object, MIME_TYPES, APP_NAME

router = APIRouter(prefix="/api", tags=["files"])
uploader = require_roles("admin", "tutor")


@router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(uploader)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    file_id = uuid.uuid4().hex
    path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.{ext}"
    data = await file.read()
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    try:
        result = await asyncio.to_thread(put_object, path, data, content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal mengunggah berkas: {e}")
    doc = {
        "id": file_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "uploaded_by": user["id"],
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(doc)
    return {
        "id": file_id,
        "url": f"/api/files/{result['path']}",
        "filename": file.filename,
        "content_type": content_type,
        "size": doc["size"],
        "path": result["path"],
    }


QIMG_PREFIX = f"{APP_NAME}/question-images/"
IMAGE_EXT = {"png", "jpg", "jpeg", "gif", "webp", "svg"}
MAX_IMAGE = 5 * 1024 * 1024


async def save_question_image(filename: str, data: bytes, user_id: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in IMAGE_EXT:
        raise ValueError("Format gambar harus PNG, JPG, GIF, WEBP, atau SVG")
    if len(data) > MAX_IMAGE:
        raise ValueError("Ukuran gambar maksimal 5 MB")
    file_id = uuid.uuid4().hex
    path = f"{QIMG_PREFIX}{file_id}.{ext}"
    content_type = "image/svg+xml" if ext == "svg" else MIME_TYPES.get(ext, "image/png")
    result = await asyncio.to_thread(put_object, path, data, content_type)
    await db.files.insert_one({
        "id": file_id, "storage_path": result["path"], "original_filename": filename,
        "content_type": content_type, "size": len(data), "uploaded_by": user_id,
        "is_deleted": False, "created_at": now_iso(),
    })
    return f"/api/question-images/{result['path'][len(QIMG_PREFIX):]}"


@router.post("/questions/upload-image")
async def upload_question_image(file: UploadFile = File(...), user: dict = Depends(uploader)):
    data = await file.read()
    try:
        url = await save_question_image(file.filename or "", data, user["id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal mengunggah gambar: {e}")
    return {"url": url}


@router.get("/question-images/{name}")
async def question_image(name: str):
    path = f"{QIMG_PREFIX}{name}"
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    try:
        data, _ = await asyncio.to_thread(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    return Response(content=data, media_type=record["content_type"],
                    headers={"Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff",
                             "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"})


@router.get("/files/{path:path}")
async def download(path: str, user: dict = Depends(get_current_user)):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Berkas tidak ditemukan")
    try:
        data, content_type = await asyncio.to_thread(get_object, path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal memuat berkas: {e}")
    return Response(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600"},
    )
