@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
setlocal enabledelayedexpansion
title AgentRouter Build

set "START_TIME=%TIME%"
set "BUILD_LOG=build.log"
echo. > "%BUILD_LOG%"

REM ================================================================
REM  AgentRouter Build Script
REM  Usage:  build.bat [--no-agent] [--quick] [--portable] [--ci]
REM ================================================================

set "BUILD_AGENT=1"
set "SKIP_FRONTEND=0"
set "PORTABLE=0"
set "CI_MODE=0"

set "AGENT_CW_STATUS=--"
set "AGENT_RX_STATUS=--"
set "AGENT_DC_STATUS=--"
set "AGENT_OC_STATUS=--"
set "AGENT_CL_STATUS=--"
set "AGENT_CN_STATUS=--"

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

REM ---- 0. Node.js Detection ----
echo [0/7] Checking environment...

set "NODE_PATH="
if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2\node.exe" (
  set "NODE_PATH=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2\node.exe"
) else if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.15.0\node.exe" (
  set "NODE_PATH=%USERPROFILE%\.workbuddy\binaries\node\versions\22.15.0\node.exe"
) else if exist "C:\Program Files\nodejs\node.exe" (
  set "NODE_PATH=C:\Program Files\nodejs\node.exe"
)

if defined NODE_PATH (
  for /f %%a in ('"%NODE_PATH%" -v') do set "NODE_FULL_VER=%%a"
  call :check_version "!NODE_FULL_VER!" "%NODE_PATH%"
  if errorlevel 1 pause & exit /b 1
  echo  [OK] !NODE_FULL_VER!
  echo  Path: %NODE_PATH%
  for %%F in ("%NODE_PATH%") do set "NODE_DIR=%%~dpF"
  set "PATH=!NODE_DIR!;%PATH%"
) else (
  where node >nul 2>&1
  if errorlevel 1 (
    echo FAILED: Node.js not found.
    echo  Install from https://nodejs.org/ (recommended: v22 LTS)
    pause & exit /b 1
  )
  for /f %%a in ('node -v') do set "NODE_FULL_VER=%%a"
  call :check_version "%NODE_FULL_VER%" "PATH"
  if errorlevel 1 pause & exit /b 1
  echo  [OK] %NODE_FULL_VER% (from PATH)
)

echo.
echo ======================================== >> "%BUILD_LOG%"
echo  %NODE_FULL_VER% ^| Version %VER% ^| Git %GIT_HASH% >> "%BUILD_LOG%"
echo ======================================== >> "%BUILD_LOG%"

REM ---- 1. npm install ----
echo [1/7] Installing dependencies...
if not exist "node_modules" (
  echo  Running npm install...
  call npm install >> "%BUILD_LOG%" 2>&1
  if errorlevel 1 (
    echo FAILED: npm install. Check build.log for details.
    pause & exit /b 1
  )
  echo  Dependencies installed
) else (
  echo  node_modules found, skipping install
)
echo.

REM ---- 2. Build Agents ----
if "%BUILD_AGENT%"=="1" (
  echo [2/7] Building Agent CLIs...

  if exist "agents\codewhale\Cargo.toml" (
    where rustc >nul 2>&1
    if !errorlevel! equ 0 (
      echo  Building CodeWhale (Rust)...
      pushd agents\codewhale
      cargo build --release -p codewhale-cli -p codewhale-tui >> "%BUILD_LOG%" 2>&1
      if !errorlevel! equ 0 ( set "AGENT_CW_STATUS=OK" ) else ( set "AGENT_CW_STATUS=FAIL" )
      popd
    ) else (
      set "AGENT_CW_STATUS=SKIP"
    )
  )

  if exist "agents\reasonix\package.json" (
    echo  Building Reasonix (Node.js)...
    pushd agents\reasonix
    call npm run build >> "%BUILD_LOG%" 2>&1
    if !errorlevel! equ 0 ( set "AGENT_RX_STATUS=OK" ) else ( set "AGENT_RX_STATUS=FAIL" )
    popd
  )

  if exist "agents\deepcode\package.json" (
    echo  Building Deep Code CLI (Node.js)...
    pushd agents\deepcode
    if not exist "node_modules" call npm install >> "%BUILD_LOG%" 2>&1
    call npm run build >> "%BUILD_LOG%" 2>&1
    if !errorlevel! equ 0 ( set "AGENT_DC_STATUS=OK" ) else ( set "AGENT_DC_STATUS=FAIL" )
    popd
  )

  if exist "agents\opencode\go.mod" (
    where go >nul 2>&1
    if !errorlevel! equ 0 (
      echo  Building OpenCode (Go)...
      pushd agents\opencode
      go build -o ar-opencode.exe . >> "%BUILD_LOG%" 2>&1
      if !errorlevel! equ 0 ( set "AGENT_OC_STATUS=OK" ) else ( set "AGENT_OC_STATUS=FAIL" )
      popd
    ) else (
      set "AGENT_OC_STATUS=SKIP"
    )
  )

  if exist "agents\cline\platform.cjs" (
    where @cline/cli >nul 2>&1
    if !errorlevel! equ 0 ( set "AGENT_CL_STATUS=OK" ) else ( set "AGENT_CL_STATUS=SKIP" )
  )

  if exist "agents\continue\platform.cjs" (
    where @continuedev/cli >nul 2>&1
    if !errorlevel! equ 0 ( set "AGENT_CN_STATUS=OK" ) else ( set "AGENT_CN_STATUS=SKIP" )
  )

  echo  Done building agents
  echo.
)

