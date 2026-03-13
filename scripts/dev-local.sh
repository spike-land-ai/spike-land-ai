#!/usr/bin/env bash
# dev-local.sh — Start all local dev services with colored output
#
# Usage:
#   bash scripts/dev-local.sh [--no-sync] [--only <name>]
#
# Services:
#   spike-web       → http://localhost:4321  (Astro)
#   spike-edge      → http://localhost:8787  (Wrangler)
#   spike-land-mcp  → http://localhost:8790  (Wrangler)
#   mcp-auth        → http://localhost:8791  (Wrangler)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ─── Colours (skip if not a TTY) ─────────────────────────────────────────────
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  CYAN='\033[0;36m'
  MAGENTA='\033[0;35m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' MAGENTA='' BOLD='' RESET=''
fi

# ─── Defaults ────────────────────────────────────────────────────────────────
SYNC=true
ONLY=""

# ─── Argument parsing ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-sync)  SYNC=false; shift ;;
    --only)     ONLY="$2";  shift 2 ;;
    -h|--help)
      echo "Usage: bash scripts/dev-local.sh [--no-sync] [--only <name>]"
      echo ""
      echo "Services: web, edge, mcp, auth"
      echo ""
      echo "Flags:"
      echo "  --no-sync    Skip git sync phase"
      echo "  --only NAME  Start only one service (web|edge|mcp|auth)"
      exit 0
      ;;
    *) echo -e "${RED}Unknown option: $1${RESET}"; exit 1 ;;
  esac
done

# ─── Service definitions ─────────────────────────────────────────────────────
declare -a SVC_NAMES=( "spike-web" "spike-edge" "spike-land-mcp" "mcp-auth" )
declare -a SVC_SHORTS=( "web" "edge" "mcp" "auth" )
declare -a SVC_DIRS=( "packages/spike-web" "packages/spike-edge" "packages/spike-land-mcp" "packages/mcp-auth" )
declare -a SVC_CMDS=( "npx astro dev" "npx wrangler dev --port 8787 --inspector-port 9230" "npx wrangler dev --port 8790 --inspector-port 9231" "npx wrangler dev --port 8791 --inspector-port 9232" )
declare -a SVC_PORTS=( 4321 8787 8790 8791 )
declare -a SVC_COLORS=( "$CYAN" "$GREEN" "$YELLOW" "$MAGENTA" )

CHILD_PIDS=()

# ─── Cleanup ─────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo -e "${BOLD}Shutting down...${RESET}"
  for pid in "${CHILD_PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null
    fi
  done
  wait 2>/dev/null
  echo -e "${GREEN}All services stopped.${RESET}"
}
trap cleanup SIGINT SIGTERM EXIT

# ─── Phase 1: Git Sync ──────────────────────────────────────────────────────
if $SYNC; then
  echo -e "${BOLD}── Git Sync ──${RESET}"

  # Uncommitted changes
  CHANGES=$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$CHANGES" -gt 0 ]]; then
    echo -e "${YELLOW}  $CHANGES uncommitted change(s)${RESET}"
  else
    echo -e "${GREEN}  Working tree clean${RESET}"
  fi

  # Pull
  if git -C "$REPO_ROOT" pull --rebase --autostash 2>/dev/null; then
    echo -e "${GREEN}  git pull OK${RESET}"
  else
    echo -e "${YELLOW}  git pull failed (continuing anyway)${RESET}"
  fi

  # Open PRs
  if command -v gh &>/dev/null; then
    PR_COUNT=$(gh pr list --repo "$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null)" --limit 5 --json number 2>/dev/null | grep -c '"number"' || echo 0)
    if [[ "$PR_COUNT" -gt 0 ]]; then
      echo -e "${CYAN}  $PR_COUNT open PR(s):${RESET}"
      gh pr list --limit 5 2>/dev/null | sed 's/^/    /'
    fi
  fi
  echo ""
fi

# ─── Phase 2: Port check ────────────────────────────────────────────────────
check_port() {
  local port=$1 name=$2
  local pid
  pid=$(lsof -ti :"$port" 2>/dev/null | head -1)
  if [[ -n "$pid" ]]; then
    echo -e "${YELLOW}  Port $port in use (PID $pid) — skipping $name${RESET}"
    return 1
  fi
  return 0
}

# ─── Phase 3: Start services ────────────────────────────────────────────────
start_service() {
  local idx=$1
  local name="${SVC_NAMES[$idx]}"
  local dir="${REPO_ROOT}/${SVC_DIRS[$idx]}"
  local cmd="${SVC_CMDS[$idx]}"
  local port="${SVC_PORTS[$idx]}"
  local color="${SVC_COLORS[$idx]}"
  local pad
  pad=$(printf '%-15s' "$name")

  if ! check_port "$port" "$name"; then
    return
  fi

  if [[ ! -d "$dir" ]]; then
    echo -e "${RED}  Directory not found: $dir — skipping $name${RESET}"
    return
  fi

  (cd "$dir" && $cmd 2>&1) | awk -v prefix="$color[$pad]$RESET " '{print prefix $0}' &
  CHILD_PIDS+=($!)
  echo -e "${color}  Started $name (PID $!) on port $port${RESET}"
}

echo -e "${BOLD}── Starting services ──${RESET}"

if [[ -n "$ONLY" ]]; then
  # Find matching service
  FOUND=false
  for i in "${!SVC_SHORTS[@]}"; do
    if [[ "${SVC_SHORTS[$i]}" == "$ONLY" || "${SVC_NAMES[$i]}" == "$ONLY" ]]; then
      start_service "$i"
      FOUND=true
      break
    fi
  done
  if ! $FOUND; then
    echo -e "${RED}Unknown service: $ONLY${RESET}"
    echo "Available: ${SVC_SHORTS[*]}"
    exit 1
  fi
else
  for i in "${!SVC_NAMES[@]}"; do
    start_service "$i"
  done
fi

echo ""

# ─── Phase 4: URL banner ────────────────────────────────────────────────────
echo -e "${BOLD}── Dev URLs ──${RESET}"
if [[ -n "$ONLY" ]]; then
  for i in "${!SVC_SHORTS[@]}"; do
    if [[ "${SVC_SHORTS[$i]}" == "$ONLY" || "${SVC_NAMES[$i]}" == "$ONLY" ]]; then
      printf "  ${SVC_COLORS[$i]}%-15s${RESET} → http://localhost:%s\n" "${SVC_NAMES[$i]}" "${SVC_PORTS[$i]}"
    fi
  done
else
  for i in "${!SVC_NAMES[@]}"; do
    printf "  ${SVC_COLORS[$i]}%-15s${RESET} → http://localhost:%s\n" "${SVC_NAMES[$i]}" "${SVC_PORTS[$i]}"
  done
fi
echo ""
echo -e "${BOLD}Press Ctrl+C to stop all services${RESET}"
echo ""

# ─── Phase 5: Monitor ───────────────────────────────────────────────────────
while true; do
  for idx in "${!CHILD_PIDS[@]}"; do
    pid="${CHILD_PIDS[$idx]}"
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" 2>/dev/null
      code=$?
      if [[ $code -ne 0 ]]; then
        echo -e "${RED}  Service (PID $pid) exited with code $code${RESET}"
      fi
      unset 'CHILD_PIDS[$idx]'
    fi
  done

  # If all services have exited, stop
  if [[ ${#CHILD_PIDS[@]} -eq 0 ]]; then
    echo -e "${YELLOW}All services have exited.${RESET}"
    break
  fi

  sleep 2
done
