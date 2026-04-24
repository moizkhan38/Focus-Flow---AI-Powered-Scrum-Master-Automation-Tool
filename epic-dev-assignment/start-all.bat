@echo off
echo ========================================
echo Epic Dev Assignment System - Launcher
echo ========================================
echo.
echo This will start all 3 services:
echo 1. Flask Epic Generator (Port 5000)
echo 2. Node.js Backend (Port 3003)
echo 3. React Frontend (Port 5173)
echo.
echo Make sure you have:
echo - Installed dependencies (npm install in frontend and backend)
echo - Python venv activated and dependencies installed
echo - Added GEMINI_API_KEY to epic-generator/.env
echo.
pause

start "Flask Service" cmd /k "cd /d d:\integration\epic-generator && venv\Scripts\activate && python web_app.py"
timeout /t 3 /nobreak >nul

start "Node Backend" cmd /k "cd /d d:\integration\epic-dev-assignment\backend && npm start"
timeout /t 3 /nobreak >nul

start "React Frontend" cmd /k "cd /d d:\integration\epic-dev-assignment\frontend && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo All services started!
echo ========================================
echo.
echo Flask:    http://localhost:5000
echo Backend:  http://localhost:3003
echo Frontend: http://localhost:5173
echo.
echo Press Ctrl+C in each terminal to stop
echo ========================================
pause
