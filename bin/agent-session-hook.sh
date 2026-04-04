#!/usr/bin/env bash
# agent-session-hook.sh — Claude Code SessionStart hook
# Registers this agent session with ProjectHub and forks the background service.
# MUST always exit 0 so Claude Code is never blocked.
set -euo pipefail

PROJECTHUB_API="${PROJECTHUB_API:-http://localhost:8000}"
STATE_DIR="$HOME/.claude/projecthub"
LOG_FILE="$STATE_DIR/session-hook.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------- helpers ----------
log() { echo "[$(date -Iseconds)] $*" >> "$LOG_FILE" 2>/dev/null || true; }

fail_gracefully() {
    log "ERROR: $1"
    # Output minimal valid JSON so Claude Code is happy
    cat <<'ENDJSON'
{"hookSpecificOutput":{"additionalContext":"ProjectHub agent registration failed — running without coordination."}}
ENDJSON
    exit 0
}

# ---------- setup ----------
mkdir -p "$STATE_DIR" 2>/dev/null || true

# ---------- 1. read STDIN JSON ----------
INPUT_JSON="$(cat)" || INPUT_JSON="{}"
log "Received input: $INPUT_JSON"

SESSION_ID="$(echo "$INPUT_JSON" | jq -r '.session_id // empty' 2>/dev/null)" \
    || fail_gracefully "jq not available or invalid input JSON"

if [[ -z "$SESSION_ID" ]]; then
    fail_gracefully "No session_id in input JSON"
fi

SESSION_ID_SHORT="${SESSION_ID:0:12}"
log "Session: $SESSION_ID (short: $SESSION_ID_SHORT)"

# ---------- 2. get JWT ----------
JWT="${PROJECTHUB_JWT:-}"

if [[ -z "$JWT" ]]; then
    CREDS_FILE="$HOME/.projecthub/credentials.json"
    if [[ ! -f "$CREDS_FILE" ]]; then
        fail_gracefully "No PROJECTHUB_JWT and no $CREDS_FILE found"
    fi

    PH_USER="$(jq -r '.username // empty' "$CREDS_FILE" 2>/dev/null)"
    PH_PASS="$(jq -r '.password // empty' "$CREDS_FILE" 2>/dev/null)"

    if [[ -z "$PH_USER" || -z "$PH_PASS" ]]; then
        fail_gracefully "Missing username/password in $CREDS_FILE"
    fi

    LOGIN_RESP="$(curl -s -m 5 -X POST \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${PH_USER}&password=${PH_PASS}" \
        "${PROJECTHUB_API}/api/auth/login" 2>/dev/null)" \
        || fail_gracefully "Login request failed"

    JWT="$(echo "$LOGIN_RESP" | jq -r '.token // .access_token // empty' 2>/dev/null)"
    if [[ -z "$JWT" ]]; then
        fail_gracefully "Could not extract JWT from login response: $LOGIN_RESP"
    fi
    log "Obtained JWT via login"
fi

# ---------- 3. register agent ----------
REGISTER_BODY="$(jq -n \
    --arg name "claude-$SESSION_ID_SHORT" \
    --arg sid "$SESSION_ID" \
    '{
        name: $name,
        agent_type: "claude_code",
        capabilities: ["coding","testing","review"],
        session_id: $sid
    }')"

REGISTER_FULL="$(curl -s -m 5 -w '\n%{http_code}' \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT" \
    -d "$REGISTER_BODY" \
    "${PROJECTHUB_API}/api/agents/register" 2>/dev/null)" \
    || fail_gracefully "Register request failed"

HTTP_STATUS="$(echo "$REGISTER_FULL" | tail -1)"
REGISTER_BODY_RESP="$(echo "$REGISTER_FULL" | sed '$d')"

log "Register response ($HTTP_STATUS): $REGISTER_BODY_RESP"

if [[ "$HTTP_STATUS" == "409" ]]; then
    log "WARNING: Agent limit reached (409). Continuing without registration."
    # Try to extract any agent_id from the response anyway
    AGENT_ID="$(echo "$REGISTER_BODY_RESP" | jq -r '.id // .agent_id // empty' 2>/dev/null)"
    API_KEY=""
elif [[ "$HTTP_STATUS" =~ ^2 ]]; then
    AGENT_ID="$(echo "$REGISTER_BODY_RESP" | jq -r '.id // .agent_id // empty' 2>/dev/null)"
    API_KEY="$(echo "$REGISTER_BODY_RESP" | jq -r '.api_key // empty' 2>/dev/null)"
else
    fail_gracefully "Registration failed with HTTP $HTTP_STATUS: $REGISTER_BODY_RESP"
fi

if [[ -z "$AGENT_ID" ]]; then
    fail_gracefully "No agent_id in registration response"
fi

log "Registered agent: $AGENT_ID"

# ---------- 4. save credentials ----------
echo "$AGENT_ID" > "$STATE_DIR/agent-${SESSION_ID}.id"

if [[ -n "$API_KEY" ]]; then
    echo "$API_KEY" > "$STATE_DIR/agent-${SESSION_ID}.key"
    chmod 600 "$STATE_DIR/agent-${SESSION_ID}.key"
fi

echo "$JWT" > "$STATE_DIR/agent-${SESSION_ID}.jwt"
chmod 600 "$STATE_DIR/agent-${SESSION_ID}.jwt"

# ---------- 5. fork background service ----------
if [[ -x "$SCRIPT_DIR/agent-background-service.sh" ]]; then
    nohup "$SCRIPT_DIR/agent-background-service.sh" \
        "$AGENT_ID" "$SESSION_ID" "$API_KEY" "$JWT" \
        >> "$STATE_DIR/background-${SESSION_ID}.log" 2>&1 &
    disown
    log "Background service forked (PID $!)"
else
    log "WARNING: agent-background-service.sh not found or not executable at $SCRIPT_DIR"
fi

# ---------- 6. output hook JSON ----------
cat <<ENDJSON
{"hookSpecificOutput":{"additionalContext":"ProjectHub agent registered (${AGENT_ID}). Heartbeat and directive polling active. Check ~/.claude/projecthub/directives/ for incoming directives."}}
ENDJSON

exit 0
