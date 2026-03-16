"""Agent runner: spawn Claude Code processes and stream I/O over WebSocket."""

import asyncio
import json
import os
import signal
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user

router = APIRouter(prefix="/agents/runner", tags=["runner"])

# In-memory store of running agent processes
# agent_id -> { process, session_id, cwd, started_at }
_running: dict[int, dict] = {}
MAX_RUNNING = 5


@router.get("/status")
async def runner_status(_user=Depends(get_current_user)):
    """Get status of all running agent processes."""
    agents = []
    for agent_id, info in _running.items():
        proc = info.get("process")
        agents.append({
            "agent_id": agent_id,
            "session_id": info.get("session_id"),
            "cwd": info.get("cwd"),
            "running": proc is not None and proc.returncode is None,
            "started_at": info.get("started_at"),
        })
    return {
        "running_agents": len(_running),
        "max_agents": MAX_RUNNING,
        "agents": agents,
    }


@router.websocket("/ws")
async def agent_terminal(websocket: WebSocket, token: Optional[str] = Query(None)):
    """WebSocket terminal for spawning and prompting agents.

    Client sends JSON:
      {"type": "spawn", "agent_id": 5, "cwd": "/path", "prompt": "..."}
      {"type": "prompt", "agent_id": 5, "text": "follow up..."}
      {"type": "kill", "agent_id": 5}

    Server sends JSON:
      {"type": "chunk", "agent_id": 5, "text": "..."}
      {"type": "status", "agent_id": 5, "status": "running|complete|killed|error"}
      {"type": "error", "agent_id": 5, "message": "..."}
      {"type": "runner_status", "running": 3, "max": 5, "agents": [...]}
    """
    # Validate JWT
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return
    try:
        from jose import JWTError, jwt as jose_jwt
        from app.config import get_settings
        settings = get_settings()
        payload = jose_jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("sub") is None:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()

    # Send initial status
    await _send_runner_status(websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "agent_id": 0, "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type", "")
            agent_id = msg.get("agent_id", 0)

            if msg_type == "spawn":
                await _handle_spawn(websocket, agent_id, msg)
            elif msg_type == "prompt":
                await _handle_prompt(websocket, agent_id, msg)
            elif msg_type == "kill":
                await _handle_kill(websocket, agent_id)
            elif msg_type == "status":
                await _send_runner_status(websocket)
            else:
                await websocket.send_json({"type": "error", "agent_id": agent_id, "message": f"Unknown: {msg_type}"})

    except WebSocketDisconnect:
        pass


async def _send_runner_status(ws: WebSocket):
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


async def _handle_spawn(ws: WebSocket, agent_id: int, msg: dict):
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
        proc = await asyncio.create_subprocess_exec(
            "claude", "-p", prompt, "--output-format", "stream-json",
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

        session_id = await _stream_output(ws, proc, agent_id)
        _running[agent_id]["session_id"] = session_id

        await ws.send_json({"type": "status", "agent_id": agent_id, "status": "complete",
                            "session_id": session_id})
        await _send_runner_status(ws)

    except FileNotFoundError:
        await ws.send_json({"type": "error", "agent_id": agent_id,
                            "message": "claude CLI not found"})
    except Exception as e:
        await ws.send_json({"type": "error", "agent_id": agent_id, "message": str(e)})


async def _handle_prompt(ws: WebSocket, agent_id: int, msg: dict):
    if agent_id not in _running:
        await ws.send_json({"type": "error", "agent_id": agent_id,
                            "message": "Not spawned. Send spawn first."})
        return

    info = _running[agent_id]
    old_proc = info.get("process")
    if old_proc and old_proc.returncode is None:
        await ws.send_json({"type": "error", "agent_id": agent_id,
                            "message": "Still processing previous prompt. Wait for completion."})
        return

    session_id = info.get("session_id")
    cwd = info.get("cwd", os.path.expanduser("~"))
    prompt = msg.get("text", "")
    if not prompt:
        await ws.send_json({"type": "error", "agent_id": agent_id, "message": "Text required"})
        return

    await ws.send_json({"type": "status", "agent_id": agent_id, "status": "running"})

    try:
        cmd = ["claude", "-p", prompt, "--output-format", "stream-json"]
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

        new_sid = await _stream_output(ws, proc, agent_id)
        if new_sid:
            info["session_id"] = new_sid

        await ws.send_json({"type": "status", "agent_id": agent_id, "status": "complete",
                            "session_id": info.get("session_id")})

    except Exception as e:
        await ws.send_json({"type": "error", "agent_id": agent_id, "message": str(e)})


async def _handle_kill(ws: WebSocket, agent_id: int):
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
    await _send_runner_status(ws)


async def _stream_output(ws: WebSocket, proc, agent_id: int) -> Optional[str]:
    """Stream claude stdout to WebSocket. Returns session_id if found."""
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

            # Capture session_id from system or result messages
            if ct == "system" and chunk.get("session_id"):
                session_id = chunk["session_id"]
            elif ct == "result":
                sid = chunk.get("session_id")
                if sid:
                    session_id = sid
                # Result text
                result_text = chunk.get("result", "")
                if result_text and isinstance(result_text, str):
                    await ws.send_json({"type": "chunk", "agent_id": agent_id, "text": result_text})

            # Stream content from assistant messages
            elif ct == "assistant":
                for block in chunk.get("message", {}).get("content", []):
                    if block.get("type") == "text" and block.get("text"):
                        await ws.send_json({"type": "chunk", "agent_id": agent_id,
                                            "text": block["text"]})

            # Stream deltas
            elif ct == "content_block_delta":
                delta = chunk.get("delta", {})
                if delta.get("type") == "text_delta" and delta.get("text"):
                    await ws.send_json({"type": "chunk", "agent_id": agent_id,
                                        "text": delta["text"]})

    except Exception:
        pass

    try:
        await asyncio.wait_for(proc.wait(), timeout=600)
    except asyncio.TimeoutError:
        proc.kill()

    # Send stderr if any
    if proc.stderr:
        try:
            stderr_data = await proc.stderr.read()
            if stderr_data:
                err = stderr_data.decode("utf-8", errors="replace").strip()
                if err:
                    await ws.send_json({"type": "error", "agent_id": agent_id, "message": err})
        except Exception:
            pass

    return session_id
