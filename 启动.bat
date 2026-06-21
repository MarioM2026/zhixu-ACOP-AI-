@echo off
chcp 437 >nul
title ZhiXu ACOP - Starting

echo.
echo  ██████╗  █████╗ ██████╗ ██████╗ ███████╗██╗██╗  ██╗
echo  ██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝██║╚██╗██╔╝
echo  ██║  ██║███████║██████╔╝██████╔╝█████╗  ██║ ╚███╔╝
echo  ██║  ██║██╔══██║██╔══██╗██╔═══╝ ██╔══╝  ██║ ██╔██╗
echo  ██████╔╝██║  ██║██║  ██║██║     ███████╗██║██╔╝ ██╗
echo  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝╚═╝  ╚═╝
echo.
echo  AI Code Copilot Observability Platform
echo  ================================================
echo.

:: ========== 1. Check Environment ==========
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    echo   Download: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%A in ('node -v') do set "NODE_VERSION=%%A"
echo [ENV] Node.js %NODE_VERSION% Ready

:: ========== 2. Check Dependencies ==========
if not exist "node_modules" (
    echo [INSTALL] First run, installing dependencies...
    echo   This may take 2-5 minutes...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Dependency installation failed
        echo.
        pause
        exit /b 1
    )
    echo.
) else (
    echo [ENV] Dependencies Ready
)

echo.
echo ================================================
echo [START] Starting services, please wait...
echo.

:: ========== 3. Start Backend ==========
echo   [1/3] Starting Backend Service (port 3001)...
start "ZhiXu-ACOP-Backend" /min cmd /c "npm run dev:server"
timeout /t 3 /nobreak >nul

:: ========== 4. Start Frontend ==========
echo   [2/3] Starting Frontend Service (port 5173)...
start "ZhiXu-ACOP-Frontend" /min cmd /c "npm run dev:client"
timeout /t 6 /nobreak >nul

:: ========== 5. Wait for Services ==========
echo   [3/3] Waiting for services to be ready...
powershell -NoProfile -Command "$tries=0; while($tries -lt 30){try{$r=Invoke-WebRequest -Uri 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 3; if($r.StatusCode -eq 200){exit 0}}catch{}$tries++; Start-Sleep -Seconds 1}; exit 1"
if %errorlevel% equ 0 (
    echo.
    echo [READY] Services started successfully!
) else (
    echo.
    echo [WARN] Health check timeout, still trying to open browser
)

echo.
echo ================================================
echo.

:: ========== 6. Show Browser Selection ==========
echo [INFO] Showing browser selection dialog...
echo.

start "" "wscript.exe" "%~dp0选择浏览器.vbs" "http://localhost:5173"

:: ========== 7. Done ==========
echo ================================================
echo  ZhiXu ACOP Started Successfully
echo.
echo  Frontend: http://localhost:5173
echo  Dashboard: http://localhost:5173/dashboard
echo  Backend API: http://localhost:3001
echo.
echo  Notes:
echo    - Services run in minimized background windows
echo    - Closing this window won't stop the services
echo    - To stop, close windows with title "ZhiXu-ACOP-"
echo ================================================
echo.
pause
