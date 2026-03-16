#!/usr/bin/env bash
# agent-tool-logger.sh — Claude Code PostToolUse hook
# Logs significant tool calls to the ProjectHub Agent Coordination API.
# Runs on every tool call; must be fast, non-blocking, and always exit 0.

set -o pipefail

# Always exit 0 no matter what
trap 'exit 0' EXIT

ERROR_LOG="$HOME/.claude/projecthub/tool-logger-errors.log"

log_error() {
    echo "[$(date -Iseconds)] $1" >> "$ERROR_LOG" 2>/dev/null
}

# Read JSON from STDIN (Claude Code PostToolUse event)
INPUT_JSON="$(cat)" || exit 0

# Extract tool name early so we can skip noisy tools fast
TOOL_NAME="$(echo "$INPUT_JSON" | jq -r '.tool_name // empty' 2>/dev/null)" || exit 0
[ -z "$TOOL_NAME" ] && exit 0

# Skip noisy/read-only tools — only log mutations and actions
case "$TOOL_NAME" in
    Read|Glob|Grep|LS|ls|Search|Skill|ToolSearch)
        exit 0
        ;;
esac

# Extract session_id
SESSION_ID="$(echo "$INPUT_JSON" | jq -r '.session_id // empty' 2>/dev/null)" || exit 0
[ -z "$SESSION_ID" ] && exit 0

# Check if this agent session is registered
ID_FILE="$HOME/.claude/projecthub/agent-${SESSION_ID}.id"
KEY_FILE="$HOME/.claude/projecthub/agent-${SESSION_ID}.key"

[ -f "$ID_FILE" ] || exit 0

# Read agent credentials
AGENT_ID="$(cat "$ID_FILE" 2>/dev/null)" || exit 0
API_KEY="$(cat "$KEY_FILE" 2>/dev/null)" || exit 0
[ -z "$AGENT_ID" ] && exit 0
[ -z "$API_KEY" ] && exit 0

# Build summary from tool_input (first 200 chars)
TOOL_INPUT_STR="$(echo "$INPUT_JSON" | jq -c '.tool_input // {}' 2>/dev/null)" || TOOL_INPUT_STR="{}"
SUMMARY="${TOOL_NAME}: ${TOOL_INPUT_STR:0:200}"

# Build detail from tool_output (first 500 chars)
TOOL_OUTPUT="$(echo "$INPUT_JSON" | jq -r '
    if .tool_output | type == "string" then .tool_output
    elif .tool_output != null then (.tool_output | tostring)
    else ""
    end' 2>/dev/null)" || TOOL_OUTPUT=""
DETAIL="${TOOL_OUTPUT:0:500}"

# Build JSON payload — use jq to safely escape strings
PAYLOAD="$(jq -n \
    --arg action_type "tool_call" \
    --arg summary "$SUMMARY" \
    --arg detail "$DETAIL" \
    '{action_type: $action_type, summary: $summary, detail: $detail}')" || exit 0

# POST to the agent coordination API in the background (non-blocking)
(
    curl -s -m 5 \
        -X POST \
        -H "Content-Type: application/json" \
        -H "X-Agent-Key: ${API_KEY}" \
        -d "$PAYLOAD" \
        "http://localhost:8000/api/agents/${AGENT_ID}/actions" \
        >/dev/null 2>&1 \
    || log_error "POST failed for agent=${AGENT_ID} tool=${TOOL_NAME}"
) &

# Exit immediately — don't wait for curl
exit 0
