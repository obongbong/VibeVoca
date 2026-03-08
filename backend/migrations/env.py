"""
VibeVoca — Alembic migrations/env.py
Supports both online (async) and offline (sync) migration modes.
"""
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ── 설정 로드 ────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── App Settings → DB URL ────────────────────────────────────
import sys, os
# Alembic은 backend/ 디렉토리에서 실행되므로 sys.path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings
from app.db.session import Base

# 모든 모델을 임포트해야 autogenerate가 동작함
import app.models.voca  # noqa: F401
import app.models.user  # noqa: F401

settings = get_settings()

# alembic.ini의 sqlalchemy.url을 런타임에 덮어씀
config.set_main_option("sqlalchemy.url", settings.SYNC_DATABASE_URL)

target_metadata = Base.metadata


# ── Offline Mode ─────────────────────────────────────────────
def run_migrations_offline() -> None:
    """DB 연결 없이 SQL 스크립트만 생성."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online Mode (Async) ──────────────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """비동기 엔진으로 마이그레이션을 실행합니다."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        url=settings.DATABASE_URL,   # asyncpg URL 사용
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# ── Entry Point ──────────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
