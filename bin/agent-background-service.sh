#!/usr/bin/env bash
# agent-background-service.sh — Background heartbeat + directive poller
# Usage: agent-background-service.sh <agent_id> <session_id> <api_key> <jwt>
# Runs until SIGTERM/SIGINT or parent process dies.
set -uo pipefail

# ---------- args ----------
AGENT_ID="${1:?agent_id required}"
SESSION_ID="${2:?session_id required}"
API_KEY="${3:-}"
JWT="${4:-}"

PROJECTHUB_API="${PROJECTHUB_API:-http://localhost:8000}"
STATE_DIR="$HOME/.claude/projecthub"
DIRECTIVES_DIR="$STATE_DIR/directives"
PID_FILE="$STATE_DIR/agent-${SESSION_ID}.pid"
STATE_FILE="$STATE_DIR/agent-${SESSION_ID}.state"
LOG_FILE="$STATE_DIR/background-${SESSION_ID}.log"

HEARTBEAT_INTERVAL=30
DIRECTIVE_INTERVAL=15

# ---------- helpers ----------
log() { echo "[$(date -Iseconds)] $*" >&2; }

update_state() {
    cat > "$STATE_FILE" <<EOF
agent_id=$AGENT_ID
session_id=$SESSION_ID
pid=$$
last_heartbeat=${LAST_HEARTBEAT:-never}
last_directive_poll=${LAST_DIRECTIVE_POLL:-never}
updated_at=$(date -Iseconds)
EOF
}

send_heartbeat() {
    local status="${1:-working}"
    local resp
    resp="$(curl -s -m 5 -X POST \
        -H "Content-Type: application/json" \
        -H "X-Agent-Key: $API_KEY" \
        -d "{\"status\":\"$status\"}" \
        "${PROJECTHUB_API}/api/agents/${AGENT_ID}/heartbeat" 2>/dev/null)" || true
    LAST_HEARTBEAT="$(date -Iseconds)"
    log "Heartbeat ($status): $resp"
}

poll_directives() {
    local resp
    resp="$(curl -s -m 5 -X GET \
        -H "Authorization: Bearer $JWT" \
        "${PROJECTHUB_API}/api/agents/${AGENT_ID}/directives?pending_only=true" 2>/dev/null)" \
        || { log "Directive poll failed"; return; }

    LAST_DIRECTIVE_POLL="$(date -Iseconds)"

    # Check if response is a valid JSON array
    local count
    count="$(echo "$resp" | jq 'if type == "array" then length else 0 end' 2>/dev/null)" || count=0

    if [[ "$count" -eq 0 ]]; then
        return
    fi

    log "Got $count pending directive(s)"

    local i directive_id directive_type payload
    for (( i=0; i<count; i++ )); do
        directive_id="$(echo "$resp" | jq -r ".[$i].id // .[$i].directive_id // empty" 2>/dev/null)"
        directive_type="$(echo "$resp" | jq -r ".[$i].type // .[$i].directive_type // empty" 2>/dev/null)"
        payload="$(echo "$resp" | jq -c ".[$i]" 2>/dev/null)"

        if [[ -z "$directive_id" ]]; then
            log "Skipping directive with no id at index $i"
            continue
        fi

        log "Processing directive $directive_id (type: $directive_type)"

        case "$directive_type" in
            message)
                mkdir -p "$DIRECTIVES_DIR"
                echo "$payload" > "$DIRECTIVES_DIR/${directive_id}.json"
                log "Wrote message directive to $DIRECTIVES_DIR/${directive_id}.json"
                ;;
            reassign)
                # Extract task context and write to markdown
                local task_desc task_context
                task_desc="$(echo "$payload" | jq -r '.payload.description // .description // "No description"' 2>/dev/null)"
                task_context="$(echo "$payload" | jq -r '.payload.context // .context // ""' 2>/dev/null)"
                cat > "$STATE_DIR/task-context.md" <<TASKEOF
# Reassigned Task

**Directive ID:** $directive_id
**Received:** $(date -Iseconds)

## Description
$task_desc

## Context
$task_context

## Raw Directive
\`\`\`json
$payload
\`\`\`
TASKEOF
                log "Wrote reassign task context to $STATE_DIR/task-context.md"
                ;;
            *)
                mkdir -p "$DIRECTIVES_DIR"
                echo "$payload" > "$DIRECTIVES_DIR/${directive_id}.json"
                log "Wrote unknown-type directive ($directive_type) to $DIRECTIVES_DIR/${directive_id}.json"
                ;;
        esac

        # Acknowledge the directive
        curl -s -m 5 -X POST \
            -H "Content-Type: application/json" \
            -H "X-Agent-Key: $API_KEY" \
            "${PROJECTHUB_API}/api/agents/${AGENT_ID}/directives/${directive_id}/ack" \
            >/dev/null 2>&1 || log "Failed to ack directive $directive_id"

        log "Acked directive $directive_id"
    done
}

# ---------- setup ----------
mkdir -p "$STATE_DIR" "$DIRECTIVES_DIR" 2>/dev/null || true

# Write PID file
echo $$ > "$PID_FILE"
log "Background service started (PID $$, agent $AGENT_ID)"

# ---------- cleanup on exit ----------
cleanup() {
    log "Shutting down..."
    send_heartbeat "offline"
    rm -f "$PID_FILE"
    log "Cleaned up. Exiting."
    exit 0
}

trap cleanup EXIT SIGTERM SIGINT

# ---------- main loop ----------
# We use a tick counter to interleave heartbeat (every 30s) and directives (every 15s).
# Each tick is 5 seconds of sleep.
# Tick 0: directives
# Tick 3: directives + heartbeat (15s)
# Tick 6: directives + heartbeat (30s)
# Simplified: heartbeat every 6 ticks, directives every 3 ticks, tick = 5s

TICK=0
HEARTBEAT_TICKS=6   # 6 * 5 = 30s
DIRECTIVE_TICKS=3   # 3 * 5 = 15s

# Initial heartbeat and directive poll
send_heartbeat "working"
poll_directives
update_state

while true; do
    sleep 5

    TICK=$(( TICK + 1 ))

    if (( TICK % DIRECTIVE_TICKS == 0 )); then
        poll_directives
    fi

    if (( TICK % HEARTBEAT_TICKS == 0 )); then
        send_heartbeat "working"
    fi

    update_state

    # Reset tick counter to avoid overflow (not really necessary with bash but clean)
    if (( TICK >= 600 )); then
        TICK=0
    fi
done
