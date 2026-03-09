#!/usr/bin/env bash
# docker-test.sh — Docker BuildKit-cached test runner for spike-land-ai monorepo
#
# Usage:
#   bash scripts/docker-test.sh [--base <git-ref>] [--head <git-ref>] \
#                               [--all] [--no-cache] [--jobs N]
#
# Exit codes:
#   0 — all tests passed (or cache hit)
#   1 — one or more packages failed
#
# How cache works:
#   Each `docker build --target test-<pkg>` hashes the files COPYed into that
#   stage. If those files haven't changed since the last successful build,
#   BuildKit returns a cache hit and the vitest RUN is skipped entirely — the
#   image already contains a passing result.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKERFILE="${REPO_ROOT}/docker/Dockerfile.test"
DETECT_SCRIPT="${REPO_ROOT}/scripts/detect-changed-packages.sh"
FALLBACK_SCRIPT="${REPO_ROOT}/scripts/test-changed.sh"

# ─── Defaults ────────────────────────────────────────────────────────────────
BASE="origin/main"
HEAD="HEAD"
ALL=false
NO_CACHE=false
JOBS=4

# ─── Colours (skip if not a TTY) ─────────────────────────────────────────────
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' CYAN='' BOLD='' RESET=''
fi

# ─── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)       BASE="$2";  shift 2 ;;
    --head)       HEAD="$2";  shift 2 ;;
    --all)        ALL=true;   shift   ;;
    --no-cache)   NO_CACHE=true; shift ;;
    --jobs|-j)    JOBS="$2";  shift 2 ;;
    -h|--help)
      sed -n '2,9p' "$0" | sed 's/^# *//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# ─── Docker availability check ────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${YELLOW}[warn]${RESET} Docker not found. Falling back to ${FALLBACK_SCRIPT}."
  if [[ -x "$FALLBACK_SCRIPT" ]]; then
    exec bash "$FALLBACK_SCRIPT" --base "$BASE" --head "$HEAD" ${ALL:+--all}
  else
    echo -e "${RED}[error]${RESET} Fallback script not found: ${FALLBACK_SCRIPT}" >&2
    exit 1
  fi
fi

if ! docker info &>/dev/null 2>&1; then
  echo -e "${YELLOW}[warn]${RESET} Docker daemon not running. Falling back to ${FALLBACK_SCRIPT}."
  if [[ -x "$FALLBACK_SCRIPT" ]]; then
    exec bash "$FALLBACK_SCRIPT" --base "$BASE" --head "$HEAD" ${ALL:+--all}
  else
    echo -e "${RED}[error]${RESET} Fallback script not found: ${FALLBACK_SCRIPT}" >&2
    exit 1
  fi
fi

if [[ ! -f "$DOCKERFILE" ]]; then
  echo -e "${RED}[error]${RESET} Dockerfile not found: ${DOCKERFILE}" >&2
  echo "       Run 'make docker-setup' or ensure docker/Dockerfile.test exists." >&2
  exit 1
fi

# ─── Determine packages to test ───────────────────────────────────────────────
PACKAGES=()

if $ALL; then
  echo -e "${CYAN}[info]${RESET} --all flag set: collecting all testable packages from Dockerfile..."
  # Extract all test-* target names from the Dockerfile
  while IFS= read -r line; do
    pkg="${line#FROM * AS test-}"
    pkg="${line##*AS test-}"
    PACKAGES+=("$pkg")
  done < <(grep -E '^FROM .+ AS test-' "$DOCKERFILE" | sed 's/.*AS test-//')
  if [[ ${#PACKAGES[@]} -eq 0 ]]; then
    echo -e "${YELLOW}[warn]${RESET} No test-* stages found in ${DOCKERFILE}." >&2
    exit 0
  fi
else
  if [[ ! -x "$DETECT_SCRIPT" ]]; then
    echo -e "${RED}[error]${RESET} detect-changed-packages.sh not found or not executable: ${DETECT_SCRIPT}" >&2
    exit 1
  fi
  echo -e "${CYAN}[info]${RESET} Detecting changed packages (base=${BASE}, head=${HEAD})..."
  while IFS= read -r pkg; do
    case "$pkg" in
      "")
        ;;
      NO_CHANGES)
        echo -e "${GREEN}[ok]${RESET} No changed packages detected. Nothing to test."
        exit 0
        ;;
      ALL)
        ALL=true
        PACKAGES=()
        break
        ;;
      *)
        PACKAGES+=("$pkg")
        ;;
    esac
  done < <(bash "$DETECT_SCRIPT" --base "$BASE" --head "$HEAD" 2>/dev/null || true)
