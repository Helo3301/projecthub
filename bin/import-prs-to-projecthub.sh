#!/usr/bin/env bash
#
# import-prs-to-projecthub.sh
#
# Imports open PRs from ao3-downloader (PageDrop) into ProjectHub as tasks.
# Requires: gh, curl, jq
#
# Usage:
#   PROJECTHUB_JWT="eyJ..." ./import-prs-to-projecthub.sh
#   # or with credentials file at ~/.projecthub/credentials.json
#   ./import-prs-to-projecthub.sh
#
# Environment variables:
#   PROJECTHUB_JWT       - JWT token (skips login if set)
#   PROJECTHUB_URL       - Base URL (default: http://localhost:8000)
#   PROJECTHUB_REPO      - GitHub repo (default: Hestia-s-Creations/ao3-downloader)
#   PROJECTHUB_PROJECT   - Project name (default: PageDrop)
#
set -euo pipefail

# ---------- configuration ----------
API_BASE="${PROJECTHUB_URL:-http://localhost:8000}"
REPO="${PROJECTHUB_REPO:-Hestia-s-Creations/ao3-downloader}"
PROJECT_NAME="${PROJECTHUB_PROJECT:-PageDrop}"
CREDS_FILE="${HOME}/.projecthub/credentials.json"

# ---------- preflight checks ----------
for cmd in gh curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' is required but not found in PATH." >&2
    exit 1
  fi
done

# ---------- obtain JWT ----------
get_jwt() {
  # 1. Check env var
  if [[ -n "${PROJECTHUB_JWT:-}" ]]; then
    echo "$PROJECTHUB_JWT"
    return
  fi

  # 2. Fall back to credentials file
  if [[ ! -f "$CREDS_FILE" ]]; then
    echo "ERROR: No PROJECTHUB_JWT set and $CREDS_FILE not found." >&2
    echo "Create $CREDS_FILE with {\"username\": \"...\", \"password\": \"...\"}." >&2
    exit 1
  fi

  local username password token
  username=$(jq -r '.username' "$CREDS_FILE")
  password=$(jq -r '.password' "$CREDS_FILE")

  if [[ -z "$username" || -z "$password" || "$username" == "null" || "$password" == "null" ]]; then
    echo "ERROR: $CREDS_FILE must contain 'username' and 'password' fields." >&2
    exit 1
  fi

  echo "Authenticating as '$username'..." >&2

  local response http_code body
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${API_BASE}/api/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${username}&password=${password}")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" -ne 200 ]]; then
    echo "ERROR: Login failed (HTTP $http_code): $body" >&2
    exit 1
  fi

  token=$(echo "$body" | jq -r '.access_token // .token // empty')
  if [[ -z "$token" ]]; then
    echo "ERROR: Could not extract token from login response: $body" >&2
    exit 1
  fi

  echo "$token"
}

JWT=$(get_jwt)
AUTH_HEADER="Authorization: Bearer ${JWT}"

echo "Using API at ${API_BASE}"

# ---------- ensure project exists ----------
get_or_create_project() {
  local projects_json project_id

  projects_json=$(curl -s -H "$AUTH_HEADER" "${API_BASE}/api/projects/")

  # Look for existing project by name
  project_id=$(echo "$projects_json" | jq -r \
    --arg name "$PROJECT_NAME" \
    '.[] | select(.name == $name) | .id' 2>/dev/null | head -1)

  if [[ -n "$project_id" && "$project_id" != "null" ]]; then
    echo "Found existing project '$PROJECT_NAME' (id=$project_id)" >&2
    echo "$project_id"
    return
  fi

  echo "Creating project '$PROJECT_NAME'..." >&2

  local response http_code body
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${API_BASE}/api/projects/" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"${PROJECT_NAME}\", \"description\": \"PageDrop Web Clipper - imported from GitHub PRs\"}")

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "ERROR: Failed to create project (HTTP $http_code): $body" >&2
    exit 1
  fi

  project_id=$(echo "$body" | jq -r '.id')
  if [[ -z "$project_id" || "$project_id" == "null" ]]; then
    echo "ERROR: Could not extract project ID from response: $body" >&2
    exit 1
  fi

  echo "Created project '$PROJECT_NAME' (id=$project_id)" >&2
  echo "$project_id"
}

PROJECT_ID=$(get_or_create_project)

# ---------- fetch PRs from GitHub ----------
echo "Fetching open PRs from ${REPO}..."

PRS_JSON=$(gh pr list \
  --repo "$REPO" \
  --state open \
  --json number,title,body,url,createdAt,updatedAt \
  --limit 200)

PR_COUNT=$(echo "$PRS_JSON" | jq 'length')
echo "Found ${PR_COUNT} open PRs."

if [[ "$PR_COUNT" -eq 0 ]]; then
  echo "Nothing to import."
  exit 0
fi

# ---------- import each PR as a task ----------
imported=0
errors=0

for i in $(seq 0 $((PR_COUNT - 1))); do
  pr_number=$(echo "$PRS_JSON" | jq -r ".[$i].number")
  pr_title=$(echo "$PRS_JSON" | jq -r ".[$i].title")
  pr_url=$(echo "$PRS_JSON" | jq -r ".[$i].url")
  pr_body=$(echo "$PRS_JSON" | jq -r ".[$i].body // \"\"" | head -c 2000)

  # Build description: PR header + body (truncated)
  description="PR #${pr_number}: ${pr_url}"
  if [[ -n "$pr_body" ]]; then
    description="${description}

${pr_body}"
  fi

  # Truncate description to 2000 chars total
  description=$(printf '%s' "$description" | head -c 2000)

  # Build JSON payload using jq for safe escaping
  payload=$(jq -n \
    --arg title "$pr_title" \
    --arg desc "$description" \
    --argjson pid "$PROJECT_ID" \
    '{
      title: $title,
      description: $desc,
      project_id: $pid,
      status: "todo",
      priority: "medium"
    }')

  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${API_BASE}/api/tasks/" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1) || true

  http_code=$(echo "$response" | tail -1)

  if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
    imported=$((imported + 1))
  else
    errors=$((errors + 1))
    body=$(echo "$response" | sed '$d')
    echo "  ERROR importing PR #${pr_number} '${pr_title}' (HTTP ${http_code}): ${body}" >&2
  fi

  # Progress every 10 tasks
  total=$((imported + errors))
  if (( total % 10 == 0 )); then
    echo "  Progress: ${total}/${PR_COUNT} processed (${imported} imported, ${errors} errors)"
  fi
done

# ---------- summary ----------
echo ""
echo "========================================="
echo "  Import complete"
echo "  ${imported} tasks imported successfully"
echo "  ${errors} errors"
echo "  Project: ${PROJECT_NAME} (id=${PROJECT_ID})"
echo "========================================="

if [[ "$errors" -gt 0 ]]; then
  exit 1
fi
