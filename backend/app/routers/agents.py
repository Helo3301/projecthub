import json
import secrets
import hashlib
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Agent, AgentAction, AgentStatus, GitHubLink
from app.schemas import (
    AgentRegister, AgentResponse, AgentRegistered, AgentHeartbeat,
    AgentActionCreate, AgentActionResponse, AgentBrief,
    GitHubLinkCreate, GitHubLinkResponse, OrchestratorStatus,
)
from app.auth import get_current_user
from app.websocket import manager

router = APIRouter(prefix="/agents", tags=["agents"])

HEARTBEAT_TIMEOUT_SECONDS = 90
MAX_AGENTS = 5


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def _agent_is_alive(agent: Agent) -> bool:
    if not agent.last_heartbeat:
        return False
    hb = agent.last_heartbeat
    if hb.tzinfo is None:
        hb = hb.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - hb
    return delta.total_seconds() < HEARTBEAT_TIMEOUT_SECONDS


def _to_response(agent: Agent) -> dict:
    caps = []
    if agent.capabilities:
        try:
            caps = json.loads(agent.capabilities)
        except (json.JSONDecodeError, TypeError):
            caps = []
    return AgentResponse(
        id=agent.id,
        name=agent.name,
        agent_type=agent.agent_type,
        status=agent.status,
        capabilities=caps,
        session_id=agent.session_id,
        last_heartbeat=agent.last_heartbeat,
        current_task_id=agent.current_task_id,
        current_task=agent.current_task,
        is_alive=_agent_is_alive(agent),
        created_at=agent.created_at,
    )


def get_agent_by_key(db: Session, api_key: str) -> Agent:
    hashed = _hash_key(api_key)
    agent = db.query(Agent).filter(Agent.api_key == hashed).first()
    if not agent:
        raise HTTPException(status_code=401, detail="Invalid agent API key")
    return agent


# ============ Agent Registration ============

