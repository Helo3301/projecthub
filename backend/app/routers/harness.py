"""Aletheia wp-11: harness metrics + gate endpoints.

Read-only surface exposing what lives in the aletheia harness SQLite
DB (populated by ``aletheia-harness record-pair`` on the CLI). The
dashboard in Delos polls these two endpoints.

Importing aletheia is optional — same as wp-10. If the package isn't
installed in the projecthub venv, both endpoints 503.
"""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User

try:
    from aletheia.harness import (
        DEFAULT_HARNESS_DB,
        auto_ship_gate_status,
        compute_metrics,
    )
    _ALETHEIA_HARNESS_AVAILABLE = True
except ImportError:  # pragma: no cover
    _ALETHEIA_HARNESS_AVAILABLE = False
    DEFAULT_HARNESS_DB = os.path.expanduser("~/.aletheia/harness.db")

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/briefs/harness", tags=["Harness"])

_HARNESS_DB = os.environ.get("ALETHEIA_HARNESS_DB", DEFAULT_HARNESS_DB)


def _require_aletheia() -> None:
    if not _ALETHEIA_HARNESS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="aletheia package not installed — harness endpoints unavailable",
        )
    if not os.path.exists(_HARNESS_DB):
        raise HTTPException(
            status_code=503,
            detail=(
                f"aletheia harness db not found at {_HARNESS_DB}. "
                "Run `aletheia-harness record-pair ...` to populate it."
            ),
        )


@router.get("/metrics")
def harness_metrics(
    start: str = Query(..., description="ISO week, e.g. 2026-W12"),
    end: str = Query(..., description="ISO week, e.g. 2026-W17"),
    reader: str | None = None,
    project: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Aggregate match/miss/hallucination rates for a week range."""
    _require_aletheia()
    m = compute_metrics(
        week_range=(start, end),
        reader=reader,
        project=project,
        db_path=_HARNESS_DB,
    )
    return {
        "pairs_evaluated": m.pairs_evaluated,
        "match_rate": m.match_rate,
        "miss_rate": m.miss_rate,
        "hallucination_rate": m.hallucination_rate,
        "unsupported_hallucinations": m.unsupported_hallucinations,
    }


@router.get("/gate")
def harness_gate(
    as_of: str | None = Query(None, description="ISO 8601 timestamp; default now"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Trailing-6-week auto-ship gate status. Returns
    ``reason='InsufficientData'`` when fewer than 4 paired weeks exist."""
    _require_aletheia()
    return auto_ship_gate_status(as_of=as_of, db_path=_HARNESS_DB)
