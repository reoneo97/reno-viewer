import uuid
import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException, UploadFile
from .config import settings


def _client(for_presign: bool = False):
    endpoint = (
        settings.s3_presign_endpoint_url if for_presign and settings.s3_presign_endpoint_url
        else settings.s3_endpoint_url
    )
    kwargs: dict = {
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
        "region_name": "auto",  # required for Cloudflare R2
    }
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    return boto3.client("s3", **kwargs)


def upload(file: UploadFile, prefix: str) -> str:
    """Upload a file and return its S3 key."""
    ext = (file.filename or "file").rsplit(".", 1)[-1].lower()
    key = f"{prefix}/{uuid.uuid4()}.{ext}"
    try:
        _client().upload_fileobj(
            file.file,
            settings.s3_bucket,
            key,
            ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {e}")
    return key


def presigned_url(key: str) -> str:
    """Generate a time-limited presigned GET URL for a key."""
    return _client(for_presign=True).generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=settings.s3_presign_expires,
    )


def upload_bytes(data: bytes, key: str, content_type: str) -> None:
    """Upload raw bytes to a given key."""
    try:
        _client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {e}")


def download(key: str) -> bytes | None:
    """Download an object by key. Returns None if not found."""
    try:
        obj = _client().get_object(Bucket=settings.s3_bucket, Key=key)
        return obj["Body"].read()
    except ClientError:
        return None


def delete(key: str) -> None:
    """Delete an object by key. Silently ignores missing objects."""
    try:
        _client().delete_object(Bucket=settings.s3_bucket, Key=key)
    except ClientError:
        pass
