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

REM Seed system electron-builder cache with project-local tools
set "LOCAL_CACHE=%CD%\build-cache"
set "SYS_CACHE=%LOCALAPPDATA%\electron-builder\Cache"
if exist "%LOCAL_CACHE%\winCodeSign" (
  echo Seeding build cache...
  if not exist "%SYS_CACHE%\winCodeSign" mkdir "%SYS_CACHE%\winCodeSign" 2>nul
  xcopy "%LOCAL_CACHE%\winCodeSign\*" "%SYS_CACHE%\winCodeSign\" /e /i /y /q >nul 2>nul
  xcopy "%LOCAL_CACHE%\nsis\*" "%SYS_CACHE%\nsis\" /e /i /y /q >nul 2>nul
  echo Cache ready
) else (
  echo Cache: system will download on first build
)
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

REM Step 3: Package as unpacked app
echo [3/4] Packaging app...

if exist "build-out" rmdir /s /q "build-out" 2>nul
if exist "release" rmdir /s /q "release" 2>nul || echo Note: release\ locked, ok

call npx electron-builder --win --dir -c.directories.output=build-out
if %errorlevel% neq 0 (
  echo FAILED: electron-builder
  pause
  exit /b 1
)
echo OK
echo.

REM Step 4: Organize output into versioned directory
echo [4/4] Organizing output...
set "OUTDIR=release\AgentRouter-%VER%"
if not exist "%OUTDIR%" mkdir "%OUTDIR%"

if exist "build-out\win-unpacked\AgentRouter.exe" (
  move "build-out\win-unpacked" "%OUTDIR%\" >nul
  echo App: %OUTDIR%\win-unpacked\AgentRouter.exe
  echo (double-click to run, no installation needed)
)
echo OK
echo.

echo ========================================
echo  BUILD SUCCESSFUL
echo ========================================
echo.
echo Output: %OUTDIR%
echo.
echo To share build cache with other developers:
echo   Copy the build-cache\ folder to their project.
echo   It contains pre-downloaded NSIS and code-sign tools.
echo.
pause
