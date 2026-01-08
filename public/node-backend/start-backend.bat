@echo off
title GIS Automation Hub - Backend Server
echo ================================================
echo    GIS Automation Hub - Backend Server
echo ================================================
echo.

cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

echo Starting backend server...
echo.
echo Server will be available at: http://localhost:5000
echo Press Ctrl+C to stop the server
echo ================================================
echo.

npm start

pause
