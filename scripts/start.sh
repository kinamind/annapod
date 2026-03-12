#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# MindBridge — One-Click Development Start
# ─────────────────────────────────────────────────────
# Usage: bash scripts/start.sh [--setup] [--api-only] [--web-only]
#
# Options:
#   --setup      Run full environment setup first (pyinfra)
#   --api-only   Start only the backend API
#   --web-only   Start only the frontend
#   --stop       Stop all services
# ─────────────────────────────────────────────────────

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"
WEB_DIR="$PROJECT_ROOT/apps/web"
PID_DIR="$PROJECT_ROOT/.pids"

# ─── Functions ────────────────────────────────────

log_info()  { echo -e "${BLUE}ℹ${NC}  $*"; }
log_ok()    { echo -e "${GREEN}✅${NC} $*"; }
log_warn()  { echo -e "${YELLOW}⚠️${NC}  $*"; }
log_err()   { echo -e "${RED}❌${NC} $*"; }

banner() {
    echo -e "${CYAN}${BOLD}"
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║      🧠 MindBridge · 心桥             ║"
    echo "  ║   AI 心理咨询师训练平台               ║"
    echo "  ╚══════════════════════════════════════╝"
    echo -e "${NC}"
}

check_prereqs() {
    local missing=()

    command -v uv &>/dev/null || missing+=("uv (https://docs.astral.sh/uv/)")
    command -v pnpm &>/dev/null || missing+=("pnpm (npm install -g pnpm)")
    command -v node &>/dev/null || missing+=("node")

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_err "Missing prerequisites:"
        for m in "${missing[@]}"; do
            echo "    - $m"
        done
        exit 1
    fi
    log_ok "All prerequisites found"
}

ensure_postgres() {
    # Try common pg_isready locations
    local pg_isready="pg_isready"
    if ! command -v pg_isready &>/dev/null; then
        # macOS Homebrew
        for ver in 17 16 15; do
            if [[ -x "/usr/local/opt/postgresql@${ver}/bin/pg_isready" ]]; then
                pg_isready="/usr/local/opt/postgresql@${ver}/bin/pg_isready"
                break
            fi
            if [[ -x "/opt/homebrew/opt/postgresql@${ver}/bin/pg_isready" ]]; then
                pg_isready="/opt/homebrew/opt/postgresql@${ver}/bin/pg_isready"
                break
            fi
        done
    fi

    if $pg_isready -q 2>/dev/null; then
        log_ok "PostgreSQL is running"
    else
        log_err "PostgreSQL is not running. Please start it first:"
        echo "    brew services start postgresql@17"
        exit 1
    fi

    # Ensure database and pgvector extension exist
    local psql_bin="psql"
    if ! command -v psql &>/dev/null; then
        psql_bin="$(dirname "$pg_isready")/psql"
    fi

    # Create role and database if they don't exist
    $psql_bin -U "$(whoami)" -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='mindbridge'" 2>/dev/null | grep -q 1 \
        || $psql_bin -U "$(whoami)" -d postgres -c "CREATE ROLE mindbridge WITH LOGIN PASSWORD 'mindbridge' CREATEDB;" 2>/dev/null || true
    $psql_bin -U "$(whoami)" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='mindbridge'" 2>/dev/null | grep -q 1 \
        || $psql_bin -U "$(whoami)" -d postgres -c "CREATE DATABASE mindbridge OWNER mindbridge;" 2>/dev/null || true
    $psql_bin -U "$(whoami)" -d mindbridge -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

    log_ok "PostgreSQL ready (database: mindbridge, pgvector: enabled)"
}

start_api() {
    mkdir -p "$PID_DIR"

    # Check if already running
    if [[ -f "$PID_DIR/api.pid" ]] && kill -0 "$(cat "$PID_DIR/api.pid")" 2>/dev/null; then
        log_warn "API already running (PID $(cat "$PID_DIR/api.pid"))"
        return
    fi

    log_info "Starting backend API on port 8000..."
    cd "$API_DIR"

    # Ensure deps
    uv sync --quiet 2>/dev/null || true

    # Start uvicorn in background
    uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
        > "$PID_DIR/api.log" 2>&1 &
    echo $! > "$PID_DIR/api.pid"

    # Wait for API to respond
    for i in $(seq 1 20); do
        if curl -s http://localhost:8000/health &>/dev/null; then
            log_ok "Backend API running → ${BOLD}http://localhost:8000${NC}"
            log_info "API docs → ${BOLD}http://localhost:8000/docs${NC}"
            return
        fi
        sleep 1
    done
    log_warn "API started but not responding on /health yet (check $PID_DIR/api.log)"
}

