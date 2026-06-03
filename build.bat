@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
setlocal enabledelayedexpansion
title AgentRouter Build

set "START_TIME=%TIME%"
set "BUILD_LOG=build.log"
echo. > "%BUILD_LOG%"

REM ═══════════════════════════════════════════════════════════════
REM  AgentRouter Build Script
REM  Usage:  build.bat [--no-agent] [--quick] [--portable] [--ci]
REM ═══════════════════════════════════════════════════════════════

set "BUILD_AGENT=1"
set "SKIP_FRONTEND=0"
set "PORTABLE=0"
set "CI_MODE=0"

:parse_args
if "%~1"=="--no-agent" set "BUILD_AGENT=0" & shift & goto parse_args
if "%~1"=="--quick"    set "SKIP_FRONTEND=1" & shift & goto parse_args
if "%~1"=="--portable" set "PORTABLE=1" & shift & goto parse_args
if "%~1"=="--ci"       set "CI_MODE=1" & shift & goto parse_args

echo ======================================== >> "%BUILD_LOG%"
echo  AgentRouter Build Script >> "%BUILD_LOG%"
echo  Started: %DATE% %TIME% >> "%BUILD_LOG%"
echo ======================================== >> "%BUILD_LOG%"

echo ========================================
echo  AgentRouter Build
echo ========================================
echo  Started: %DATE% %TIME%
echo.

REM ── 0. Environment Checks ──
echo [0/7] Checking environment...

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo FAILED: Node.js not found. Install from https://nodejs.org/
  if "%CI_MODE%"=="1" exit /b 1
  pause & exit /b 1
)

for /f "tokens=1,2 delims=v." %%a in ('node -v') do (
  set "NODE_MAJOR=%%~b"
)
if %NODE_MAJOR% LSS 18 (
  echo FAILED: Node.js version %NODE_MAJOR% detected, need ^>= 18
  if "%CI_MODE%"=="1" exit /b 1
  pause & exit /b 1
)
echo  [OK] Node.js v%NODE_MAJOR%.x

where git >nul 2>&1
if %errorlevel% equ 0 (
  for /f "tokens=*" %%a in ('git rev-parse --short HEAD 2^>nul') do set "GIT_HASH=%%a"
  if defined GIT_HASH (
    echo  [OK] Git commit: %GIT_HASH%
  ) else (
    echo  [..] No git repo detected
  )
) else (
  echo  [..] Git not found (optional)
)

REM Read version from package.json
for /f "tokens=2 delims=:," %%a in ('type package.json ^| findstr /C:"\"version\"" ^| findstr /v artifactName') do set "VER=%%~a"
set "VER=%VER:"=%"
set "VER=%VER: =%"
set "VER=%VER:,=%"
echo  [OK] Version: %VER%
echo.

echo ======================================== >> "%BUILD_LOG%"
echo  Node v%NODE_MAJOR%.x ^| Version %VER% ^| Git %GIT_HASH% >> "%BUILD_LOG%"
echo ======================================== >> "%BUILD_LOG%"

REM ── 1. npm install (if needed) ──
echo [1/7] Installing dependencies...
if not exist "node_modules" (
  echo  Running npm install...
  call npm install >> "%BUILD_LOG%" 2>&1
  if %errorlevel% neq 0 (
    echo FAILED: npm install. Check build.log for details.
    if "%CI_MODE%"=="1" exit /b 1
    pause & exit /b 1
  )
  echo  Dependencies installed
) else (
  echo  node_modules found, skipping install
  echo  (Run "npm install" manually if dependencies changed)
)
echo.

