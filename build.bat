@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title AgentRouter Build

echo ========================================
echo  AgentRouter Build Script
echo ========================================
echo.

REM Read version from package.json
for /f "usebackq tokens=2 delims=:," %%a in (`type package.json ^| findstr /C:version`) do set "VER=%%~a"
set "VER=%VER:"=%"
set "VER=%VER: =%"
set "VER=%VER:,=%"
echo Version: %VER%
echo.

REM Step 1: Build Electron TypeScript
echo [1/4] Building Electron TypeScript...
call npm run build:electron
if %errorlevel% neq 0 (
  echo FAILED: TypeScript compilation
  pause
  exit /b 1
)
echo OK
echo.

REM Step 2: Build Vite frontend
echo [2/4] Building Vite frontend...
call npx vite build
if %errorlevel% neq 0 (
  echo FAILED: Vite build
  pause
  exit /b 1
)
echo OK
echo.

REM Step 3: Package as portable exe
echo [3/4] Packaging as Windows portable exe...
echo NOTE: Run as Administrator if you see symlink errors.
call npx electron-builder --win portable
if %errorlevel% neq 0 (
  echo FAILED: electron-builder packaging
  echo.
  echo The unpacked app is still available at:
  echo   release\win-unpacked\AgentRouter.exe
  echo.
  pause
  exit /b 1
)
echo OK
echo.

REM Step 4: Organize output into versioned directory
echo [4/4] Organizing output...
set "OUTDIR=release\AgentRouter-%VER%"
if not exist "%OUTDIR%" mkdir "%OUTDIR%"
if exist "release\AgentRouter-%VER%.exe" (
  move "release\AgentRouter-%VER%.exe" "%OUTDIR%\" >nul
  echo Portable exe: %OUTDIR%\AgentRouter-%VER%.exe
)
echo OK
echo.

echo ========================================
echo  BUILD SUCCESSFUL
echo ========================================
echo.
echo Output: %OUTDIR%
echo.
pause