start_web() {
    mkdir -p "$PID_DIR"

    # Check if already running
    if [[ -f "$PID_DIR/web.pid" ]] && kill -0 "$(cat "$PID_DIR/web.pid")" 2>/dev/null; then
        log_warn "Frontend already running (PID $(cat "$PID_DIR/web.pid"))"
        return
    fi

    log_info "Starting frontend on port 3000..."
    cd "$WEB_DIR"

    # Ensure deps
    pnpm install --silent 2>/dev/null || true

    # Start Next.js dev server in background
    pnpm dev > "$PID_DIR/web.log" 2>&1 &
    echo $! > "$PID_DIR/web.pid"

    # Wait for frontend to respond
    for i in $(seq 1 30); do
        if curl -s http://localhost:3000 &>/dev/null; then
            log_ok "Frontend running → ${BOLD}http://localhost:3000${NC}"
            return
        fi
        sleep 1
    done
    log_warn "Frontend started but not responding yet (check $PID_DIR/web.log)"
}

stop_services() {
    log_info "Stopping services..."

    if [[ -f "$PID_DIR/api.pid" ]]; then
        local pid
        pid=$(cat "$PID_DIR/api.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            # Also kill child processes (uvicorn workers)
            pkill -P "$pid" 2>/dev/null || true
            log_ok "Backend API stopped"
        fi
        rm -f "$PID_DIR/api.pid"
    fi

    if [[ -f "$PID_DIR/web.pid" ]]; then
        local pid
        pid=$(cat "$PID_DIR/web.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            pkill -P "$pid" 2>/dev/null || true
            log_ok "Frontend stopped"
        fi
        rm -f "$PID_DIR/web.pid"
    fi

    log_ok "All services stopped"
    echo -e "  ${YELLOW}Note: PostgreSQL is managed by Homebrew. Stop with:${NC}"
    echo "    brew services stop postgresql@17"
}

show_status() {
    echo -e "${BOLD}Service Status:${NC}"
    
    # PostgreSQL
    local pg_isready="pg_isready"
    if ! command -v pg_isready &>/dev/null; then
        for ver in 17 16 15; do
            [[ -x "/usr/local/opt/postgresql@${ver}/bin/pg_isready" ]] && pg_isready="/usr/local/opt/postgresql@${ver}/bin/pg_isready" && break
            [[ -x "/opt/homebrew/opt/postgresql@${ver}/bin/pg_isready" ]] && pg_isready="/opt/homebrew/opt/postgresql@${ver}/bin/pg_isready" && break
        done
    fi
    if $pg_isready -q 2>/dev/null; then
        echo -e "  PostgreSQL: ${GREEN}Running (local)${NC}"
    else
        echo -e "  PostgreSQL: ${RED}Not running${NC}"
    fi

    # API
    if [[ -f "$PID_DIR/api.pid" ]] && kill -0 "$(cat "$PID_DIR/api.pid")" 2>/dev/null; then
        echo -e "  Backend:    ${GREEN}Running (PID $(cat "$PID_DIR/api.pid"))${NC} → http://localhost:8000"
    else
        echo -e "  Backend:    ${RED}Not running${NC}"
    fi

    # Web
    if [[ -f "$PID_DIR/web.pid" ]] && kill -0 "$(cat "$PID_DIR/web.pid")" 2>/dev/null; then
        echo -e "  Frontend:   ${GREEN}Running (PID $(cat "$PID_DIR/web.pid"))${NC} → http://localhost:3000"
    else
        echo -e "  Frontend:   ${RED}Not running${NC}"
    fi
}

run_setup() {
    log_info "Running full environment setup via pyinfra..."
    cd "$API_DIR"
    uv run pyinfra @local "$PROJECT_ROOT/deploy/setup_local.py"
}

# ─── Main ─────────────────────────────────────────

banner

DO_SETUP=false
API_ONLY=false
WEB_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --setup)   DO_SETUP=true ;;
        --api-only) API_ONLY=true ;;
        --web-only) WEB_ONLY=true ;;
        --stop)    stop_services; exit 0 ;;
        --status)  show_status; exit 0 ;;
        --help|-h)
            echo "Usage: $0 [--setup] [--api-only] [--web-only] [--stop] [--status]"
            echo ""
            echo "  --setup      Run full environment setup first"
            echo "  --api-only   Start only the backend API"
            echo "  --web-only   Start only the frontend"
            echo "  --stop       Stop all running services"
            echo "  --status     Show current service status"
            exit 0
            ;;
    esac
done

check_prereqs

if $DO_SETUP; then
    run_setup
fi

ensure_postgres

if ! $WEB_ONLY; then
    start_api
fi

if ! $API_ONLY; then
    start_web
fi

echo ""
echo -e "${GREEN}${BOLD}🚀 MindBridge is running!${NC}"
echo ""
show_status
echo ""
echo -e "  Stop all:  ${BOLD}bash scripts/start.sh --stop${NC}"
echo -e "  Logs:      ${BOLD}tail -f .pids/api.log${NC}  or  ${BOLD}tail -f .pids/web.log${NC}"
