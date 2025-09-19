from __future__ import annotations

from pathlib import Path
from typing import BinaryIO

import boto3
from botocore.client import Config as BotoConfig

from app.core.config import settings


class StorageService:
    def __init__(self):
        self.backend = (getattr(settings, "STORAGE_BACKEND", "local") or "local").lower()
        if self.backend not in {"local", "s3"}:
            self.backend = "local"

        if self.backend == "local":
            self.base_path = Path(settings.UPLOAD_DIR)
            self.base_path.mkdir(parents=True, exist_ok=True)
        else:
            session = boto3.session.Session(
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                region_name=settings.S3_REGION,
            )
            s3_config = {}
            if settings.S3_ENDPOINT:
                s3_config["endpoint_url"] = settings.S3_ENDPOINT
            self.s3 = session.client(
                "s3",
                config=BotoConfig(s3={"addressing_style": "path" if settings.S3_USE_PATH_STYLE else "auto"}),
                **s3_config,
            )
            self.bucket = settings.S3_BUCKET

    def save_file(self, fileobj: BinaryIO, destination: str, content_type: str | None = None) -> str:
        """
        Saves a file and returns a public-ish reference (path for local, key for S3).
        destination: path/key relative (e.g., "tickets/123/filename.ext")
        """
        if self.backend == "local":
            dest_path = self.base_path / destination
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            with open(dest_path, "wb") as out:
                out.write(fileobj.read())
            return str(dest_path)
        else:
            extra_args = {}
            if content_type:
                extra_args["ContentType"] = content_type
            self.s3.upload_fileobj(fileobj, self.bucket, destination, ExtraArgs=extra_args)
            return destination

    def get_file_url(self, identifier: str, expires: int = 3600) -> str:
        """
        For local: return file:// path.
        For S3: return presigned URL.
        """
        if self.backend == "local":
            return f"file://{Path(identifier).resolve()}"
        else:
            return self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": identifier},
                ExpiresIn=expires,
            )