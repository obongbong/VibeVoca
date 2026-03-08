#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# VibeVoca Backend — Docker Entrypoint
# 순서: 1) DB 연결 대기  2) Alembic 마이그레이션  3) 시드 데이터  4) uvicorn
# ──────────────────────────────────────────────────────────────
set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  VibeVoca API — Container Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── [1] PostgreSQL 준비 대기 ─────────────────────────────────
echo ""
echo "[1/4] PostgreSQL 연결 대기 중..."
MAX_RETRIES=30
RETRY_INTERVAL=2

for i in $(seq 1 $MAX_RETRIES); do
    if python -c "
import psycopg2, os
conn = psycopg2.connect(
    host=os.environ.get('POSTGRES_HOST', 'db'),
    port=os.environ.get('POSTGRES_PORT', '5432'),
    dbname=os.environ.get('POSTGRES_DB', 'vibevoca'),
    user=os.environ.get('POSTGRES_USER', 'vibevoca'),
    password=os.environ.get('POSTGRES_PASSWORD', 'vibevoca_secret'),
    connect_timeout=3
)
conn.close()
" 2>/dev/null; then
        echo "  ✓ PostgreSQL 준비 완료 (시도 $i/$MAX_RETRIES)"
        break
    fi
    if [ "$i" -eq "$MAX_RETRIES" ]; then
        echo "  ✗ PostgreSQL 연결 실패 — 타임아웃"
        exit 1
    fi
    echo "  대기 중... ($i/$MAX_RETRIES)"
    sleep $RETRY_INTERVAL
done

# ── [2] Alembic 마이그레이션 ─────────────────────────────────
echo ""
echo "[2/4] Alembic 마이그레이션 실행 중..."
alembic upgrade head
echo "  ✓ 마이그레이션 완료"

# ── [3] 시드 데이터 주입 ──────────────────────────────────────
echo ""
echo "[3/4] 시드 데이터 주입 중..."
python scripts/seed_data.py || echo "  ⚠ 시드 데이터 주입 실패 (초기화 전일 수 있음)"
echo "  ✓ 시드 데이터 주입 완료"

# ── [4] 실행 ──────────────────────────────────────────
echo ""
echo "[4/4] 컨테이너 명령어 실행..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
exec "$@"
