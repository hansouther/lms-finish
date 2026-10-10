import os
import uuid
import asyncio
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse

from database import db
from security import get_current_user, require_roles
from storage import s3_client, S3_BUCKET_NAME, put_object, get_object
import routes_files
import routes_site

# Berkas dibuka langsung dari Cloudflare R2 (link bertanda tangan), bukan dialirkan lewat server Railway.
router = APIRouter(prefix="/api", tags=["r2"])
PUBLIC_BASE_URL = (os.environ.get("S3_PUBLIC_URL") or os.environ.get("R2_PUBLIC_URL") or "").rstrip("/")
FILE_TTL = 3600
PUBLIC_TTL = 7 * 24 * 3600


def _signed(path: str, ttl: int, content_type: str = "", filename: str = "") -> str:
    params = {"Bucket": S3_BUCKET_NAME, "Key": path}
    if content_type:
        params["ResponseContentType"] = content_type
    if filename:
        safe = filename.replace('"', "").encode("ascii", "ignore").decode() or "berkas"
        params["ResponseContentDisposition"] = f'inline; filename="{safe}"'
    return s3_client.generate_presigned_url("get_object", Params=params, ExpiresIn=ttl)


def _public(path: str, ttl: int) -> str:
    return f"{PUBLIC_BASE_URL}/{path}" if PUBLIC_BASE_URL else _signed(path, ttl)


@router.get("/files/{path:path}")
async def r2_file(path: str, request: Request, user: dict = Depends(get_current_user)):
    if not s3_client or not request.query_params.get("token"):
        return await routes_files.download(path, user)
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Berkas tidak ditemukan")
    url = _signed(path, FILE_TTL, record.get("content_type", ""), record.get("original_filename", ""))
    return RedirectResponse(url, status_code=307, headers={"Cache-Control": "private, max-age=600"})


@router.get("/question-images/{name}")
async def r2_question_image(name: str):
    if not s3_client:
        return await routes_files.question_image(name)
    path = f"{routes_files.QIMG_PREFIX}{name}"
    if not await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    return RedirectResponse(_public(path, PUBLIC_TTL), status_code=302, headers={"Cache-Control": "public, max-age=3600"})


@router.get("/site-assets/{name}")
async def r2_site_asset(name: str):
    if not s3_client:
        return await routes_site.site_asset(name)
    path = f"{routes_site.SITE_PREFIX}{name}"
    if not await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    return RedirectResponse(_public(path, PUBLIC_TTL), status_code=302, headers={"Cache-Control": "public, max-age=3600"})


def _check() -> dict:
    key = f"healthcheck/{uuid.uuid4().hex}.txt"
    put_object(key, b"ok", "text/plain")
    data, _ = get_object(key)
    if s3_client:
        s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=key)
    return {"ok": data == b"ok"}


@router.get("/admin/storage-status")
async def storage_status(user: dict = Depends(require_roles("admin"))):
    info = {
        "provider": "cloudflare_r2" if s3_client else "disk_server",
        "bucket": S3_BUCKET_NAME if s3_client else None,
        "public_url": PUBLIC_BASE_URL or None,
        "direct_delivery": bool(s3_client),
    }
    try:
        info.update(await asyncio.to_thread(_check))
    except Exception as e:
        info.update({"ok": False, "error": str(e)})
    return info
