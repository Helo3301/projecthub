#!/usr/bin/env python3
"""
Agent Runner Service — runs on the HOST (not in Docker).

Spawns Claude Code processes and streams their I/O over WebSocket.
Validates auth by calling ProjectHub API.

Usage:
    python3 runner_service.py [--port 8001]
"""

import asyncio
import json
import os
import signal
import sys
import argparse
from datetime import datetime, timezone
from typing import Optional

try:
    import aiohttp
    from aiohttp import web
except ImportError:
    print("Install aiohttp: pip install aiohttp")
    sys.exit(1)

CLAUDE_PATH = os.path.expanduser("~/.claude/local/claude")
MAX_RUNNING = 5
PROJECTHUB_API = os.environ.get("PROJECTHUB_API", "http://localhost:8000")

# In-memory store: agent_id -> { process, session_id, cwd, started_at }
_running: dict[int, dict] = {}


async def validate_jwt(token: str) -> bool:
    """Validate JWT by calling ProjectHub /api/auth/me."""
    try:
        import urllib.request
        req = urllib.request.Request(
            f"{PROJECTHUB_API}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception:
        return False


async def websocket_handler(request):
    """WebSocket handler for agent terminal sessions."""
    token = request.query.get("token")
    if not token or not await validate_jwt(token):
        return web.Response(status=401, text="Invalid token")

    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    await send_runner_status(ws)

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            try:
                data = json.loads(msg.data)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "agent_id": 0, "message": "Invalid JSON"})
                continue

            msg_type = data.get("type", "")
            agent_id = data.get("agent_id", 0)

            if msg_type == "spawn":
                await handle_spawn(ws, agent_id, data)
            elif msg_type == "prompt":
                await handle_prompt(ws, agent_id, data)
            elif msg_type == "kill":
                await handle_kill(ws, agent_id)
            elif msg_type == "status":
                await send_runner_status(ws)
            else:
                await ws.send_json({"type": "error", "agent_id": agent_id,
                                    "message": f"Unknown: {msg_type}"})
        elif msg.type == aiohttp.WSMsgType.ERROR:
            break

    return ws


async def send_runner_status(ws):
    agents = []
    for aid, info in _running.items():
        proc = info.get("process")
        agents.append({
            "agent_id": aid,
            "session_id": info.get("session_id"),
            "cwd": info.get("cwd"),
            "running": proc is not None and proc.returncode is None,
        })
    await ws.send_json({
        "type": "runner_status",
        "running": len(_running),
        "max": MAX_RUNNING,
        "agents": agents,
    })


async def handle_spawn(ws, agent_id: int, msg: dict):
    if len(_running) >= MAX_RUNNING and agent_id not in _running:
        await ws.send_json({"type": "error", "agent_id": agent_id,
                            "message": f"Max {MAX_RUNNING} agents. Kill one first."})
        return

    if agent_id in _running:
        proc = _running[agent_id].get("process")
        if proc and proc.returncode is None:
            await ws.send_json({"type": "error", "agent_id": agent_id,
                                "message": "Already running. Kill first or send prompt."})
            return

    cwd = msg.get("cwd", os.path.expanduser("~"))
    prompt = msg.get("prompt", "")
    if not prompt:
        await ws.send_json({"type": "error", "agent_id": agent_id, "message": "Prompt required"})
        return
    if not os.path.isdir(cwd):
        await ws.send_json({"type": "error", "agent_id": agent_id, "message": f"Dir not found: {cwd}"})
        return

    await ws.send_json({"type": "status", "agent_id": agent_id, "status": "spawning"})

    try:
        # Use create_subprocess_exec — safe, no shell injection
        proc = await asyncio.create_subprocess_exec(
            CLAUDE_PATH, "-p", prompt,
            "--output-format", "stream-json", "--verbose",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            preexec_fn=os.setsid,
        )
        _running[agent_id] = {
            "process": proc,
            "session_id": None,
            "cwd": cwd,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }

        await ws.send_json({"type": "status", "agent_id": agent_id, "status": "running"})
        session_id = await stream_output(ws, proc, agent_id)
        _running[agent_id]["session_id"] = session_id

        await ws.send_json({"type": "status", "agent_id": agent_id, "status": "complete",
                            "session_id": session_id})
        await send_runner_status(ws)

    except FileNotFoundError:
        await ws.send_json({"type": "error", "agent_id": agent_id,
                            "message": f"claude not found at {CLAUDE_PATH}"})
    except Exception as e:
        await ws.send_json({"type": "error", "agent_id": agent_id, "message": str(e)})


