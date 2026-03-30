"""
Tests for the Agent Tasks API (TaskCreated hook integration).

These endpoints are separate from the project-based task system.
They receive tasks from Claude Code's TaskCreated hook and serve
them to the dashboard.
"""

import json
import pytest


# ── POST /api/agents/{agent_id}/tasks ────────────────────────────

class TestCreateAgentTask:
    """POST endpoint — receives task from TaskCreated hook."""

    def test_create_task_returns_201(self, client):
        resp = client.post("/api/agents/session-abc/tasks", json={
            "task_id": "task-1",
            "subject": "Implement feature X",
            "description": "Full details here",
            "owner": "claude",
            "status": "pending",
            "blocked_by": [],
            "blocks": ["task-2"],
        })
        assert resp.status_code == 201
        body = resp.json()
        assert body["status"] == "success"
        assert body["task_id"] == "task-1"

    def test_upsert_returns_200_on_duplicate(self, client):
        payload = {
            "task_id": "task-dup",
            "subject": "Original subject",
        }
        resp1 = client.post("/api/agents/session-abc/tasks", json=payload)
        assert resp1.status_code == 201

        payload["subject"] = "Updated subject"
        resp2 = client.post("/api/agents/session-abc/tasks", json=payload)
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "updated"

    def test_missing_subject_returns_400(self, client):
        resp = client.post("/api/agents/session-abc/tasks", json={
            "task_id": "task-bad",
            "subject": "",
        })
        assert resp.status_code == 400
        assert "subject" in resp.json()["detail"].lower()

    def test_missing_task_id_returns_422(self, client):
        """Pydantic validation rejects missing required field."""
        resp = client.post("/api/agents/session-abc/tasks", json={
            "subject": "No task_id provided",
        })
        assert resp.status_code == 422

    def test_blocked_by_and_blocks_stored_correctly(self, client):
        client.post("/api/agents/session-abc/tasks", json={
            "task_id": "task-deps",
            "subject": "Task with deps",
            "blocked_by": ["task-a", "task-b"],
            "blocks": ["task-c"],
        })
        resp = client.get("/api/agents/session-abc/tasks")
        tasks = resp.json()["tasks"]
        task = next(t for t in tasks if t["task_id"] == "task-deps")
        assert task["blocked_by"] == ["task-a", "task-b"]
        assert task["blocks"] == ["task-c"]

    def test_invalid_status_defaults_to_pending(self, client):
        client.post("/api/agents/session-abc/tasks", json={
            "task_id": "task-badstatus",
            "subject": "Bad status",
            "status": "nonsense",
        })
        resp = client.get("/api/agents/session-abc/tasks")
        task = next(t for t in resp.json()["tasks"] if t["task_id"] == "task-badstatus")
        assert task["status"] == "pending"


# ── GET /api/agents/{agent_id}/tasks ─────────────────────────────

class TestGetAgentTasks:
    """GET endpoint — serves tasks to the dashboard."""

    def test_empty_agent_returns_empty_array(self, client):
        resp = client.get("/api/agents/no-such-agent/tasks")
        assert resp.status_code == 200
        assert resp.json() == {"tasks": []}

    def test_returns_tasks_for_agent(self, client):
        client.post("/api/agents/agent-1/tasks", json={
            "task_id": "t1", "subject": "Task 1",
        })
        client.post("/api/agents/agent-1/tasks", json={
            "task_id": "t2", "subject": "Task 2",
        })
        # Different agent — should NOT appear
        client.post("/api/agents/agent-2/tasks", json={
            "task_id": "t3", "subject": "Task 3",
        })

        resp = client.get("/api/agents/agent-1/tasks")
        tasks = resp.json()["tasks"]
        assert len(tasks) == 2
        task_ids = {t["task_id"] for t in tasks}
        assert task_ids == {"t1", "t2"}

    def test_status_filter(self, client):
        for i, status in enumerate(["pending", "in_progress", "completed"]):
            client.post("/api/agents/agent-f/tasks", json={
                "task_id": f"tf-{i}", "subject": f"Task {i}", "status": status,
            })

        resp = client.get("/api/agents/agent-f/tasks", params={"status": "pending"})
        tasks = resp.json()["tasks"]
        assert len(tasks) == 1
        assert tasks[0]["status"] == "pending"

    def test_comma_separated_status_filter(self, client):
        for i, status in enumerate(["pending", "in_progress", "completed"]):
            client.post("/api/agents/agent-g/tasks", json={
                "task_id": f"tg-{i}", "subject": f"Task {i}", "status": status,
            })

        resp = client.get("/api/agents/agent-g/tasks", params={"status": "pending,in_progress"})
        tasks = resp.json()["tasks"]
        assert len(tasks) == 2
        statuses = {t["status"] for t in tasks}
        assert statuses == {"pending", "in_progress"}

    def test_results_sorted_newest_first(self, client):
        client.post("/api/agents/agent-s/tasks", json={
            "task_id": "first", "subject": "First",
        })
        client.post("/api/agents/agent-s/tasks", json={
            "task_id": "second", "subject": "Second",
        })

        resp = client.get("/api/agents/agent-s/tasks")
        tasks = resp.json()["tasks"]
        assert tasks[0]["task_id"] == "second"
        assert tasks[1]["task_id"] == "first"
