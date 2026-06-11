from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/reno_viewer"

    s3_endpoint_url: str | None = None       # None = AWS; MinIO/R2 = full URL
    s3_presign_endpoint_url: str | None = None  # public-facing URL for presigned links (MinIO local dev only)
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "reno-viewer"
    s3_presign_expires: int = 86400         # presigned URL lifetime in seconds (default 24h)

    # Seed credentials for the FIRST account only (used when the users table
    # is empty). Provide the password either as plaintext (AUTH_PASSWORD) or
    # as a base64-encoded bcrypt hash (AUTH_PASSWORD_HASH — base64 keeps $
    # signs out of env files). After seeding, accounts live in the DB.
    auth_username: str = "reo"
    auth_password: str = ""
    auth_password_hash: str = ""
    jwt_secret: str  # random hex string — set in .env
    jwt_expire_hours: int = 72

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