async def handle_prompt(ws, agent_id: int, msg: dict):
    if agent_id not in _running:
        await ws.send_json({"type": "error", "agent_id": agent_id, "message": "Not spawned yet."})
        return

    info = _running[agent_id]
    old_proc = info.get("process")
    if old_proc and old_proc.returncode is None:
        await ws.send_json({"type": "error", "agent_id": agent_id,
                            "message": "Still processing. Wait for completion."})
        return

    session_id = info.get("session_id")
    cwd = info.get("cwd", os.path.expanduser("~"))
    prompt = msg.get("text", "")
    if not prompt:
        await ws.send_json({"type": "error", "agent_id": agent_id, "message": "Text required"})
        return

    await ws.send_json({"type": "status", "agent_id": agent_id, "status": "running"})

    try:
        cmd = [CLAUDE_PATH, "-p", prompt, "--output-format", "stream-json", "--verbose"]
        if session_id:
            cmd.extend(["--resume", session_id])

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            preexec_fn=os.setsid,
        )
        info["process"] = proc

        new_sid = await stream_output(ws, proc, agent_id)
        if new_sid:
            info["session_id"] = new_sid

        await ws.send_json({"type": "status", "agent_id": agent_id, "status": "complete",
                            "session_id": info.get("session_id")})

    except Exception as e:
        await ws.send_json({"type": "error", "agent_id": agent_id, "message": str(e)})


async def handle_kill(ws, agent_id: int):
    if agent_id not in _running:
        await ws.send_json({"type": "status", "agent_id": agent_id, "status": "not_running"})
        return

    info = _running[agent_id]
    proc = info.get("process")
    if proc and proc.returncode is None:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except (ProcessLookupError, OSError):
            pass
        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            proc.kill()

    del _running[agent_id]
    await ws.send_json({"type": "status", "agent_id": agent_id, "status": "killed"})
    await send_runner_status(ws)


async def stream_output(ws, proc, agent_id: int) -> Optional[str]:
    """Stream claude stdout to WebSocket. Returns session_id."""
    session_id = None

    try:
        async for line in proc.stdout:
            text = line.decode("utf-8", errors="replace").strip()
            if not text:
                continue

            try:
                chunk = json.loads(text)
            except json.JSONDecodeError:
                await ws.send_json({"type": "chunk", "agent_id": agent_id, "text": text + "\n"})
                continue

            ct = chunk.get("type", "")

            # Capture session_id
            if ct == "system" and chunk.get("session_id"):
                session_id = chunk["session_id"]
            elif ct == "result":
                sid = chunk.get("session_id")
                if sid:
                    session_id = sid
                result_text = chunk.get("result", "")
                if result_text and isinstance(result_text, str):
                    await ws.send_json({"type": "chunk", "agent_id": agent_id, "text": result_text})
            elif ct == "assistant":
                for block in chunk.get("message", {}).get("content", []):
                    if block.get("type") == "text" and block.get("text"):
                        await ws.send_json({"type": "chunk", "agent_id": agent_id,
                                            "text": block["text"]})
            elif ct == "content_block_delta":
                delta = chunk.get("delta", {})
                if delta.get("type") == "text_delta" and delta.get("text"):
                    await ws.send_json({"type": "chunk", "agent_id": agent_id,
                                        "text": delta["text"]})
    except Exception as e:
        await ws.send_json({"type": "error", "agent_id": agent_id, "message": f"Stream: {e}"})

    try:
        await asyncio.wait_for(proc.wait(), timeout=600)
    except asyncio.TimeoutError:
        proc.kill()

    return session_id


async def status_handler(request):
    """HTTP GET /status."""
    agents = []
    for aid, info in _running.items():
        proc = info.get("process")
        agents.append({"agent_id": aid, "running": proc is not None and proc.returncode is None})
    return web.json_response({
        "status": "healthy",
        "running_agents": len(_running),
        "max_agents": MAX_RUNNING,
        "agents": agents,
    })


def main():
    parser = argparse.ArgumentParser(description="Agent Runner Service")
    parser.add_argument("--port", type=int, default=8001, help="Port (default 8001)")
    parser.add_argument("--host", default="0.0.0.0", help="Host (default 0.0.0.0)")
    args = parser.parse_args()

    app = web.Application()
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/status", status_handler)

    print(f"Agent Runner on {args.host}:{args.port}")
    print(f"  Claude: {CLAUDE_PATH}")
    print(f"  WebSocket: ws://{args.host}:{args.port}/ws?token=<jwt>")

    web.run_app(app, host=args.host, port=args.port, print=None)


if __name__ == "__main__":
    main()
