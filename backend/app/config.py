from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "AssetLink"
    environment: str = "development"
    debug: bool = True

    # Database
    database_url: str = "postgresql+asyncpg://assetlink:assetlink_dev@localhost:5432/assetlink"
    database_url_sync: str = "postgresql://assetlink:assetlink_dev@localhost:5432/assetlink"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth (Clerk)
    clerk_secret_key: str = ""  # sk_live_xxx or sk_test_xxx
    clerk_publishable_key: str = ""  # pk_live_xxx or pk_test_xxx
    clerk_jwks_url: str = ""  # https://your-app.clerk.accounts.dev/.well-known/jwks.json
    clerk_authorized_parties: list[str] = []  # Domains allowed to use the JWT

    # File storage
    gcs_bucket: str = ""
    upload_dir: str = "uploads"  # Local fallback for dev

    # Email (SMTP) — when smtp_host is empty, emails are logged instead of sent
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@assetlink.com"
    smtp_use_tls: bool = True

    # Pagination
    default_page_size: int = 50
    max_page_size: int = 200

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
