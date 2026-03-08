# VibeVoca - Windows PowerShell Virtual Environment Setup
# Usage: .\setup_venv.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$VENV_DIR = ".venv"
$PYTHON = "python"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  VibeVoca - Virtual Environment Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# 1. Python 버전 확인
Write-Host "`n[1/4] Python 버전 확인..." -ForegroundColor Yellow
& $PYTHON --version
if ($LASTEXITCODE -ne 0) {
    Write-Error "Python이 설치되지 않았거나 PATH에 없습니다."
}

# 2. 가상환경 생성
Write-Host "`n[2/4] 가상환경 생성 중 ($VENV_DIR)..." -ForegroundColor Yellow
if (Test-Path $VENV_DIR) {
    Write-Host "  이미 존재합니다. 건너뜁니다." -ForegroundColor Gray
} else {
    & $PYTHON -m venv $VENV_DIR
    Write-Host "  가상환경 생성 완료." -ForegroundColor Green
}

# 3. pip 업그레이드 + requirements 설치
Write-Host "`n[3/4] 패키지 설치 중 (backend/requirements.txt)..." -ForegroundColor Yellow
& "$VENV_DIR\Scripts\python.exe" -m pip install --upgrade pip --quiet
& "$VENV_DIR\Scripts\pip.exe" install -r backend\requirements.txt

# 4. .env 파일 생성 안내
Write-Host "`n[4/4] 환경변수 설정..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  .env.example → .env 복사 완료." -ForegroundColor Green
    Write-Host "  ※ .env 파일을 열어 SECRET_KEY 등을 반드시 수정하세요!" -ForegroundColor Red
} else {
    Write-Host "  .env 이미 존재합니다. 건너뜁니다." -ForegroundColor Gray
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  설정 완료! 가상환경을 활성화하려면:" -ForegroundColor Green
Write-Host "  .\.venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