REM ---- 3. Build Electron TypeScript ----
echo [3/7] Building Electron TypeScript...
call npm run build:electron >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  echo FAILED: TypeScript compilation failed.
  pause & exit /b 1
)
echo  [OK] dist-electron/ generated
echo.

REM ---- 4. Build Frontend ----
if "%SKIP_FRONTEND%"=="0" (
  echo [4/7] Building Vite frontend...
  call npm run build >> "%BUILD_LOG%" 2>&1
  if errorlevel 1 (
    echo FAILED: Vite build failed.
    pause & exit /b 1
  )
  echo  [OK] dist/ generated
  echo.
)

REM ---- 5. Build Cache ----
echo [5/7] Preparing build cache...
set "LOCAL_CACHE=%CD%\build-cache"
set "SYS_CACHE=%LOCALAPPDATA%\electron-builder\Cache"
if exist "%LOCAL_CACHE%\winCodeSign" (
  if not exist "%SYS_CACHE%\winCodeSign" mkdir "%SYS_CACHE%\winCodeSign" 2>nul
  xcopy "%LOCAL_CACHE%\winCodeSign\*" "%SYS_CACHE%\winCodeSign\" /e /i /y /q >nul 2>nul
  xcopy "%LOCAL_CACHE%\nsis\*" "%SYS_CACHE%\nsis\" /e /i /y /q >nul 2>nul
  echo  [OK] Seeded from build-cache\
) else (
  if exist "%SYS_CACHE%\winCodeSign" ( echo  [OK] System cache found ) else ( echo  [..] No cache found )
)
echo.

REM ---- 6. Package ----
echo [6/7] Packaging app...
set "OUTDIR=release\AgentRouter-%VER%"
if exist "%OUTDIR%" rmdir /s /q "%OUTDIR%" 2>nul
mkdir "%OUTDIR%" 2>nul

if "%PORTABLE%"=="1" (
  call npx electron-builder --win portable -c.directories.output=%OUTDIR% >> "%BUILD_LOG%" 2>&1
) else (
  call npx electron-builder --win --dir -c.directories.output=%OUTDIR% >> "%BUILD_LOG%" 2>&1
)
if errorlevel 1 (
  echo FAILED: electron-builder packaging failed.
  echo  Check build.log for details.
  pause & exit /b 1
)

if exist "%OUTDIR%\win-unpacked\AgentRouter.exe" (
  echo  [OK] %OUTDIR%\win-unpacked\AgentRouter.exe
) else if exist "%OUTDIR%\AgentRouter Setup %VER%.exe" (
  echo  [OK] Portable exe
)
echo.

REM ---- 7. Summary ----
echo [7/7] Build summary...
echo.
echo ========================================
echo  BUILD COMPLETE
echo ========================================
echo.
echo  Version:  %VER%
echo  Duration: calculated above
echo  Log:      %BUILD_LOG%
echo.
echo  Agent build status:
echo    CodeWhale   Rust     %AGENT_CW_STATUS%
echo    Reasonix    Node.js  %AGENT_RX_STATUS%
echo    Deep Code   Node.js  %AGENT_DC_STATUS%
echo    OpenCode    Go       %AGENT_OC_STATUS%
echo    Cline       npm      %AGENT_CL_STATUS%
echo    Continue    npm      %AGENT_CN_STATUS%
echo.
if "%PORTABLE%"=="1" ( echo  Output: %OUTDIR%\AgentRouter Setup %VER%.exe ) else ( echo  Output: %OUTDIR%\win-unpacked\AgentRouter.exe )
echo.

if "%CI_MODE%"=="1" exit /b 0
pause
exit /b 0


:check_version
set "V=%~1"
set "P=%~2"
for /f "tokens=1 delims=." %%a in ("%V%") do set "MAJOR=%%a"
set "MAJOR=%MAJOR:v=%"
set "MAJOR=%MAJOR: =%"
if %MAJOR% LSS 18 (
  echo FAILED: Node.js %V% is too old, need v18+
  if defined P echo  Path: %P%
  exit /b 1
)
exit /b 0