fi

if $ALL; then
  PACKAGES=()
  while IFS= read -r line; do
    pkg="${line#FROM * AS test-}"
    pkg="${line##*AS test-}"
    [[ "$pkg" != "all" ]] && PACKAGES+=("$pkg")
  done < <(grep -E '^FROM .+ AS test-' "$DOCKERFILE" | sed 's/.*AS test-//')
fi

if [[ ${#PACKAGES[@]} -eq 0 ]]; then
  echo -e "${GREEN}[ok]${RESET} No changed packages detected. Nothing to test."
  exit 0
fi

echo -e "${CYAN}[info]${RESET} Packages to test (${#PACKAGES[@]}): ${PACKAGES[*]}"
echo ""

# ─── Sanitise package name → Docker target name ───────────────────────────────
# Docker stage names must match [a-zA-Z0-9_.-]. Replace underscores with hyphens,
# strip leading @scope/ prefixes.
pkg_to_target() {
  local pkg="$1"
  # Strip @scope/ prefix (e.g. @spike-land-ai/chess-engine → chess-engine)
  pkg="${pkg##*/}"
  # Underscores → hyphens
  pkg="${pkg//_/-}"
  echo "test-${pkg}"
}

target_exists() {
  local target="$1"
  grep -qE "^FROM .+ AS ${target}$" "$DOCKERFILE"
}

for pkg in "${PACKAGES[@]}"; do
  target="$(pkg_to_target "$pkg")"
  if ! target_exists "$target"; then
    echo -e "${RED}[error]${RESET} Missing Docker test stage: ${target}" >&2
    echo "       Package '${pkg}' can be emitted by detect-changed-packages.sh but has no stage in docker/Dockerfile.test." >&2
    exit 1
  fi
done

# ─── Temp directory for per-package output and timing ─────────────────────────
TMPDIR_RESULTS="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RESULTS"' EXIT

# ─── Build one package (runs in a subshell, called in background) ─────────────
build_package() {
  local pkg="$1"
  local target
  target="$(pkg_to_target "$pkg")"
  local tag="spike-land-test:${target#test-}"
  local result_file="${TMPDIR_RESULTS}/${pkg//\//_}.result"
  local log_file="${TMPDIR_RESULTS}/${pkg//\//_}.log"

  local start_ms
  start_ms=$(date +%s%3N 2>/dev/null || echo 0)

  # Build docker command
  local -a cmd=(
    env DOCKER_BUILDKIT=1
    docker build
    --file "$DOCKERFILE"
    --target "$target"
    --tag "$tag"
    --progress plain
  )

  if $NO_CACHE; then
    cmd+=(--no-cache)
  fi

  # Add build context (repo root)
  cmd+=("$REPO_ROOT")

  # Run build, capture output
  local exit_code=0
  "${cmd[@]}" >"$log_file" 2>&1 || exit_code=$?

  local end_ms
  end_ms=$(date +%s%3N 2>/dev/null || echo 0)
  local duration_ms=$(( end_ms - start_ms ))

  # Detect cache hit: BuildKit prints "CACHED" for every step when it's a hit
  local cache_hit=false
  if grep -q "^#[0-9]* CACHED" "$log_file" 2>/dev/null && \
     ! grep -qE "^#[0-9]* (RUN|COPY|ADD) " "$log_file" 2>/dev/null; then
    # All steps were CACHED → definite cache hit
    cache_hit=true
  fi

  # Write result: "exit_code|duration_ms|cache_hit"
  echo "${exit_code}|${duration_ms}|${cache_hit}" > "$result_file"

  # If failed, also write a marker so the aggregator knows
  if [[ $exit_code -ne 0 ]]; then
    echo "$pkg" >> "${TMPDIR_RESULTS}/FAILED"
  fi

  return $exit_code
}

# ─── Parallel execution with bounded concurrency ──────────────────────────────
declare -A PKG_PIDS=()   # pkg → PID
declare -a QUEUE=("${PACKAGES[@]}")
declare -a RUNNING=()

wait_for_slot() {
  # Block until the number of running jobs drops below JOBS
  while [[ ${#RUNNING[@]} -ge $JOBS ]]; do
    local new_running=()
    for pid in "${RUNNING[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        new_running+=("$pid")
      fi
    done
    RUNNING=("${new_running[@]+"${new_running[@]}"}")
    [[ ${#RUNNING[@]} -ge $JOBS ]] && sleep 0.2
  done
}

echo -e "${BOLD}Running tests (max ${JOBS} parallel)...${RESET}"
echo ""

for pkg in "${PACKAGES[@]}"; do
  wait_for_slot
  build_package "$pkg" &
  pid=$!
  PKG_PIDS["$pkg"]=$pid
  RUNNING+=("$pid")
  echo -e "  ${CYAN}→${RESET} Started: ${pkg} (pid ${pid})"
done

# Wait for all remaining jobs
for pid in "${RUNNING[@]+"${RUNNING[@]}"}"; do
  wait "$pid" 2>/dev/null || true
done

# Also wait for any PIDs not yet waited on
for pkg in "${!PKG_PIDS[@]}"; do
  wait "${PKG_PIDS[$pkg]}" 2>/dev/null || true
done

# ─── Aggregate results ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}========================================${RESET}"
echo -e "${BOLD}Test Results (${#PACKAGES[@]} packages checked):${RESET}"
echo -e "${BOLD}========================================${RESET}"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

format_duration() {
  local ms="$1"
  if [[ $ms -lt 1000 ]]; then
    echo "${ms}ms"
  else
    printf "%.1fs" "$(echo "scale=1; $ms / 1000" | bc 2>/dev/null || echo "$ms")"
  fi
}

for pkg in "${PACKAGES[@]}"; do
  local_safe="${pkg//\//_}"
  result_file="${TMPDIR_RESULTS}/${local_safe}.result"
  log_file="${TMPDIR_RESULTS}/${local_safe}.log"

  if [[ ! -f "$result_file" ]]; then
    echo -e "  ${YELLOW}?${RESET} ${pkg} — no result (process may have been killed)"
    (( FAIL_COUNT++ ))
    continue
  fi

  IFS='|' read -r exit_code duration_ms cache_hit < "$result_file"
  dur_str="$(format_duration "$duration_ms")"

  if [[ "$exit_code" == "0" ]]; then
    if [[ "$cache_hit" == "true" ]]; then
      echo -e "  ${GREEN}✓${RESET} ${pkg} ${CYAN}(cache hit — ${dur_str})${RESET}"
    else
      echo -e "  ${GREEN}✓${RESET} ${pkg} ${RESET}(${dur_str})${RESET}"
    fi
    (( PASS_COUNT++ ))
  else
    echo -e "  ${RED}✗${RESET} ${pkg} (${dur_str}) ${RED}— FAILED${RESET}"
    (( FAIL_COUNT++ ))
    # Print last 20 lines of the build log for quick diagnosis
    if [[ -f "$log_file" ]]; then
      echo -e "    ${YELLOW}--- build output (last 20 lines) ---${RESET}"
      tail -20 "$log_file" | sed 's/^/    /'
      echo -e "    ${YELLOW}--- end ---${RESET}"
    fi
  fi
done

echo -e "${BOLD}========================================${RESET}"

if [[ $FAIL_COUNT -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All ${PASS_COUNT} passed${RESET}"
else
  echo -e "${RED}${BOLD}${FAIL_COUNT} failed${RESET}, ${GREEN}${PASS_COUNT} passed${RESET}"
fi

echo ""

# ─── Exit code ────────────────────────────────────────────────────────────────
[[ $FAIL_COUNT -eq 0 ]]
