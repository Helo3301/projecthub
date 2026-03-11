"""
ProjectHub Agent SDK — lightweight client for agent registration and action logging.

Usage:
    from agent_sdk import AgentClient

    client = AgentClient(
        base_url="http://localhost:3030/api",
        jwt_token="<your-jwt>",  # for registration
    )

    # Register (returns API key, shown once)
    api_key = client.register("my-agent", agent_type="claude_code", capabilities=["coding", "testing"])

    # Or use an existing key
    client = AgentClient(base_url="http://localhost:3030/api", agent_key="<api-key>", agent_id=1)

    # Log actions
    client.action("tool_call", "Reading file /src/main.py", detail="contents...")
    client.action("decision", "Found bug in auth logic")
    client.action("github_pr", "Created PR #42: Fix auth", metadata={"pr_url": "..."})

    # Heartbeat (call periodically to stay "alive")
    client.heartbeat(status="working")
"""

import json
import time
import threading
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from typing import Optional


class AgentClient:
    """Minimal HTTP client for the ProjectHub Agent API. No dependencies beyond stdlib."""

    def __init__(
        self,
        base_url: str = "http://localhost:3030/api",
        jwt_token: Optional[str] = None,
        agent_key: Optional[str] = None,
        agent_id: Optional[int] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.jwt_token = jwt_token
        self.agent_key = agent_key
        self.agent_id = agent_id
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._heartbeat_stop = threading.Event()

    def _request(self, method: str, path: str, body: Optional[dict] = None, use_agent_key: bool = False) -> dict:
        url = f"{self.base_url}/agents{path}"
        data = json.dumps(body).encode() if body else None
        headers = {"Content-Type": "application/json"}

        if use_agent_key and self.agent_key:
            headers["X-Agent-Key"] = self.agent_key
        elif self.jwt_token:
            headers["Authorization"] = f"Bearer {self.jwt_token}"

        req = Request(url, data=data, headers=headers, method=method)
        try:
            with urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        except HTTPError as e:
            error_body = e.read().decode() if e.fp else str(e)
            raise RuntimeError(f"API error {e.code}: {error_body}") from e
        except URLError as e:
            raise RuntimeError(f"Connection error: {e.reason}") from e

    def register(
        self,
        name: str,
        agent_type: str = "claude_code",
        capabilities: Optional[list[str]] = None,
        session_id: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> str:
        """Register a new agent. Returns the API key (shown only once). Requires jwt_token."""
        body = {
            "name": name,
            "agent_type": agent_type,
            "capabilities": capabilities or [],
        }
        if session_id:
            body["session_id"] = session_id
        if metadata:
            body["metadata"] = metadata

        result = self._request("POST", "/register", body)
        self.agent_id = result["id"]
        self.agent_key = result["api_key"]
        return result["api_key"]

    def heartbeat(self, status: Optional[str] = None, current_task_id: Optional[int] = None) -> None:
        """Send a heartbeat. Call every 30-60s to stay 'alive'."""
        if not self.agent_id:
            raise RuntimeError("No agent_id set. Register first or pass agent_id to constructor.")
        body: dict = {}
        if status:
            body["status"] = status
        if current_task_id is not None:
            body["current_task_id"] = current_task_id
        self._request("POST", f"/{self.agent_id}/heartbeat", body, use_agent_key=True)

    def action(
        self,
        action_type: str,
        summary: str,
        detail: Optional[str] = None,
        task_id: Optional[int] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        """Log an agent action. Returns the created action."""
        if not self.agent_id:
            raise RuntimeError("No agent_id set. Register first or pass agent_id to constructor.")
        body: dict = {
            "action_type": action_type,
            "summary": summary,
        }
        if detail:
            body["detail"] = detail
        if task_id is not None:
            body["task_id"] = task_id
        if metadata:
            body["metadata"] = metadata
        return self._request("POST", f"/{self.agent_id}/actions", body, use_agent_key=True)

    def start_heartbeat(self, interval: int = 30, status: str = "working") -> None:
        """Start a background thread that sends heartbeats every `interval` seconds."""
        self._heartbeat_stop.clear()

        def _loop():
            while not self._heartbeat_stop.wait(interval):
                try:
                    self.heartbeat(status=status)
                except Exception:
                    pass  # silently retry on next interval

        self._heartbeat_thread = threading.Thread(target=_loop, daemon=True)
        self._heartbeat_thread.start()

    def stop_heartbeat(self) -> None:
        """Stop the background heartbeat thread."""
        self._heartbeat_stop.set()
        if self._heartbeat_thread:
            self._heartbeat_thread.join(timeout=5)
            self._heartbeat_thread = None

    def offline(self) -> None:
        """Mark agent as offline and stop heartbeats."""
        self.stop_heartbeat()
        try:
            self.heartbeat(status="offline")
        except Exception:
            pass


if __name__ == "__main__":
    import sys
    import os

    # Demo: register and send test actions
    base = os.environ.get("PROJECTHUB_URL", "http://localhost:3030/api")
    jwt = os.environ.get("PROJECTHUB_JWT", "")

    if not jwt:
        print("Set PROJECTHUB_JWT environment variable to a valid JWT token.")
        print("Get one by logging in: curl -X POST http://localhost:3030/api/auth/login \\")
        print('  -H "Content-Type: application/x-www-form-urlencoded" -d "username=tim&password=demo123"')
        sys.exit(1)

    client = AgentClient(base_url=base, jwt_token=jwt)

    name = f"demo-agent-{int(time.time()) % 10000}"
    print(f"Registering agent '{name}'...")
    api_key = client.register(name, capabilities=["demo", "testing"])
    print(f"  Agent ID: {client.agent_id}")
    print(f"  API Key: {api_key[:8]}...")

    client.heartbeat(status="working")
    print("Heartbeat sent (working)")

    client.action("tool_call", "Reading project structure", detail="ls -la /src/")
    client.action("decision", "Found 3 test files to run")
    client.action("tool_call", "Running pytest", detail="pytest tests/ -v\n\n3 passed, 0 failed")
    client.action("status_change", "All tests passing", metadata={"passed": 3, "failed": 0})
    print("4 actions logged")

    client.heartbeat(status="idle")
    print("Done! Check the dashboard.")