@router.post("/register", response_model=AgentRegistered)
async def register_agent(
    data: AgentRegister,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Register a new agent. Requires JWT auth. Returns the API key (shown only once)."""
    # Enforce MAX_AGENTS limit
    current_count = db.query(Agent).count()
    if current_count >= MAX_AGENTS:
        raise HTTPException(
            status_code=409,
            detail=f"Agent limit reached ({MAX_AGENTS}). Remove an agent before registering a new one.",
        )

    raw_key = secrets.token_urlsafe(32)
    hashed_key = _hash_key(raw_key)

    agent = Agent(
        name=data.name,
        agent_type=data.agent_type,
        capabilities=json.dumps(data.capabilities),
        session_id=data.session_id,
        api_key=hashed_key,
        metadata_json=json.dumps(data.metadata) if data.metadata else None,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)

    await manager.broadcast({
        "type": "agent_registered",
        "agent": AgentBrief(
            id=agent.id, name=agent.name,
            agent_type=agent.agent_type, status=agent.status,
            is_alive=False,
        ).model_dump(mode="json"),
    })

    return AgentRegistered(id=agent.id, name=agent.name, api_key=raw_key)


@router.post("/{agent_id}/heartbeat")
async def heartbeat(
    agent_id: int,
    data: AgentHeartbeat,
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    db: Session = Depends(get_db),
):
    """Agent heartbeat. Updates status and liveness. Key via X-Agent-Key header."""
    agent = get_agent_by_key(db, x_agent_key)
    if agent.id != agent_id:
        raise HTTPException(status_code=403, detail="Key does not match agent")

    agent.last_heartbeat = datetime.now(timezone.utc)
    status_action = None
    if data.status:
        old_status = agent.status
        agent.status = data.status
        if old_status != data.status:
            status_action = AgentAction(
                agent_id=agent.id,
                action_type="status_change",
                summary=f"Status: {old_status.value} → {data.status.value}",
                metadata_json=json.dumps({"from": old_status.value, "to": data.status.value}),
            )
            db.add(status_action)
    if data.current_task_id is not None:
        agent.current_task_id = data.current_task_id
    db.commit()
    db.refresh(agent)
    if status_action:
        db.refresh(status_action)

    await manager.broadcast({
        "type": "heartbeat",
        "agent": AgentBrief(
            id=agent.id, name=agent.name,
            agent_type=agent.agent_type, status=agent.status,
            is_alive=True,
        ).model_dump(mode="json"),
    })

    # Broadcast status change as an agent_action so it appears in the live feed
    if status_action:
        await manager.broadcast({
            "type": "agent_action",
            "action": AgentActionResponse(
                id=status_action.id,
                agent_id=status_action.agent_id,
                agent_name=agent.name,
                agent_type=agent.agent_type,
                action_type=status_action.action_type,
                summary=status_action.summary,
                detail=None,
                task_id=None,
                metadata={"from": json.loads(status_action.metadata_json)["from"],
                          "to": json.loads(status_action.metadata_json)["to"]},
                created_at=status_action.created_at,
            ).model_dump(mode="json"),
        })

    return {"ok": True}


# ============ Agent CRUD (user-facing, JWT auth) ============

@router.get("/", response_model=list[AgentResponse])
def list_agents(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    agents = db.query(Agent).order_by(Agent.created_at.desc()).all()
    return [_to_response(a) for a in agents]


@router.get("/orchestrator/status", response_model=OrchestratorStatus)
def orchestrator_status(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    agents = db.query(Agent).all()
    active = [a for a in agents if _agent_is_alive(a) and a.status != AgentStatus.OFFLINE]
    return OrchestratorStatus(
        active_agents=len(active),
        max_agents=MAX_AGENTS,
        queue_depth=0,
        agents=[AgentBrief(
            id=a.id, name=a.name, agent_type=a.agent_type,
            status=a.status, is_alive=_agent_is_alive(a),
        ) for a in agents],
    )


@router.get("/actions/feed", response_model=list[AgentActionResponse])
def global_action_feed(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Global feed of all agent actions, newest first. Uses JOIN to avoid N+1."""
    from sqlalchemy.orm import joinedload
    actions = (
        db.query(AgentAction)
        .options(joinedload(AgentAction.agent))
        .order_by(AgentAction.created_at.desc())
        .limit(limit)
        .all()
    )
    results = []
    for a in actions:
        meta = None
        if a.metadata_json:
            try:
                meta = json.loads(a.metadata_json)
            except (json.JSONDecodeError, TypeError):
                pass
        results.append(AgentActionResponse(
            id=a.id,
            agent_id=a.agent_id,
            agent_name=a.agent.name if a.agent else None,
            agent_type=a.agent.agent_type if a.agent else None,
            action_type=a.action_type,
            summary=a.summary,
            detail=a.detail,
            task_id=a.task_id,
            metadata=meta,
            created_at=a.created_at,
        ))
    return results


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(agent_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _to_response(agent)


@router.delete("/{agent_id}")
async def deregister_agent(agent_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await manager.broadcast({
        "type": "agent_deregistered",
        "agent_id": agent_id,
        "agent_name": agent.name,
    })

    # Delete orphaned actions before deleting the agent
    db.query(AgentAction).filter(AgentAction.agent_id == agent_id).delete()
    db.delete(agent)
    db.commit()
    return {"ok": True}


# ============ Agent Actions ============

@router.post("/{agent_id}/actions", response_model=AgentActionResponse)
async def create_action(
    agent_id: int,
    data: AgentActionCreate,
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    db: Session = Depends(get_db),
):
    """Agent logs an action (tool call, decision, etc.). Key via X-Agent-Key header."""
    agent = get_agent_by_key(db, x_agent_key)
    if agent.id != agent_id:
        raise HTTPException(status_code=403, detail="Key does not match agent")

    action = AgentAction(
        agent_id=agent_id,
        action_type=data.action_type,
        summary=data.summary,
        detail=data.detail,
        task_id=data.task_id,
        metadata_json=json.dumps(data.metadata) if data.metadata else None,
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
        task_id=action.task_id,
        metadata=data.metadata,
        created_at=action.created_at,
    )

    await manager.broadcast({
        "type": "agent_action",
        "action": response.model_dump(mode="json"),
    })

    return response


@router.get("/{agent_id}/actions", response_model=list[AgentActionResponse])
def list_actions(
    agent_id: int,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    actions = (
        db.query(AgentAction)
        .filter(AgentAction.agent_id == agent_id)
        .order_by(AgentAction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    results = []
    for a in actions:
        meta = None
        if a.metadata_json:
            try:
                meta = json.loads(a.metadata_json)
            except (json.JSONDecodeError, TypeError):
                pass
        results.append(AgentActionResponse(
            id=a.id,
            agent_id=a.agent_id,
            agent_name=agent.name,
            agent_type=agent.agent_type,
            action_type=a.action_type,
            summary=a.summary,
            detail=a.detail,
            task_id=a.task_id,
            metadata=meta,
            created_at=a.created_at,
        ))
    return results


# ============ GitHub Links ============

@router.post("/github-links", response_model=GitHubLinkResponse)
async def create_github_link(
    data: GitHubLinkCreate,
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    db: Session = Depends(get_db),
):
    get_agent_by_key(db, x_agent_key)  # validate key
    link = GitHubLink(
        task_id=data.task_id,
        project_id=data.project_id,
        github_repo=data.github_repo,
        github_type=data.github_type,
        github_id=data.github_id,
        github_url=data.github_url,
        title=data.title,
        state=data.state or "open",
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.get("/github-links/{task_id}", response_model=list[GitHubLinkResponse])
def get_github_links(task_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return db.query(GitHubLink).filter(GitHubLink.task_id == task_id).all()


# ============ WebSocket Live Feed ============

@router.websocket("/ws/feed")
async def websocket_feed(websocket: WebSocket, token: Optional[str] = Query(None)):
    # Validate JWT before accepting the connection
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
    except (JWTError, Exception):
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, ignore client messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
