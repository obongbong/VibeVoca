#!/usr/bin/env bash
# VibeVoca - Linux/macOS Bash Virtual Environment Setup
# Usage: bash setup_venv.sh

set -euo pipefail

VENV_DIR=".venv"
PYTHON="python3"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  VibeVoca - Virtual Environment Setup (bash)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Python 버전 확인
echo ""
echo "[1/4] Python 버전 확인..."
$PYTHON --version

# 2. 가상환경 생성
echo ""
echo "[2/4] 가상환경 생성 중 ($VENV_DIR)..."
if [ -d "$VENV_DIR" ]; then
    echo "  이미 존재합니다. 건너뜁니다."
else
    $PYTHON -m venv "$VENV_DIR"
    echo "  ✓ 가상환경 생성 완료."
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

# 3. pip 업그레이드 + requirements 설치
echo ""
echo "[3/4] 패키지 설치 중 (backend/requirements.txt)..."
pip install --upgrade pip --quiet
pip install -r backend/requirements.txt

# 4. .env 파일 생성 안내
echo ""
echo "[4/4] 환경변수 설정..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "  ✓ .env.example → .env 복사 완료."
    echo "  ※ .env 파일을 열어 SECRET_KEY 등을 반드시 수정하세요!"
else
    echo "  .env 이미 존재합니다. 건너뜁니다."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ 설정 완료! 가상환경이 이미 활성화되었습니다."
echo "  다음번 활성화: source .venv/bin/activate"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
