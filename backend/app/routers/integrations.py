"""Pluteus integration proxy — fetches knowledge content from Pluteus API."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
import httpx
from app.models import User
from app.auth import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/integrations/pluteus", tags=["Pluteus Integration"])
settings = get_settings()


def _pluteus_headers() -> dict:
    """Build auth headers for Pluteus API."""
    return {"Authorization": f"Bearer {settings.pluteus_api_token}"}


def _pluteus_url(path: str) -> str:
    """Build full Pluteus API URL."""
    base = settings.pluteus_url.rstrip("/")
    return f"{base}/api/v1{path}"


def _check_configured():
    """Raise 503 if Pluteus integration is not configured."""
    if not settings.pluteus_url or not settings.pluteus_api_token:
        raise HTTPException(
            status_code=503,
            detail="Pluteus integration not configured (set PLUTEUS_URL and PLUTEUS_API_TOKEN)",
        )


@router.get("/status")
def integration_status(current_user: User = Depends(get_current_user)):
    """Check if Pluteus integration is configured and reachable."""
    if not settings.pluteus_url:
        return {"configured": False, "reachable": False}

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(
                _pluteus_url("/decisions"),
                headers=_pluteus_headers(),
            )
            return {
                "configured": True,
                "reachable": resp.status_code == 200,
                "url": settings.pluteus_url,
            }
    except Exception:
        return {"configured": True, "reachable": False, "url": settings.pluteus_url}


@router.get("/decisions")
def get_decisions(
    correlation_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Proxy decisions from Pluteus API."""
    _check_configured()

    params = {}
    if correlation_id:
        params["correlation_id"] = correlation_id

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                _pluteus_url("/decisions"),
                headers=_pluteus_headers(),
                params=params,
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Pluteus API error")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Pluteus: {e}")


@router.get("/decisions/{decision_id}")
def get_decision(
    decision_id: int,
    current_user: User = Depends(get_current_user),
):
    """Proxy a single decision from Pluteus API."""
    _check_configured()

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                _pluteus_url(f"/decisions/{decision_id}"),
                headers=_pluteus_headers(),
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Pluteus API error")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Pluteus: {e}")


@router.get("/search")
def search_pluteus(
    q: str,
    current_user: User = Depends(get_current_user),
):
    """Proxy search to Pluteus API."""
    _check_configured()

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                _pluteus_url("/search"),
                headers=_pluteus_headers(),
                params={"q": q},
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Pluteus API error")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach Pluteus: {e}")
