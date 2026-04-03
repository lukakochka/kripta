@echo off
echo ============================================
echo  CryptoOracle PRO v4 — Python AI Backend
echo ============================================
echo.

cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install from https://python.org
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
pip install -r requirements.txt --quiet

echo.
echo [2/3] Starting FastAPI server on http://127.0.0.1:8000
echo [3/3] Dashboard should be running on http://localhost:5173
echo.
echo Press Ctrl+C to stop.
echo ============================================

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
