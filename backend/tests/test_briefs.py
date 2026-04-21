"""Aletheia wp-9: Brief Review Queue endpoint tests.

Covers the five YAML-mandated acceptance tests plus a handful of hairier
ones the live diff logic needs pinning:

- ``test_list_pending_filters_status``
- ``test_approve_writes_pluteus_sync_error_when_no_token``
- ``test_unauthorized_approve_returns_403``
- ``test_approve_with_edits_captures_per_sentence_diffs``
- ``test_reject_records_reason_and_moves_to_rejected``
- ``test_sent_archive_only_shows_approved``
- ``test_diff_endpoint_returns_zero_when_unedited``
- ``test_trailing_citation_splitter_fix_present``
"""

from __future__ import annotations

import json

import pytest

from app.auth import get_current_user
from app.main import app
from app.models import User


def _mk_user(db, username: str = "helo") -> User:
    u = User(
        username=username,
        email=f"{username}@hestia.test",
        hashed_password="x",
        full_name=username.title(),
        avatar_color="#111111",
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def as_helo(db, client):
    """Act as the approver ('helo')."""
    user = _mk_user(db, "helo")
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_erin(db, client):
    """Act as a non-approver user ('erin')."""
    user = _mk_user(db, "erin")
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def _sample_payload(**overrides) -> dict:
    base = {
        "reader": "rowen",
        "project": "Agora",
        "date_range_start": "2026-04-11T00:00:00Z",
        "date_range_end": "2026-04-18T23:59:59Z",
        "markdown": (
            "## Summary\n"
            "Agora shipped wp-5 this week. [^1]\n"
            "\n"
            "## Citations\n"
            "[^1]: type=pr ref=Hestia-s-Creations/agora#18 — wp-5\n"
        ),
        "citations": {"1": {"type": "pr", "ref": "Hestia-s-Creations/agora#18"}},
        "ungrounded_flags": [],
        "grounded_pct": 1.0,
        "hallucination_risk": 0.05,
    }
    base.update(overrides)
    return base


# ─── YAML-mandated acceptance tests ──────────────────────────────


def test_list_pending_filters_status(client, as_helo):
    """GET /api/briefs/pending returns only status=pending."""
    r = client.post("/api/briefs", json=_sample_payload())
    assert r.status_code == 201
    pid = r.json()["id"]

    r = client.post("/api/briefs", json=_sample_payload(project="amphora"))
    assert r.status_code == 201
    aid = r.json()["id"]

    # Reject the second so only one remains pending.
    r = client.post(f"/api/briefs/{aid}/reject", json={"reason": "not ready"})
    assert r.status_code == 200

    r = client.get("/api/briefs/pending")
    assert r.status_code == 200
    ids = {b["id"] for b in r.json()}
    assert ids == {pid}


def test_approve_writes_pluteus_sync_error_when_no_token(client, as_helo, monkeypatch):
    """POST /api/briefs/{id}/approve surfaces Pluteus config errors
    instead of hard-failing (degrade rule from the wp-9 YAML)."""
    monkeypatch.delenv("ALETHEIA_PLUTEUS_TOKEN", raising=False)
    # Reload token lookup — router captured env at import time.
    import importlib
    from app.routers import briefs as briefs_mod
    importlib.reload(briefs_mod)
    app.include_router(briefs_mod.router, prefix="/api")

    r = client.post("/api/briefs", json=_sample_payload())
    brief_id = r.json()["id"]

    r = client.post(f"/api/briefs/{brief_id}/approve", json={})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "approved"
    assert body["pluteus_sync_error"] is not None
    assert "PLUTEUS_TOKEN" in body["pluteus_sync_error"]
    assert body["pluteus_slug"] is None


def test_unauthorized_approve_returns_403(client, as_erin):
    """A user who is not the reader's approver cannot approve."""
    r = client.post("/api/briefs", json=_sample_payload())
    brief_id = r.json()["id"]

    r = client.post(f"/api/briefs/{brief_id}/approve", json={})
    assert r.status_code == 403, r.text
    assert "not the approver" in r.json()["detail"]


# ─── Diff and backprop integration (for wp-10) ───────────────────


def test_approve_with_edits_captures_per_sentence_diffs(client, as_helo, db):
    """Editing a sentence creates a BriefEdit row with the cited sources."""
    md = (
        "## Summary\n"
        "Agora shipped wp-5 this week. [^1]\n"
        "The ticket module unblocks five downstream WPs. [^1]\n"
    )
    r = client.post("/api/briefs", json=_sample_payload(markdown=md))
    brief_id = r.json()["id"]

    edited = (
        "## Summary\n"
        "Agora finalized and shipped wp-5 this week. [^1]\n"
        "The ticket module unblocks five downstream WPs. [^1]\n"
    )
    r = client.post(f"/api/briefs/{brief_id}/approve", json={"edited_markdown": edited})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "approved"
    # One sentence changed; the second was identical.
    assert body["edit_distance"] > 0
    assert body["sources_backpropped"] >= 1

    # Diff endpoint sees the change too.
    r = client.get(f"/api/briefs/{brief_id}/diff")
    assert r.status_code == 200
    diff = r.json()
    assert len(diff["sentence_diffs"]) == 1
    assert diff["sentence_diffs"][0]["sources_cited"] == ["1"]


def test_reject_records_reason_and_moves_to_rejected(client, as_helo):
    r = client.post("/api/briefs", json=_sample_payload())
    brief_id = r.json()["id"]

    r = client.post(f"/api/briefs/{brief_id}/reject", json={"reason": "corpus too thin"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "rejected"
    assert body["reject_reason"] == "corpus too thin"

    # And it must not show up in pending after rejection.
    r = client.get("/api/briefs/pending")
    assert all(b["id"] != brief_id for b in r.json())


def test_sent_archive_only_shows_approved(client, as_helo):
    r = client.post("/api/briefs", json=_sample_payload())
    approved_id = r.json()["id"]
    client.post(f"/api/briefs/{approved_id}/approve", json={})

    r = client.post("/api/briefs", json=_sample_payload(project="amphora"))
    rejected_id = r.json()["id"]
    client.post(f"/api/briefs/{rejected_id}/reject", json={"reason": "x"})

    r = client.get("/api/briefs/sent")
    assert r.status_code == 200
    ids = {b["id"] for b in r.json()}
    assert approved_id in ids
    assert rejected_id not in ids


def test_diff_endpoint_returns_zero_when_unedited(client, as_helo):
    r = client.post("/api/briefs", json=_sample_payload())
    brief_id = r.json()["id"]
    # Approve without edits.
    client.post(f"/api/briefs/{brief_id}/approve", json={})

    r = client.get(f"/api/briefs/{brief_id}/diff")
    assert r.status_code == 200
    diff = r.json()
    assert diff["sentence_diffs"] == []
    assert diff["total_edit_distance"] == 0


def test_trailing_citation_splitter_fix_present(client, as_helo, db):
    """The splitter fix from wp-8 follow-up (PR #5) must be mirrored in
    the backend diff path — otherwise per-sentence edit attribution
    would suffer the same 0.5 false-flag collapse. Put a sentence whose
    citations trail the period and verify the edit is detected on that
    exact sentence, with the right source cited."""
    md = (
        "Agora wp-5 shipped this week. [^1][^2][^3] "
        "The ticket module unblocks five downstream work packages. [^1]\n"
    )
    r = client.post("/api/briefs", json=_sample_payload(
        markdown=md,
        citations={
            "1": {"type": "pr", "ref": "agora#18"},
            "2": {"type": "pr", "ref": "agora#17"},
            "3": {"type": "commit", "ref": "agora@abc"},
        },
    ))
    brief_id = r.json()["id"]

    edited_md = (
        "Agora wp-5 finalized and shipped this week. [^1][^2][^3] "
        "The ticket module unblocks five downstream work packages. [^1]\n"
    )
    r = client.post(f"/api/briefs/{brief_id}/approve", json={"edited_markdown": edited_md})
    assert r.status_code == 200, r.text

    r = client.get(f"/api/briefs/{brief_id}/diff")
    diff = r.json()
    # Exactly one sentence changed — the first, which carried three cites.
    assert len(diff["sentence_diffs"]) == 1
    cited = diff["sentence_diffs"][0]["sources_cited"]
    # All three trailing cites belong to the edited sentence, not the next.
    assert set(cited) == {"1", "2", "3"}
