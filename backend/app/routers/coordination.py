"""Agent coordination: inter-agent messaging, task queue, and directives."""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import (
    Agent, AgentMessage, AgentDirective, AgentAction, Task, Project,
    AgentStatus, MessageStatus, DirectiveType, TaskStatus, TaskPriority,
)
from app.schemas import (
    AgentMessageCreate, AgentMessageResponse,
    AgentDirectiveCreate, AgentDirectiveResponse,
    TaskClaimRequest, TaskQueueItem,
    AgentBrief, AgentActionResponse,
)
from app.auth import get_current_user
from app.websocket import manager
from app.routers.agents import get_agent_by_key, _agent_is_alive

router = APIRouter(prefix="/agents", tags=["coordination"])


# ============ Inter-Agent Messaging ============

@router.post("/{agent_id}/messages", response_model=AgentMessageResponse)
async def send_message(
    agent_id: int,
    data: AgentMessageCreate,
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    db: Session = Depends(get_db),
):
    """Send a message from one agent to another. Authenticated by sender's API key."""
    sender = get_agent_by_key(db, x_agent_key)
    if sender.id != agent_id:
        raise HTTPException(status_code=403, detail="Key does not match agent")

    recipient = db.query(Agent).filter(Agent.id == data.recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient agent not found")

    thread_id = data.thread_id or str(uuid.uuid4())

    msg = AgentMessage(
        sender_id=agent_id,
        recipient_id=data.recipient_id,
        thread_id=thread_id,
        message_type=data.message_type,
        subject=data.subject,
        body=data.body,
        in_reply_to=data.in_reply_to,
        metadata_json=json.dumps(data.metadata) if data.metadata else None,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    response = AgentMessageResponse(
        id=msg.id,
        sender_id=msg.sender_id,
        sender_name=sender.name,
        recipient_id=msg.recipient_id,
        recipient_name=recipient.name,
        thread_id=msg.thread_id,
        message_type=msg.message_type,
        subject=msg.subject,
        body=msg.body,
        status=msg.status,
        in_reply_to=msg.in_reply_to,
        metadata=data.metadata,
        created_at=msg.created_at,
        read_at=msg.read_at,
    )

    # Broadcast to WebSocket so dashboard sees messages in real-time
    await manager.broadcast({
        "type": "agent_message",
        "message": response.model_dump(mode="json"),
    })

    return response


@router.get("/{agent_id}/messages/inbox", response_model=list[AgentMessageResponse])
async def get_inbox(
    agent_id: int,
    status: Optional[MessageStatus] = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get messages received by an agent. JWT auth (dashboard) or agent key."""
    query = (
        db.query(AgentMessage)
        .options(joinedload(AgentMessage.sender), joinedload(AgentMessage.recipient))
        .filter(AgentMessage.recipient_id == agent_id)
    )
    if status:
        query = query.filter(AgentMessage.status == status)
    messages = query.order_by(AgentMessage.created_at.desc()).limit(limit).all()

    return [_msg_to_response(m) for m in messages]


@router.get("/{agent_id}/messages/outbox", response_model=list[AgentMessageResponse])
async def get_outbox(
    agent_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get messages sent by an agent."""
    messages = (
        db.query(AgentMessage)
        .options(joinedload(AgentMessage.sender), joinedload(AgentMessage.recipient))
        .filter(AgentMessage.sender_id == agent_id)
        .order_by(AgentMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_msg_to_response(m) for m in messages]


@router.post("/{agent_id}/messages/{message_id}/ack")
async def acknowledge_message(
    agent_id: int,
    message_id: int,
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    db: Session = Depends(get_db),
):
    """Mark a message as read. Agent key auth."""
    agent = get_agent_by_key(db, x_agent_key)
    if agent.id != agent_id:
        raise HTTPException(status_code=403, detail="Key does not match agent")

    msg = db.query(AgentMessage).filter(
        AgentMessage.id == message_id,
        AgentMessage.recipient_id == agent_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    msg.status = MessageStatus.READ
    msg.read_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.get("/messages/threads/{thread_id}", response_model=list[AgentMessageResponse])
async def get_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Get all messages in a thread."""
    messages = (
        db.query(AgentMessage)
        .options(joinedload(AgentMessage.sender), joinedload(AgentMessage.recipient))
        .filter(AgentMessage.thread_id == thread_id)
        .order_by(AgentMessage.created_at.asc())
        .all()
    )
    return [_msg_to_response(m) for m in messages]


# ============ Agent Directives (User → Agent) ============

@router.post("/{agent_id}/directives", response_model=AgentDirectiveResponse)
async def create_directive(
    agent_id: int,
    data: AgentDirectiveCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Send a directive to an agent from the dashboard. JWT auth."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    directive = AgentDirective(
        agent_id=agent_id,
        directive_type=data.directive_type,
        payload=json.dumps(data.payload) if data.payload else None,
        issued_by=user.id,
    )
    db.add(directive)

    # Auto-apply status changes for pause/resume/cancel
    if data.directive_type == DirectiveType.PAUSE:
        agent.status = AgentStatus.WAITING
    elif data.directive_type == DirectiveType.RESUME:
        agent.status = AgentStatus.WORKING
    elif data.directive_type == DirectiveType.CANCEL:
        agent.current_task_id = None
        agent.status = AgentStatus.IDLE

    # Log as agent action for feed visibility
    action = AgentAction(
        agent_id=agent_id,
        action_type="directive",
        summary=f"Directive: {data.directive_type.value}",
        detail=json.dumps(data.payload) if data.payload else None,
        metadata_json=json.dumps({
            "directive_type": data.directive_type.value,
            "issued_by": user.id,
            "issued_by_name": user.username,
        }),
    )
    db.add(action)
    db.commit()
    db.refresh(directive)
    db.refresh(action)

    payload = None
    if directive.payload:
        try:
            payload = json.loads(directive.payload)
        except (json.JSONDecodeError, TypeError):
            pass

    response = AgentDirectiveResponse(
        id=directive.id,
        agent_id=directive.agent_id,
        directive_type=directive.directive_type,
        payload=payload,
        issued_by=directive.issued_by,
        acknowledged=directive.acknowledged,
        acknowledged_at=directive.acknowledged_at,
        created_at=directive.created_at,
    )

    # Broadcast directive and status change
    await manager.broadcast({
        "type": "agent_directive",
        "directive": response.model_dump(mode="json"),
    })
    await manager.broadcast({
        "type": "agent_action",
        "action": AgentActionResponse(
            id=action.id,
            agent_id=action.agent_id,
            agent_name=agent.name,
            agent_type=agent.agent_type,
            action_type=action.action_type,
            summary=action.summary,
            detail=action.detail,
            task_id=None,
            metadata=json.loads(action.metadata_json) if action.metadata_json else None,
            created_at=action.created_at,
        ).model_dump(mode="json"),
    })

    return response


@router.get("/{agent_id}/directives", response_model=list[AgentDirectiveResponse])
async def list_directives(
    agent_id: int,
    pending_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """List directives for an agent."""
    query = db.query(AgentDirective).filter(AgentDirective.agent_id == agent_id)
    if pending_only:
        query = query.filter(AgentDirective.acknowledged == False)
    directives = query.order_by(AgentDirective.created_at.desc()).limit(limit).all()

    results = []
    for d in directives:
        payload = None
        if d.payload:
            try:
                payload = json.loads(d.payload)
            except (json.JSONDecodeError, TypeError):
                pass
        results.append(AgentDirectiveResponse(
            id=d.id,
            agent_id=d.agent_id,
            directive_type=d.directive_type,
            payload=payload,
            issued_by=d.issued_by,
            acknowledged=d.acknowledged,
            acknowledged_at=d.acknowledged_at,
            created_at=d.created_at,
        ))
    return results


@router.post("/{agent_id}/directives/{directive_id}/ack")
async def acknowledge_directive(
    agent_id: int,
    directive_id: int,
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    db: Session = Depends(get_db),
):
    """Agent acknowledges a directive. Agent key auth."""
    agent = get_agent_by_key(db, x_agent_key)
    if agent.id != agent_id:
        raise HTTPException(status_code=403, detail="Key does not match agent")

    directive = db.query(AgentDirective).filter(
        AgentDirective.id == directive_id,
        AgentDirective.agent_id == agent_id,
    ).first()
    if not directive:
        raise HTTPException(status_code=404, detail="Directive not found")

    directive.acknowledged = True
    directive.acknowledged_at = datetime.now(timezone.utc)
    db.commit()

    await manager.broadcast({
        "type": "directive_acknowledged",
        "agent_id": agent_id,
        "directive_id": directive_id,
    })

    return {"ok": True}


# ============ Task Queue ============

@router.get("/queue", response_model=list[TaskQueueItem])
async def list_task_queue(
    project_id: Optional[int] = None,
    priority: Optional[TaskPriority] = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """List unassigned tasks available for agents to claim.
    Tasks are 'available' if status is TODO or BACKLOG and agent_id is NULL."""
    query = (
        db.query(Task)
        .options(joinedload(Task.project))
        .filter(
            Task.agent_id.is_(None),
            Task.parent_id.is_(None),  # Only top-level tasks
            Task.status.in_([TaskStatus.BACKLOG, TaskStatus.TODO]),
        )
    )
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if priority:
        query = query.filter(Task.priority == priority)

    # Priority order: urgent > high > medium > low
    priority_order = [TaskPriority.URGENT, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW]
    tasks = query.order_by(
        Task.priority.asc(),  # enum order matches urgency
        Task.created_at.asc(),
    ).limit(limit).all()

    return [TaskQueueItem(
        id=t.id,
        title=t.title,
        description=t.description,
        status=t.status,
        priority=t.priority,
        project_id=t.project_id,
        project_name=t.project.name if t.project else None,
        required_capabilities=[],  # Can be extended via task metadata
        estimated_hours=t.estimated_hours,
        created_at=t.created_at,
    ) for t in tasks]


@router.post("/queue/claim")
async def claim_task(
    data: TaskClaimRequest,
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    db: Session = Depends(get_db),
):
    """Agent claims the highest-priority unassigned task matching its capabilities.
    Returns the claimed task or 204 if nothing available."""
    agent = get_agent_by_key(db, x_agent_key)

    if not _agent_is_alive(agent):
        raise HTTPException(status_code=409, detail="Agent must send heartbeat before claiming tasks")

    query = (
        db.query(Task)
        .options(joinedload(Task.project))
        .filter(
            Task.agent_id.is_(None),
            Task.parent_id.is_(None),
            Task.status.in_([TaskStatus.BACKLOG, TaskStatus.TODO]),
        )
    )
    if data.project_id:
        query = query.filter(Task.project_id == data.project_id)
    if data.priorities:
        query = query.filter(Task.priority.in_(data.priorities))

    task = query.order_by(Task.priority.asc(), Task.created_at.asc()).first()

    if not task:
        raise HTTPException(status_code=204, detail="No tasks available")

    # Claim it
    task.agent_id = agent.id
    task.status = TaskStatus.IN_PROGRESS
    agent.current_task_id = task.id
    agent.status = AgentStatus.WORKING

    # Log the claim
    action = AgentAction(
        agent_id=agent.id,
        action_type="task_update",
        summary=f"Claimed task: {task.title}",
        task_id=task.id,
        metadata_json=json.dumps({
            "action": "claim",
            "task_id": task.id,
            "project_id": task.project_id,
        }),
    )
    db.add(action)
    db.commit()
    db.refresh(task)
    db.refresh(action)

    await manager.broadcast({
        "type": "task_claimed",
        "agent_id": agent.id,
        "agent_name": agent.name,
        "task_id": task.id,
        "task_title": task.title,
    })
    await manager.broadcast({
        "type": "agent_action",
        "action": AgentActionResponse(
            id=action.id,
            agent_id=action.agent_id,
            agent_name=agent.name,
            agent_type=agent.agent_type,
            action_type=action.action_type,
            summary=action.summary,
            detail=None,
            task_id=task.id,
            metadata=json.loads(action.metadata_json),
            created_at=action.created_at,
        ).model_dump(mode="json"),
    })

    return TaskQueueItem(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        project_id=task.project_id,
        project_name=task.project.name if task.project else None,
        required_capabilities=[],
        estimated_hours=task.estimated_hours,
        created_at=task.created_at,
    )


@router.post("/queue/release")
async def release_task(
    task_id: int = Query(...),
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    db: Session = Depends(get_db),
):
    """Agent releases a claimed task back to the queue."""
    agent = get_agent_by_key(db, x_agent_key)

    task = db.query(Task).filter(Task.id == task_id, Task.agent_id == agent.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not claimed by this agent")

    task.agent_id = None
    task.status = TaskStatus.TODO
    if agent.current_task_id == task_id:
        agent.current_task_id = None
        agent.status = AgentStatus.IDLE

    action = AgentAction(
        agent_id=agent.id,
        action_type="task_update",
        summary=f"Released task: {task.title}",
        task_id=task.id,
        metadata_json=json.dumps({"action": "release", "task_id": task.id}),
    )
    db.add(action)
    db.commit()

    await manager.broadcast({
        "type": "task_released",
        "agent_id": agent.id,
        "agent_name": agent.name,
        "task_id": task.id,
        "task_title": task.title,
    })

    return {"ok": True}


@router.post("/queue/complete")
async def complete_task(
    task_id: int = Query(...),
    x_agent_key: str = Header(..., alias="X-Agent-Key"),
    db: Session = Depends(get_db),
):
    """Agent marks a claimed task as complete."""
    agent = get_agent_by_key(db, x_agent_key)

    task = db.query(Task).filter(Task.id == task_id, Task.agent_id == agent.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not claimed by this agent")

    task.status = TaskStatus.DONE
    task.completed_at = datetime.now(timezone.utc)
    if agent.current_task_id == task_id:
        agent.current_task_id = None
        agent.status = AgentStatus.IDLE

    action = AgentAction(
        agent_id=agent.id,
        action_type="task_update",
        summary=f"Completed task: {task.title}",
        task_id=task.id,
        metadata_json=json.dumps({"action": "complete", "task_id": task.id}),
    )
    db.add(action)
    db.commit()

    await manager.broadcast({
        "type": "task_completed",
        "agent_id": agent.id,
        "agent_name": agent.name,
        "task_id": task.id,
        "task_title": task.title,
    })

    return {"ok": True}


# ============ Helpers ============

def _msg_to_response(m: AgentMessage) -> AgentMessageResponse:
    meta = None
    if m.metadata_json:
        try:
            meta = json.loads(m.metadata_json)
        except (json.JSONDecodeError, TypeError):
            pass
    return AgentMessageResponse(
        id=m.id,
        sender_id=m.sender_id,
        sender_name=m.sender.name if m.sender else None,
        recipient_id=m.recipient_id,
        recipient_name=m.recipient.name if m.recipient else None,
        thread_id=m.thread_id,
        message_type=m.message_type,
        subject=m.subject,
        body=m.body,
        status=m.status,
        in_reply_to=m.in_reply_to,
        metadata=meta,
        created_at=m.created_at,
        read_at=m.read_at,
    )