REM ── 2. Build Agent CLIs ──
if "%BUILD_AGENT%"=="1" (
  echo [2/7] Building Agent CLIs...
  if exist "agents\codewhale\Cargo.toml" (
    where rustc >nul 2>&1
    if !errorlevel! equ 0 (
      echo  Building CodeWhale (Rust)...
      pushd agents\codewhale
      cargo build --release -p codewhale-cli -p codewhale-tui >> "%BUILD_LOG%" 2>&1
      if %errorlevel% neq 0 (
        echo  [WARN] CodeWhale build failed. Check build.log.
      ) else (
        echo  [OK] CodeWhale
      )
      popd
    ) else (
      echo  [SKIP] CodeWhale — Rust not found
    )
  )
  if exist "agents\reasonix\package.json" (
    echo  Building Reasonix (Node.js)...
    pushd agents\reasonix
    call npm run build >> "%BUILD_LOG%" 2>&1
    if %errorlevel% neq 0 (
      echo  [WARN] Reasonix build failed. Check build.log.
    ) else (
      echo  [OK] Reasonix
    )
    popd
  )
  if exist "agents\deepcode\package.json" (
    echo  Building Deep Code CLI (Node.js)...
    pushd agents\deepcode
    call npm install >> "%BUILD_LOG%" 2>&1
    call npm run build >> "%BUILD_LOG%" 2>&1
    if %errorlevel% neq 0 (
      echo  [WARN] Deep Code build failed. Check build.log.
    ) else (
      echo  [OK] Deep Code CLI
    )
    popd
  )
  if exist "agents\opencode\go.mod" (
    where go >nul 2>&1
    if !errorlevel! equ 0 (
      echo  Building OpenCode (Go)...
      pushd agents\opencode
      go build -o ar-opencode.exe . >> "%BUILD_LOG%" 2>&1
      if %errorlevel% neq 0 (
        echo  [WARN] OpenCode build failed. Check build.log.
      ) else (
        echo  [OK] OpenCode
      )
      popd
    ) else (
      echo  [SKIP] OpenCode — Go not found
    )
  )
  echo  Done building agents
  echo.
) else (
  echo [2/7] Skipping Agent builds (--no-agent)...
  echo.
)

REM ── 3. Build Electron TypeScript ──
echo [3/7] Building Electron TypeScript...
call npm run build:electron >> "%BUILD_LOG%" 2>&1
if %errorlevel% neq 0 (
  echo FAILED: TypeScript compilation failed.
  echo  Check build.log or run: npx tsc -p electron/tsconfig.json --noEmit
  if "%CI_MODE%"=="1" exit /b 1
  pause & exit /b 1
)
echo  [OK] dist-electron/ generated
echo.

REM ── 4. Build Vite Frontend ──
if "%SKIP_FRONTEND%"=="0" (
  echo [4/7] Building Vite frontend...
  call npm run build >> "%BUILD_LOG%" 2>&1
  if %errorlevel% neq 0 (
    echo FAILED: Vite build failed.
    echo  Check build.log for details.
    if "%CI_MODE%"=="1" exit /b 1
    pause & exit /b 1
  )
  echo  [OK] dist/ generated
) else (
  echo [4/7] Skipping frontend build (--quick)...
)
echo.

REM ── 5. Seed Build Cache ──
echo [5/7] Preparing build cache...
set "LOCAL_CACHE=%CD%\build-cache"
set "SYS_CACHE=%LOCALAPPDATA%\electron-builder\Cache"
set "CACHE_SEEDED=0"

if exist "%LOCAL_CACHE%\winCodeSign" (
  if not exist "%SYS_CACHE%\winCodeSign" mkdir "%SYS_CACHE%\winCodeSign" 2>nul
  xcopy "%LOCAL_CACHE%\winCodeSign\*" "%SYS_CACHE%\winCodeSign\" /e /i /y /q >nul 2>nul
  xcopy "%LOCAL_CACHE%\nsis\*" "%SYS_CACHE%\nsis\" /e /i /y /q >nul 2>nul
  set "CACHE_SEEDED=1"
)

if "%CACHE_SEEDED%"=="1" (
  echo  [OK] Seeded from build-cache\
) else (
  if exist "%SYS_CACHE%\winCodeSign" (
    echo  [OK] System cache found
  ) else (
    echo  [..] No cache found, electron-builder will download tools
  )
)
echo.

