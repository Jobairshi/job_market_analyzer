#!/usr/bin/env bash
#
# run.sh — Start all three services for ai_job_analyzer
#
#   Usage:
#     ./run.sh              Start backend + frontend (dev servers)
#     ./run.sh --scrape     Also run the AI engine scraper first
#     ./run.sh --all        Same as --scrape
#     ./run.sh --stop       Kill all background processes started by this script
#
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT_DIR/.run_pids"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✔]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✖]${NC} $*" >&2; }

# ── Stop subcommand ──────────────────────────────────────────────────
stop_all() {
  if [[ -f "$PID_FILE" ]]; then
    echo -e "\n${CYAN}Stopping running services...${NC}"
    while IFS= read -r pid; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null && log "Stopped PID $pid"
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
    log "All services stopped."
  else
    warn "No PID file found — nothing to stop."
  fi
  exit 0
}

# Handle --stop
if [[ "${1:-}" == "--stop" ]]; then
  stop_all
fi

# ── Preflight checks ────────────────────────────────────────────────
check_command() {
  if ! command -v "$1" &>/dev/null; then
    err "$1 is required but not installed."
    exit 1
  fi
}

check_command node
check_command npm
check_command python3

echo -e "\n${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       AI Job Analyzer — Development Run      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}\n"

# Clean up old PIDs
rm -f "$PID_FILE"

# ── Kill any process already on a given port ─────────────────────────
free_port() {
  local port=$1
  local pid
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    warn "Port $port is in use (PID $pid). Killing it..."
    kill -9 $pid 2>/dev/null || true
    sleep 0.5
    log "Port $port freed."
  fi
}

free_port 3000
free_port 4000
free_port 8000

# Trap to clean up background processes on exit (Ctrl+C, etc.)
cleanup() {
  echo ""
  warn "Shutting down services..."
  if [[ -f "$PID_FILE" ]]; then
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  log "Cleanup done. Goodbye!"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── 1. AI Engine (Python scraper/pipeline) ───────────────────────────
run_scraper() {
  echo -e "${CYAN}━━━ AI Engine (Python scraper) ━━━${NC}"
  AI_DIR="$ROOT_DIR/ai_engine"

  if [[ ! -d "$AI_DIR/venv" ]]; then
    warn "Virtual environment not found. Creating one..."
    python3 -m venv "$AI_DIR/venv"
    source "$AI_DIR/venv/bin/activate"
    pip install --quiet --upgrade pip
    # Install common deps — adjust if a requirements.txt is added later
    pip install --quiet pandas python-dotenv requests beautifulsoup4 supabase sentence-transformers plotly
    log "Virtual environment created & dependencies installed."
  else
    source "$AI_DIR/venv/bin/activate"
  fi

  log "Running AI Engine scraper pipeline..."
  (cd "$AI_DIR" && python main.py)
  deactivate 2>/dev/null || true
  log "AI Engine pipeline complete.\n"
}

if [[ "${1:-}" == "--scrape" || "${1:-}" == "--all" ]]; then
  run_scraper
fi

# ── 2. AI Engine API (FastAPI on port 8000) ──────────────────────────
echo -e "${CYAN}━━━ AI Engine API (FastAPI on port 8000) ━━━${NC}"
AI_DIR="$ROOT_DIR/ai_engine"

if [[ ! -d "$AI_DIR/venv" ]]; then
  warn "Virtual environment not found. Creating one..."
  python3 -m venv "$AI_DIR/venv"
  source "$AI_DIR/venv/bin/activate"
  pip install --quiet --upgrade pip
  pip install --quiet pandas python-dotenv requests beautifulsoup4 supabase sentence-transformers plotly pdfplumber fastapi uvicorn numpy python-multipart langchain-openai langchain-core
  log "Virtual environment created & dependencies installed."
else
  source "$AI_DIR/venv/bin/activate"
fi

# Ensure new deps are installed
pip install --quiet pdfplumber fastapi uvicorn numpy python-multipart langchain-openai langchain-core 2>/dev/null || true

(cd "$AI_DIR" && "$AI_DIR/venv/bin/uvicorn" api:app --host 0.0.0.0 --port 8000 > "$ROOT_DIR/.aiengine.log" 2>&1) &
AI_API_PID=$!
echo "$AI_API_PID" >> "$PID_FILE"
log "AI Engine API started (PID $AI_API_PID) — logs: .aiengine.log"
deactivate 2>/dev/null || true

# ── 3. Backend (NestJS) ─────────────────────────────────────────────
echo -e "${CYAN}━━━ Backend (NestJS on port 4000) ━━━${NC}"
BACKEND_DIR="$ROOT_DIR/backend"

if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  warn "Installing backend dependencies..."
  (cd "$BACKEND_DIR" && npm install --silent)
  log "Backend dependencies installed."
fi

(cd "$BACKEND_DIR" && npm run start:dev > "$ROOT_DIR/.backend.log" 2>&1) &
BACKEND_PID=$!
echo "$BACKEND_PID" >> "$PID_FILE"
log "Backend started (PID $BACKEND_PID) — logs: .backend.log"

# ── 4. Frontend (Next.js) ───────────────────────────────────────────
echo -e "${CYAN}━━━ Frontend (Next.js on port 3000) ━━━${NC}"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  warn "Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install --silent)
  log "Frontend dependencies installed."
fi

(cd "$FRONTEND_DIR" && npm run dev > "$ROOT_DIR/.frontend.log" 2>&1) &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >> "$PID_FILE"
log "Frontend started (PID $FRONTEND_PID) — logs: .frontend.log"

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  All services are running!                   ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  Frontend   → http://localhost:3000           ║${NC}"
echo -e "${GREEN}║  Backend    → http://localhost:4000/api       ║${NC}"
echo -e "${GREEN}║  AI Engine  → http://localhost:8000           ║${NC}"
echo -e "${GREEN}║                                              ║${NC}"
echo -e "${GREEN}║  Press Ctrl+C to stop all services           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Tail logs ────────────────────────────────────────────────────────
tail -f "$ROOT_DIR/.backend.log" "$ROOT_DIR/.frontend.log" "$ROOT_DIR/.aiengine.log"
