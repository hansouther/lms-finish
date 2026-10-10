import re
import uuid
import asyncio
from typing import Literal
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Response
from pydantic import BaseModel, Field, field_validator

from database import db
from utils import now_iso
from security import require_roles
from storage import put_object, get_object, MIME_TYPES, APP_NAME

router = APIRouter(prefix="/api", tags=["site"])
admin_only = require_roles("admin")

SITE_PREFIX = f"{APP_NAME}/site-assets/"
SITE_EXT = {"png", "jpg", "jpeg", "gif", "webp", "svg", "ico"}
MAX_ASSET = 5 * 1024 * 1024
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")

DEFAULTS = {
    "site_name": "Binara LMS",
    "tagline": "Platform Belajar Terintegrasi",
    "logo_url": "",
    "favicon_url": "",
    "hero_image_url": "",
    "login_image_url": "",
    "og_image_url": "",
    "footer_text": "",
    "loader_enabled": True,
    "loader_title": "",
    "loader_message": "Mohon tunggu, sedang menyiapkan halaman...",
    "loader_logo_url": "",
    "loader_bg_color": "#0A1128",
    "loader_text_color": "#FFFFFF",
    "loader_accent_color": "#22D3EE",
    "loader_style": "spinner",
    "loader_min_ms": 800,
}


class SiteSettingsBody(BaseModel):
    site_name: str = Field(min_length=1, max_length=80)
    tagline: str = Field(default="", max_length=160)
    logo_url: str = ""
    favicon_url: str = ""
    hero_image_url: str = ""
    login_image_url: str = ""
    og_image_url: str = ""
    footer_text: str = Field(default="", max_length=200)
    loader_enabled: bool = True
    loader_title: str = Field(default="", max_length=80)
    loader_message: str = Field(default="", max_length=200)
    loader_logo_url: str = ""
    loader_bg_color: str = "#0A1128"
    loader_text_color: str = "#FFFFFF"
    loader_accent_color: str = "#22D3EE"
    loader_style: Literal["spinner", "bar", "pulse"] = "spinner"
    loader_min_ms: int = Field(default=800, ge=0, le=10000)

    @field_validator("logo_url", "favicon_url", "hero_image_url", "login_image_url", "og_image_url", "loader_logo_url")
    @classmethod
    def _url(cls, v: str) -> str:
        v = (v or "").strip()
        if v and not (v.startswith("/api/site-assets/") or v.startswith("https://")):
            raise ValueError("URL gambar harus hasil unggahan atau diawali https://")
        return v

    @field_validator("loader_bg_color", "loader_text_color", "loader_accent_color")
    @classmethod
    def _color(cls, v: str) -> str:
        if not HEX.match(v or ""):
            raise ValueError("Warna harus format hex, contoh #0A1128")
        return v.upper()


async def _get_settings() -> dict:
    doc = await db.site_settings.find_one({"id": "site"}, {"_id": 0, "id": 0}) or {}
    return {**DEFAULTS, **{k: v for k, v in doc.items() if k in DEFAULTS}}


@router.get("/public/site-settings")
async def public_settings(response: Response):
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=120"
    return await _get_settings()


@router.get("/admin/site-settings")
async def admin_settings(user: dict = Depends(admin_only)):
    return await _get_settings()


@router.put("/admin/site-settings")
async def update_settings(body: SiteSettingsBody, user: dict = Depends(admin_only)):
    data = body.model_dump()
    data["site_name"] = data["site_name"].strip()
    await db.site_settings.update_one(
        {"id": "site"},
        {"$set": {**data, "updated_at": now_iso(), "updated_by": user["id"]}, "$setOnInsert": {"id": "site"}},
        upsert=True,
    )
    return await _get_settings()


@router.post("/admin/site-assets")
async def upload_site_asset(file: UploadFile = File(...), user: dict = Depends(admin_only)):
    name = file.filename or ""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in SITE_EXT:
        raise HTTPException(status_code=400, detail="Format harus PNG, JPG, WEBP, GIF, SVG, atau ICO")
    data = await file.read()
    if len(data) > MAX_ASSET:
        raise HTTPException(status_code=400, detail="Ukuran gambar maksimal 5 MB")
    file_id = uuid.uuid4().hex
    path = f"{SITE_PREFIX}{file_id}.{ext}"
    content_type = {"svg": "image/svg+xml", "ico": "image/x-icon"}.get(ext) or MIME_TYPES.get(ext, "image/png")
    try:
        result = await asyncio.to_thread(put_object, path, data, content_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal mengunggah gambar: {e}")
    await db.files.insert_one({
        "id": file_id, "storage_path": result["path"], "original_filename": name,
        "content_type": content_type, "size": len(data), "uploaded_by": user["id"],
        "is_deleted": False, "created_at": now_iso(),
    })
    return {"url": f"/api/site-assets/{result['path'][len(SITE_PREFIX):]}"}


@router.get("/site-assets/{name}")
async def site_asset(name: str):
    path = f"{SITE_PREFIX}{name}"
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    try:
        data, _ = await asyncio.to_thread(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    return Response(content=data, media_type=record["content_type"],
                    headers={"Cache-Control": "public, max-age=604800, immutable", "X-Content-Type-Options": "nosniff",
                             "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
                             "Cross-Origin-Resource-Policy": "cross-origin"})
