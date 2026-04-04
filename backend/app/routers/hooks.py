"""
HTTP hook endpoints for Claude Code PostToolUse events.

Accepts hook events directly from Claude Code's HTTP hook transport,
looks up the agent by session_id, and logs tool actions.
No JWT required -- session_id from the POST body is sufficient auth
for localhost hooks.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Agent, AgentAction
from app.schemas import ToolActionHookEvent, AgentActionResponse
from app.websocket import manager

router = APIRouter(prefix="/hooks", tags=["hooks"])

# Tools that generate too much noise to log
NOISY_TOOLS = {"Read", "Glob", "Grep", "LS", "Search", "Skill"}


@router.post("/tool-action", status_code=200)
async def tool_action_hook(
    event: ToolActionHookEvent,
    db: Session = Depends(get_db),
):
    """Accept a Claude Code PostToolUse hook event and log it as an agent action."""
    # Skip noisy tools server-side
    if event.tool_name in NOISY_TOOLS:
        return {"ok": True, "skipped": True, "reason": "noisy_tool"}

    # Look up agent by session_id
    agent = db.query(Agent).filter(Agent.session_id == event.session_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Unknown session_id")

    # Build summary from tool name + truncated input
    input_preview = ""
    if event.tool_input:
        raw = json.dumps(event.tool_input) if isinstance(event.tool_input, dict) else str(event.tool_input)
        input_preview = raw[:200]
    summary = f"{event.tool_name}: {input_preview}" if input_preview else event.tool_name

    action = AgentAction(
        agent_id=agent.id,
        action_type="tool_call",
        summary=summary[:500],
        detail=json.dumps(event.tool_input) if event.tool_input else None,
        metadata_json=json.dumps({
            "tool_name": event.tool_name,
            "hook_type": "PostToolUse",
            "session_id": event.session_id,
        }),
    )
    db.add(action)
    db.commit()
    db.refresh(action)

    response = AgentActionResponse(
        id=action.id,
        agent_id=action.agent_id,
        agent_name=agent.name,
        agent_type=agent.agent_type,
        action_type=action.action_type,
        summary=action.summary,
        detail=action.detail,
        task_id=None,
        metadata=json.loads(action.metadata_json),
        created_at=action.created_at,
    )

    await manager.broadcast({
        "type": "agent_action",
        "action": response.model_dump(mode="json"),
    })

    return {"ok": True, "action_id": action.id}
