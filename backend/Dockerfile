# ──────────────────────────────────────────────
# VibeVoca Backend — Dockerfile
# Base : python:3.12-slim
# Runtime : uvicorn (ASGI)
# ──────────────────────────────────────────────
FROM python:3.12-slim

# 환경변수: 파이썬 stdout/stderr 즉시 출력, .pyc 생성 방지
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# ── 시스템 의존성 (psycopg2-binary 빌드용) ──
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# ── Python 의존성 ────────────────────────────
COPY requirements.txt .
RUN pip install --upgrade pip --quiet \
    && pip install --no-cache-dir -r requirements.txt

# ── 애플리케이션 소스 ────────────────────────
COPY . .

# ── entrypoint 실행 권한 부여 ────────────────
RUN chmod +x entrypoint.sh

# 컨테이너 외부로 노출할 포트
EXPOSE 8000

# DB 마이그레이션 → 시드 → uvicorn 실행
ENTRYPOINT ["./entrypoint.sh"]
