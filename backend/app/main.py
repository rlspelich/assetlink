from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1 import attachments, dashboard, email, estimator, imports, reports, signs, supports, work_orders, inspections, users, water, sewer
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown — close DB connections, etc.
    from app.db.session import engine

    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="Municipal asset management platform for small communities",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow all origins in dev, lock down in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.environment == "development" else [
        "https://assetlink.bucket6.com",
        "https://assetlink-api-weeifrhkmq-uc.a.run.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(email.router, prefix="/api/v1/email", tags=["Email"])
app.include_router(imports.router, prefix="/api/v1/import", tags=["Import"])
app.include_router(signs.router, prefix="/api/v1/signs", tags=["Signs"])
app.include_router(supports.router, prefix="/api/v1/supports", tags=["Sign Supports"])
app.include_router(work_orders.router, prefix="/api/v1/work-orders", tags=["Work Orders"])
app.include_router(inspections.router, prefix="/api/v1/inspections", tags=["Inspections"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(attachments.router, prefix="/api/v1")
# Estimator module
app.include_router(estimator.router, prefix="/api/v1/estimator", tags=["Estimator"])
# Water module
app.include_router(water.router, prefix="/api/v1", tags=["Water"])
# Sewer module
app.include_router(sewer.router, prefix="/api/v1", tags=["Sewer"])

# Serve uploaded files in dev (local storage)
uploads_dir = Path(settings.upload_dir)
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.app_name}


# ---------------------------------------------------------------------------
# Serve React frontend (production only — built into /app/static)
# ---------------------------------------------------------------------------
STATIC_DIR = Path("/app/static")

if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    # Serve static assets (JS, CSS, images) at /assets/
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="frontend-assets")

    # Catch-all: serve index.html for SPA client-side routing
    # This must be AFTER all API routes
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Serve the React SPA for any non-API route."""
        # Don't serve SPA for API paths or uploads
        if full_path.startswith(("api/", "uploads/", "docs", "openapi.json", "health")):
            return None
        # Check if requesting a static file (favicon, etc.)
        static_file = STATIC_DIR / full_path
        if static_file.exists() and static_file.is_file():
            return FileResponse(str(static_file))
        # Default: serve index.html (SPA handles routing)
        return FileResponse(str(STATIC_DIR / "index.html"))
