from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    DATABASE_URL: str = Field(..., description="SQLAlchemy database URL for Postgres")
    JWT_SECRET: str = Field(..., description="Secret used to sign JWTs")
    JWT_EXPIRE_MIN: int = 60 * 24

    # Email provider (default SMTP); can be overridden by DB settings
    EMAIL_PROVIDER: str = "smtp"  # smtp | mailjet
    FROM_EMAIL: str | None = None

    # SMTP defaults (can be overridden by DB settings)
    SMTP_HOST: str | None = None
    SMTP_PORT: int | None = None
    SMTP_USER: str | None = None
    SMTP_PASS: str | None = None

    # Mailjet defaults (can be overridden by DB settings)
    MAILJET_API_KEY: str | None = None
    MAILJET_API_SECRET: str | None = None

    # File storage
    UPLOAD_DIR: str = "./storage/uploads"
    STORAGE_BACKEND: str = "local"  # local | s3
    S3_BUCKET: str | None = None
    S3_REGION: str | None = None
    S3_ENDPOINT: str | None = None  # e.g., http://localhost:9000 for MinIO
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_USE_PATH_STYLE: bool = True  # True for MinIO/compat

    class Config:
        env_file = ".env"


settings = Settings()