from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import dashboard, email, signs, supports, work_orders, inspections, users
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
    allow_origins=["*"] if settings.environment == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(email.router, prefix="/api/v1/email", tags=["Email"])
app.include_router(signs.router, prefix="/api/v1/signs", tags=["Signs"])
app.include_router(supports.router, prefix="/api/v1/supports", tags=["Sign Supports"])
app.include_router(work_orders.router, prefix="/api/v1/work-orders", tags=["Work Orders"])
app.include_router(inspections.router, prefix="/api/v1/inspections", tags=["Inspections"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.app_name}
