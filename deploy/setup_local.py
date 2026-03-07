"""
MindBridge — pyinfra Local Development Setup

One-click environment configuration and service startup.
Handles: PostgreSQL (Docker), Python backend, Node.js frontend.

Usage:
    # From project root:
    cd apps/api && uv run pyinfra @local deploy/setup_local.py
    
    # Or directly:
    uv run pyinfra @local deploy/setup_local.py
"""

from pyinfra.operations import python
import os
import time

# ─── Configuration ────────────────────────────────
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
API_DIR = os.path.join(PROJECT_ROOT, "apps", "api")
WEB_DIR = os.path.join(PROJECT_ROOT, "apps", "web")
ENV_FILE = os.path.join(API_DIR, ".env")

DB_NAME = "mindbridge"
DB_USER = "mindbridge"
DB_PASS = "mindbridge"
DB_PORT = "5432"
DOCKER_PG_CONTAINER = "mindbridge-postgres"

API_PORT = 8000
WEB_PORT = 3000


# ─── Step 1: Ensure .env exists ──────────────────
def ensure_env():
    """Copy .env.example to .env if it doesn't exist."""
    import shutil
    example = os.path.join(API_DIR, ".env.example")
    if not os.path.exists(ENV_FILE):
        if os.path.exists(example):
            shutil.copy2(example, ENV_FILE)
            print(f"✅ Created {ENV_FILE} from .env.example")
            print(f"⚠️  请编辑 {ENV_FILE} 填入你的 GEMINI_API_KEY")
        else:
            print(f"⚠️  No .env.example found — please create {ENV_FILE} manually")
    else:
        print(f"✅ .env already exists")


python.call(
    name="Ensure .env configuration file",
    function=ensure_env,
)


# ─── Step 2: Docker — PostgreSQL + pgvector ───────
def setup_postgres():
    """Start PostgreSQL with pgvector via Docker."""
    import subprocess

    # Check if Docker is running
    try:
        subprocess.run(["docker", "info"], capture_output=True, check=True, timeout=10)
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        print("❌ Docker is not running. Please start Docker Desktop first.")
        raise SystemExit(1)

    # Check if container already exists and running
    result = subprocess.run(
        ["docker", "ps", "-a", "--filter", f"name={DOCKER_PG_CONTAINER}", "--format", "{{.Status}}"],
        capture_output=True, text=True,
    )
    status = result.stdout.strip()

    if "Up" in status:
        print(f"✅ PostgreSQL container '{DOCKER_PG_CONTAINER}' is already running")
    elif status:
        # Container exists but stopped — start it
        print(f"🔄 Starting existing PostgreSQL container...")
        subprocess.run(["docker", "start", DOCKER_PG_CONTAINER], check=True)
        time.sleep(3)
        print(f"✅ PostgreSQL container started")
    else:
        # Create new container with pgvector
        print(f"📦 Creating PostgreSQL + pgvector container...")
        subprocess.run([
            "docker", "run", "-d",
            "--name", DOCKER_PG_CONTAINER,
            "-e", f"POSTGRES_DB={DB_NAME}",
            "-e", f"POSTGRES_USER={DB_USER}",
            "-e", f"POSTGRES_PASSWORD={DB_PASS}",
            "-p", f"{DB_PORT}:5432",
            "-v", f"mindbridge_pgdata:/var/lib/postgresql/data",
            "pgvector/pgvector:pg17",
        ], check=True)
        print("⏳ Waiting for PostgreSQL to be ready...")
        time.sleep(5)
        print(f"✅ PostgreSQL container created and running on port {DB_PORT}")

    # Verify connection
    for attempt in range(10):
        result = subprocess.run(
            ["docker", "exec", DOCKER_PG_CONTAINER, "pg_isready", "-U", DB_USER],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            print("✅ PostgreSQL is accepting connections")
            break
        time.sleep(1)
    else:
        print("⚠️  PostgreSQL not ready after 10 seconds — it may need more time")

    # Ensure pgvector extension
    subprocess.run([
        "docker", "exec", DOCKER_PG_CONTAINER,
        "psql", "-U", DB_USER, "-d", DB_NAME, "-c",
        "CREATE EXTENSION IF NOT EXISTS vector;",
    ], capture_output=True)
    print("✅ pgvector extension enabled")


python.call(
    name="Setup PostgreSQL (Docker + pgvector)",
    function=setup_postgres,
)


# ─── Step 3: Python Backend Dependencies ─────────
def setup_backend():
    """Install backend Python dependencies via uv."""
    import subprocess

    print(f"📦 Installing Python dependencies in {API_DIR}...")
    result = subprocess.run(
        ["uv", "sync"],
        cwd=API_DIR,
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"❌ uv sync failed:\n{result.stderr}")
        raise SystemExit(1)
    print("✅ Python dependencies installed")


python.call(
    name="Install backend dependencies (uv sync)",
    function=setup_backend,
)


# ─── Step 4: Frontend Dependencies ───────────────
def setup_frontend():
    """Install frontend Node.js dependencies via pnpm."""
    import subprocess

    # Check pnpm
    try:
        subprocess.run(["pnpm", "--version"], capture_output=True, check=True)
    except FileNotFoundError:
        print("📦 pnpm not found, installing via npm...")
        subprocess.run(["npm", "install", "-g", "pnpm"], check=True)

    print(f"📦 Installing frontend dependencies in {WEB_DIR}...")
    result = subprocess.run(
        ["pnpm", "install"],
        cwd=WEB_DIR,
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"❌ pnpm install failed:\n{result.stderr}")
        raise SystemExit(1)
    print("✅ Frontend dependencies installed")


python.call(
    name="Install frontend dependencies (pnpm install)",
    function=setup_frontend,
)


# ─── Step 5: Summary ─────────────────────────────
def print_summary():
    print("\n" + "=" * 60)
    print("🎉 MindBridge 开发环境配置完成！")
    print("=" * 60)
    print()
    print(f"  PostgreSQL:  localhost:{DB_PORT}  (user: {DB_USER}, db: {DB_NAME})")
    print(f"  pgvector:    enabled")
    print()
    print("  启动后端 API:")
    print(f"    cd {API_DIR}")
    print(f"    uv run uvicorn app.main:app --reload --port {API_PORT}")
    print()
    print("  启动前端:")
    print(f"    cd {WEB_DIR}")
    print(f"    pnpm dev")
    print()
    print("  Or use the one-click start script:")
    print(f"    cd {PROJECT_ROOT}")
    print(f"    bash scripts/start.sh")
    print()
    print(f"  API Docs:    http://localhost:{API_PORT}/docs")
    print(f"  Frontend:    http://localhost:{WEB_PORT}")
    print("=" * 60)


python.call(
    name="Print setup summary",
    function=print_summary,
)
