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

REM Use project-local build cache (bundled with repo)
set "ELECTRON_BUILDER_CACHE=%CD%\build-cache"
if exist "%ELECTRON_BUILDER_CACHE%\nsis" (
  echo Cache: local (build-cache/)
) else (
  echo Cache: system (will download dependencies on first run)
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

REM Step 3: Package as portable exe
echo [3/4] Packaging as Windows portable exe...

REM Clean up previous build output (handle locked files)
if exist "release" (
  rmdir /s /q "release" 2>nul || (
    echo Note: release\ is locked, using build-out\ instead
  )
)
if exist "build-out" rmdir /s /q "build-out" 2>nul

if exist "release" (
  call npx electron-builder --win portable -c.directories.output=build-out
) else (
  call npx electron-builder --win portable
)

if %errorlevel% neq 0 (
  echo FAILED: electron-builder packaging
  echo.
  if exist "build-out\win-unpacked\AgentRouter.exe" (
    echo Unpacked: build-out\win-unpacked\AgentRouter.exe
  )
  if exist "release\win-unpacked\AgentRouter.exe" (
    echo Unpacked: release\win-unpacked\AgentRouter.exe
  )
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

if exist "build-out\AgentRouter-%VER%.exe" (
  move "build-out\AgentRouter-%VER%.exe" "%OUTDIR%\" >nul
  echo Portable: %OUTDIR%\AgentRouter-%VER%.exe
)
if exist "build-out\win-unpacked\AgentRouter.exe" (
  move "build-out\win-unpacked" "%OUTDIR%\" >nul
  echo Unpacked: %OUTDIR%\win-unpacked\AgentRouter.exe
)
if exist "release\AgentRouter-%VER%.exe" (
  move "release\AgentRouter-%VER%.exe" "%OUTDIR%\" >nul
  echo Portable: %OUTDIR%\AgentRouter-%VER%.exe
)
if exist "release\win-unpacked\AgentRouter.exe" (
  move "release\win-unpacked" "%OUTDIR%\" >nul
  echo Unpacked: %OUTDIR%\win-unpacked\AgentRouter.exe
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