REM ── 6. Package Electron App ──
echo [6/7] Packaging app...

set "OUTDIR=release\AgentRouter-%VER%"
if exist "%OUTDIR%" rmdir /s /q "%OUTDIR%" 2>nul
mkdir "%OUTDIR%" 2>nul

if "%PORTABLE%"=="1" (
  echo  Packaging as portable EXE...
  call npx electron-builder --win portable -c.directories.output=%OUTDIR% >> "%BUILD_LOG%" 2>&1
) else (
  echo  Packaging as unpacked directory...
  call npx electron-builder --win --dir -c.directories.output=%OUTDIR% >> "%BUILD_LOG%" 2>&1
)

if %errorlevel% neq 0 (
  echo FAILED: electron-builder packaging failed.
  echo  Check build.log for details.
  echo  Common issues:
  echo   - NSIS not found: ensure build-cache/ has nsis tools
  echo   - Code signing tool missing: pass --no-codesign or disable in package.json
  if "%CI_MODE%"=="1" exit /b 1
  pause & exit /b 1
)

REM Verify output
if exist "%OUTDIR%\win-unpacked\AgentRouter.exe" (
  echo  [OK] %OUTDIR%\win-unpacked\AgentRouter.exe
) else if exist "%OUTDIR%\AgentRouter Setup %VER%.exe" (
  echo  [OK] Portable: %OUTDIR%\AgentRouter Setup %VER%.exe
) else (
  echo  [WARN] Expected output not found, checking build-out\...
  if exist "build-out\win-unpacked\AgentRouter.exe" (
    xcopy "build-out\win-unpacked" "%OUTDIR%\" /e /i /y /q >nul
    echo  [OK] Copied from build-out\
  )
)
echo.

REM ── 7. Summary ──
echo [7/7] Build summary...

set "END_TIME=%TIME%"

REM Calculate elapsed time (approximate)
for /f "tokens=1-4 delims=:." %%a in ("%START_TIME%") do (
  set /a "START_SEC=1%%a*3600+1%%b*60+1%%c"
)
for /f "tokens=1-4 delims=:." %%a in ("%END_TIME%") do (
  set /a "END_SEC=1%%a*3600+1%%b*60+1%%c"
)
set /a "ELAPSED=%END_SEC%-%START_SEC%"
if %ELAPSED% lss 0 set /a "ELAPSED+=86400"
set /a "ELAPSED_MIN=%ELAPSED%/60, ELAPSED_SEC=%ELAPSED%%%60"

echo ========================================
echo  BUILD COMPLETE
echo ========================================
echo.
echo  Version:  %VER%
echo  Duration: %ELAPSED_MIN%m %ELAPSED_SEC%s
echo  Log:      %BUILD_LOG%
echo.

if "%PORTABLE%"=="1" (
  echo  Output: %OUTDIR%\AgentRouter Setup %VER%.exe
) else (
  echo  Output: %OUTDIR%\win-unpacked\AgentRouter.exe
)

for %%F in ("%OUTDIR%\win-unpacked\AgentRouter.exe") do (
  if exist "%%~fF" (
    set "SIZE_KB=%%~zF"
    set /a "SIZE_MB=!SIZE_KB!/1024/1024"
    echo  Size:    !SIZE_MB! MB
  )
)
echo.
echo  To share build cache with other developers:
echo    Copy the build-cache\ folder to their project.
echo    It contains pre-downloaded NSIS and code-sign tools.
echo.

REM Write summary to log
echo ======================================== >> "%BUILD_LOG%"
echo  BUILD COMPLETE: %VER% ^| %ELAPSED_MIN%m %ELAPSED_SEC%s >> "%BUILD_LOG%"
echo ======================================== >> "%BUILD_LOG%"

if "%CI_MODE%"=="1" exit /b 0
pause
