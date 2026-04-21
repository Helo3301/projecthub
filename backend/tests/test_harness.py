"""Aletheia wp-11: projecthub harness endpoint tests.

The endpoints are a thin HTTP surface over aletheia.harness. We
populate the harness SQLite db in the test fixture and verify that
the router reads and serialises correctly.
"""

from __future__ import annotations

import os
import sqlite3

import pytest

from aletheia.harness import Alignment, record_brief_pair
from app.auth import get_current_user
from app.main import app
from app.models import User


class _StubJudge:
    def __init__(self):
        self.auto_claims = ["c1.", "c2.", "c3.", "hallucinated.", "c5."]
        self.manual_claims = ["c1.", "c2.", "c3.", "c5."]

    def extract_claims(self, brief_markdown: str) -> list[str]:
        return self.auto_claims if "# auto" in brief_markdown else self.manual_claims

    def align_claims(self, auto_claims, manual_claims) -> list[Alignment]:
        return [
            Alignment(auto_index=0, manual_index=0, match_type="match"),
            Alignment(auto_index=1, manual_index=1, match_type="match"),
            Alignment(auto_index=2, manual_index=2, match_type="match"),
            Alignment(auto_index=3, manual_index=None, match_type="miss"),
            Alignment(auto_index=4, manual_index=3, match_type="match"),
        ]

    def supports(self, claim: str, source_corpus: list[str]) -> bool:
        return False


def _mk_user(db, username: str = "helo") -> User:
    u = User(
        username=username, email=f"{username}@hestia.test",
        hashed_password="x", full_name=username.title(),
        avatar_color="#111111", is_active=True,
    )
    db.add(u); db.commit(); db.refresh(u)
    return u


@pytest.fixture
def as_helo(db, client):
    user = _mk_user(db, "helo")
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def harness_db(tmp_path, monkeypatch):
    db_path = str(tmp_path / "harness.db")
    monkeypatch.setenv("ALETHEIA_HARNESS_DB", db_path)
    # Router captured the path at import time; reload to re-read env.
    import importlib
    from app.routers import harness as harness_mod
    importlib.reload(harness_mod)
    app.include_router(harness_mod.router, prefix="/api")
    judge = _StubJudge()
    for wk in ("2026-W13", "2026-W14", "2026-W15", "2026-W16", "2026-W17"):
        record_brief_pair(
            week=wk, reader="rowen", project="Agora",
            auto_brief_markdown="# auto\n" + " ".join(judge.auto_claims),
            manual_brief_markdown="# manual\n" + " ".join(judge.manual_claims),
            source_corpus=[], judge=judge, db_path=db_path,
        )
    return db_path


def test_metrics_endpoint_returns_aggregated_rates(client, as_helo, harness_db):
    r = client.get("/api/briefs/harness/metrics?start=2026-W13&end=2026-W17")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["pairs_evaluated"] == 5
    # 4 of 5 auto claims match per pair; 1 is hallucinated -> 0.2
    assert body["hallucination_rate"] == pytest.approx(0.2, abs=1e-6)
    assert body["match_rate"] == pytest.approx(0.8, abs=1e-6)
    assert len(body["unsupported_hallucinations"]) == 5  # one per pair


def test_gate_endpoint_below_ceiling_returns_closed(client, as_helo, harness_db):
    r = client.get("/api/briefs/harness/gate?as_of=2026-04-21T00:00:00%2B00:00")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["weeks_counted"] == 5
    # hallucination_rate = 0.2 > 0.005 ceiling => gate closed
    assert body["gate_open"] is False
    assert body["rate_trailing_6w"] == pytest.approx(0.2, abs=1e-6)


def test_metrics_requires_auth(client, harness_db):
    # No as_helo fixture -> no dependency override -> 401 from get_current_user
    r = client.get("/api/briefs/harness/metrics?start=2026-W13&end=2026-W17")
    assert r.status_code == 401


def test_endpoints_503_when_harness_db_missing(client, as_helo, tmp_path, monkeypatch):
    monkeypatch.setenv("ALETHEIA_HARNESS_DB", str(tmp_path / "does-not-exist.db"))
    import importlib
    from app.routers import harness as harness_mod
    importlib.reload(harness_mod)
    app.include_router(harness_mod.router, prefix="/api")

    r = client.get("/api/briefs/harness/metrics?start=2026-W13&end=2026-W17")
    assert r.status_code == 503
    assert "harness db not found" in r.json()["detail"]
