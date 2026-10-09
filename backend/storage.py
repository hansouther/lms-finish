import os
import logging
from pathlib import Path
import boto3
from botocore.config import Config

logger = logging.getLogger(__name__)

APP_NAME = os.environ.get("APP_NAME", "binaralms")

# S3 / S3-compatible (AWS S3, Cloudflare R2, MinIO, Wasabi, IDCloudHost, dll). Variabel R2_* lama tetap didukung.
_r2_account = os.environ.get("R2_ACCOUNT_ID")
S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL") or (f"https://{_r2_account}.r2.cloudflarestorage.com" if _r2_account else None)
S3_ACCESS_KEY_ID = os.environ.get("S3_ACCESS_KEY_ID") or os.environ.get("R2_ACCESS_KEY_ID")
S3_SECRET_ACCESS_KEY = os.environ.get("S3_SECRET_ACCESS_KEY") or os.environ.get("R2_SECRET_ACCESS_KEY")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME") or os.environ.get("R2_BUCKET_NAME")
S3_REGION = os.environ.get("S3_REGION", "auto" if _r2_account else "ap-southeast-1")

LOCAL_DIR = Path(os.environ.get("LOCAL_STORAGE_DIR") or Path(__file__).parent / "storage_data")

if S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY and S3_BUCKET_NAME:
    s3_client = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        region_name=S3_REGION,
        aws_access_key_id=S3_ACCESS_KEY_ID,
        aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path" if S3_ENDPOINT_URL else "auto"}),
    )
else:
    s3_client = None
    logger.warning("Kredensial S3 belum diisi - berkas disimpan di disk lokal: %s", LOCAL_DIR)

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
    "webp": "image/webp", "pdf": "application/pdf", "csv": "text/csv", "txt": "text/plain",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime", "m4v": "video/x-m4v",
}


def _safe(path: str) -> str:
    safe = path.lstrip("/\\")
    if ".." in Path(safe).parts:
        raise ValueError("Path tidak valid")
    return safe


def put_object(path: str, data: bytes, content_type: str) -> dict:
    safe_path = _safe(path)
    if s3_client:
        s3_client.put_object(Bucket=S3_BUCKET_NAME, Key=safe_path, Body=data, ContentType=content_type)
    else:
        target = LOCAL_DIR / safe_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return {"path": safe_path, "size": len(data)}


def get_object(path: str):
    safe_path = _safe(path)
    if s3_client:
        res = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=safe_path)
        return res["Body"].read(), res.get("ContentType", "application/octet-stream")
    target = LOCAL_DIR / safe_path
    ext = safe_path.rsplit(".", 1)[-1].lower()
    return target.read_bytes(), MIME_TYPES.get(ext, "application/octet-stream")
