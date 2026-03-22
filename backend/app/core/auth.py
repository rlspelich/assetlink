"""
Clerk authentication integration.

In production, every request carries a Clerk JWT (Authorization: Bearer <token>).
The JWT contains:
  - sub: Clerk user ID
  - o.id: Clerk organization ID (maps to our tenant)
  - o.role: User's role in the org

In development (when CLERK_JWKS_URL is not set), auth is skipped and
the X-Tenant-ID header is used as a fallback. This lets us develop and
test without a Clerk account.
"""

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

# Only initialize Clerk auth if configured
_clerk_auth = None
_clerk_config = None

if settings.clerk_jwks_url:
    from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer

    _clerk_config = ClerkConfig(jwks_url=settings.clerk_jwks_url)
    _clerk_auth = ClerkHTTPBearer(config=_clerk_config)


@dataclass
class AuthContext:
    """Authenticated user context extracted from Clerk JWT or dev headers."""
    user_id: str  # Clerk user ID (sub claim) or "dev-user"
    clerk_org_id: str | None  # Clerk organization ID (o.id claim)
    role: str | None  # Clerk org role (o.role claim)


async def get_auth_context(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> AuthContext:
    """
    Extract authenticated user context from the request.

    Production: Validates Clerk JWT, extracts user_id and org_id.
    Development: Returns a dev context (no auth required).
    """
    # --- Production: Clerk JWT validation ---
    if _clerk_auth is not None and authorization:
        # Extract Bearer token
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        token = authorization[7:]

        try:
            # Use the Clerk middleware to validate the token
            import jwt
            from jwt import PyJWKClient

            jwks_client = PyJWKClient(settings.clerk_jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_aud": False},  # Clerk doesn't use aud
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing user ID (sub claim)")

        # Extract org context
        org = payload.get("o", {})
        clerk_org_id = org.get("id") if isinstance(org, dict) else None
        role = org.get("role") if isinstance(org, dict) else None

        return AuthContext(
            user_id=user_id,
            clerk_org_id=clerk_org_id,
            role=role,
        )

    # --- Development fallback: no auth ---
    if not settings.clerk_jwks_url:
        return AuthContext(
            user_id="dev-user",
            clerk_org_id=None,
            role="admin",
        )

    # Auth is configured but no token provided
    raise HTTPException(
        status_code=401,
        detail="Authorization header required. Send: Authorization: Bearer <clerk_jwt>",
    )
