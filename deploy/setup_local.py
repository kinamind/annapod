"""
annapod — pyinfra Local Development Setup

One-click environment configuration and service startup.
Handles: PostgreSQL (local Homebrew), Python backend, Node.js frontend.

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

DB_NAME = "annapod"
DB_USER = "annapod"
DB_PASS = "annapod"
DB_PORT = "5432"

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
            print(f"⚠️  请编辑 {ENV_FILE} 填入你的 LLM_API_KEY")
        else:
            print(f"⚠️  No .env.example found — please create {ENV_FILE} manually")
    else:
        print(f"✅ .env already exists")


python.call(
    name="Ensure .env configuration file",
    function=ensure_env,
)


# ─── Step 2: Local PostgreSQL + pgvector ──────────
def setup_postgres():
    """Ensure local PostgreSQL is running with annapod database and pgvector."""
    import subprocess
    import shutil

    # Find pg_isready and psql binaries
    pg_isready = shutil.which("pg_isready")
    psql_bin = shutil.which("psql")
    createdb_bin = shutil.which("createdb")

    if not pg_isready:
        for ver in ("17", "16", "15"):
            for prefix in ("/usr/local/opt", "/opt/homebrew/opt"):
                candidate = f"{prefix}/postgresql@{ver}/bin/pg_isready"
                if os.path.isfile(candidate):
                    pg_bin_dir = os.path.dirname(candidate)
                    pg_isready = candidate
                    psql_bin = os.path.join(pg_bin_dir, "psql")
                    createdb_bin = os.path.join(pg_bin_dir, "createdb")
                    break
            if pg_isready:
                break

    if not pg_isready:
        print(
            "❌ PostgreSQL not found. Install via: brew install postgresql@17 pgvector"
        )
        raise SystemExit(1)

    # Check if running
    result = subprocess.run([pg_isready], capture_output=True, text=True)
    if result.returncode != 0:
        print(
            "❌ PostgreSQL is not running. Start with: brew services start postgresql@17"
        )
        raise SystemExit(1)
    print("✅ PostgreSQL is running")

    current_user = os.environ.get("USER", "postgres")

    # Create role if not exists
    result = subprocess.run(
        [
            psql_bin,
            "-U",
            current_user,
            "-d",
            "postgres",
            "-tc",
            f"SELECT 1 FROM pg_roles WHERE rolname='{DB_USER}'",
        ],
        capture_output=True,
        text=True,
    )
    if "1" not in result.stdout:
        subprocess.run(
            [
                psql_bin,
                "-U",
                current_user,
                "-d",
                "postgres",
                "-c",
                f"CREATE ROLE {DB_USER} WITH LOGIN PASSWORD '{DB_PASS}' CREATEDB;",
            ],
            check=True,
        )
        print(f"✅ Created role '{DB_USER}'")
    else:
        print(f"✅ Role '{DB_USER}' exists")

    # Create database if not exists
    result = subprocess.run(
        [
            psql_bin,
            "-U",
            current_user,
            "-d",
            "postgres",
            "-tc",
            f"SELECT 1 FROM pg_database WHERE datname='{DB_NAME}'",
        ],
        capture_output=True,
        text=True,
    )
    if "1" not in result.stdout:
        subprocess.run(
            [
                psql_bin,
                "-U",
                current_user,
                "-d",
                "postgres",
                "-c",
                f"CREATE DATABASE {DB_NAME} OWNER {DB_USER};",
            ],
            check=True,
        )
        print(f"✅ Created database '{DB_NAME}'")
    else:
        print(f"✅ Database '{DB_NAME}' exists")

    # Enable pgvector (requires superuser)
    subprocess.run(
        [
            psql_bin,
            "-U",
            current_user,
            "-d",
            DB_NAME,
            "-c",
            "CREATE EXTENSION IF NOT EXISTS vector;",
        ],
        capture_output=True,
    )
    print("✅ pgvector extension enabled")


python.call(
    name="Setup PostgreSQL (local + pgvector)",
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
        capture_output=True,
        text=True,
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
        capture_output=True,
        text=True,
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
    print("🎉 annapod 开发环境配置完成！")
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
