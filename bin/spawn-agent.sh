#!/usr/bin/env bash
# spawn-agent.sh — Spawn a new Claude Code agent in a tmux pane
#
# Usage:
#   spawn-agent.sh [options]
#
# Options:
#   -d, --dir DIR        Working directory for the agent (default: cwd)
#   -p, --prompt TEXT    Initial prompt to send to the agent
#   -n, --name NAME      Name for the tmux window (default: agent-N)
#   -s, --session NAME   Tmux session name (default: agents)
#   --count N            Spawn N agents (default: 1)
#   -h, --help           Show this help
#
# Examples:
#   spawn-agent.sh -d ~/projects/ao3-downloader -p "Review PR #135"
#   spawn-agent.sh --count 5 -d ~/projects/ao3-downloader
#   spawn-agent.sh -n "pr-review" -p "Look at the open PRs and prioritize them"

set -euo pipefail

# ---------- defaults ----------
WORK_DIR="$(pwd)"
PROMPT=""
WINDOW_NAME=""
TMUX_SESSION="agents"
COUNT=1

# ---------- parse args ----------
while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--dir)
            WORK_DIR="$2"; shift 2 ;;
        -p|--prompt)
            PROMPT="$2"; shift 2 ;;
        -n|--name)
            WINDOW_NAME="$2"; shift 2 ;;
        -s|--session)
            TMUX_SESSION="$2"; shift 2 ;;
        --count)
            COUNT="$2"; shift 2 ;;
        -h|--help)
            head -20 "$0" | grep '^#' | sed 's/^# \?//'
            exit 0 ;;
        *)
            echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# ---------- validate ----------
if [[ ! -d "$WORK_DIR" ]]; then
    echo "ERROR: Directory does not exist: $WORK_DIR" >&2
    exit 1
fi

if ! command -v tmux &>/dev/null; then
    echo "ERROR: tmux is required but not found" >&2
    exit 1
fi

if ! command -v claude &>/dev/null; then
    echo "ERROR: claude CLI is required but not found" >&2
    exit 1
fi

# ---------- ensure tmux session exists ----------
if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    echo "Creating tmux session '$TMUX_SESSION'..."
    tmux new-session -d -s "$TMUX_SESSION" -c "$WORK_DIR"
    FIRST_WINDOW=true
else
    FIRST_WINDOW=false
fi

# ---------- spawn agents ----------
for i in $(seq 1 "$COUNT"); do
    NAME="${WINDOW_NAME:-agent-$(date +%s%N | tail -c 6)}"
    if [[ "$COUNT" -gt 1 ]]; then
        NAME="${WINDOW_NAME:-agent}-${i}"
    fi

    # Build the claude command
    CLAUDE_CMD="cd '$WORK_DIR' && claude"
    if [[ -n "$PROMPT" ]]; then
        # Escape single quotes in prompt for bash -c
        ESCAPED_PROMPT="${PROMPT//\'/\'\\\'\'}"
        CLAUDE_CMD="cd '$WORK_DIR' && claude -p '${ESCAPED_PROMPT}'"
    fi

    if [[ "$FIRST_WINDOW" == "true" && "$i" -eq 1 ]]; then
        # Rename the first window instead of creating a new one
        tmux rename-window -t "$TMUX_SESSION" "$NAME"
        tmux send-keys -t "$TMUX_SESSION:$NAME" "$CLAUDE_CMD" Enter
        FIRST_WINDOW=false
    else
        tmux new-window -t "$TMUX_SESSION" -n "$NAME" -c "$WORK_DIR"
        tmux send-keys -t "$TMUX_SESSION:$NAME" "$CLAUDE_CMD" Enter
    fi

    echo "Spawned agent '$NAME' in tmux session '$TMUX_SESSION' (dir: $WORK_DIR)"
done

echo ""
echo "Attach with: tmux attach -t $TMUX_SESSION"
echo "Agents will auto-register with ProjectHub via SessionStart hook."
echo "Monitor at: http://10.0.0.73:3030 (Agent Orchestrator)"
