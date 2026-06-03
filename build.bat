@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
setlocal enabledelayedexpansion
title AgentRouter Build

set "BUILD_LOG=build.log"
echo Starting > "%BUILD_LOG%"

set "BUILD_AGENT=1"
set "SKIP_FRONTEND=0"
set "CI_MODE=0"

:parse_args
if "%~1"=="--no-agent" set "BUILD_AGENT=0" & shift & goto parse_args
if "%~1"=="--quick" set "SKIP_FRONTEND=1" & shift & goto parse_args
if "%~1"=="--ci" set "CI_MODE=1" & shift & goto parse_args

echo ========================================
echo  AgentRouter Build
echo ========================================
echo  Started: %DATE% %TIME%
echo.

REM --- Find Node.js ---
echo [1/7] Checking Node.js...

set "NODE="
if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2\node.exe" set "NODE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2\node.exe"
if not defined NODE if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.15.0\node.exe" set "NODE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.15.0\node.exe"
if not defined NODE if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"

if defined NODE (
  for /f %%a in ('"%NODE%" -v') do set "NVER=%%a"
  call :check_version "!NVER!"
  if errorlevel 1 pause & exit /b 1
  echo  [OK] !NVER!
  echo  Path: %NODE%
  for %%F in ("%NODE%") do set "NDIR=%%~dpF"
  set "PATH=!NDIR!;%PATH%"
) else (
  where node >nul 2>&1
  if errorlevel 1 (
    echo FAILED: Node.js not found.
    pause & exit /b 1
  )
  for /f %%a in ('node -v') do set "NVER=%%a"
  call :check_version "!NVER!"
  if errorlevel 1 pause & exit /b 1
  echo  [OK] !NVER! (from PATH)
)
echo.
goto :step1

:check_version
set "VER=%~1"
set "NUM=%VER:v=%"
for /f "delims=." %%a in ("%NUM%") do set "MAJ=%%a"
if %MAJ% LSS 18 (
  echo FAILED: Node.js %VER% is too old, need v18+
  exit /b 1
)
exit /b 0

REM --- Install Dependencies ---
:step1
echo [2/7] Installing dependencies...
if not exist "node_modules" (
  echo  Running npm install...
  call npm install >> "%BUILD_LOG%" 2>&1
  if errorlevel 1 (
    echo FAILED: npm install
    pause & exit /b 1
  )
  echo  Dependencies installed
) else (
  echo  node_modules found
)
echo.
goto :step2

REM --- Build Agents ---
:step2
if "%BUILD_AGENT%"=="1" (
  echo [3/7] Building Agent CLIs...
  if exist "agents\reasonix\package.json" (
    pushd agents\reasonix
    call npm run build >> "%BUILD_LOG%" 2>&1
    if !errorlevel! equ 0 ( echo  [OK] Reasonix ) else ( echo  [..] Reasonix build failed )
    popd
  )
  if exist "agents\deepcode\package.json" (
    pushd agents\deepcode
    if not exist "node_modules" call npm install >> "%BUILD_LOG%" 2>&1
    call npm run build >> "%BUILD_LOG%" 2>&1
    if !errorlevel! equ 0 ( echo  [OK] Deep Code ) else ( echo  [..] Deep Code build failed )
    popd
  )
  echo.
)
goto :step3

REM --- Build Electron ---
:step3
echo [4/7] Building Electron TypeScript...
call npm run build:electron >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  echo FAILED: TypeScript compilation
  pause & exit /b 1
)
echo  [OK] dist-electron/
echo.
goto :step4

REM --- Build Frontend ---
:step4
if "%SKIP_FRONTEND%"=="0" (
  echo [5/7] Building Vite frontend...
  call npm run build >> "%BUILD_LOG%" 2>&1
  if errorlevel 1 (
    echo FAILED: Vite build
    pause & exit /b 1
  )
  echo  [OK] dist/
  echo.
)
goto :step5

REM --- Cache ---
:step5
echo [6/7] Preparing build cache...
set "LOCAL_CACHE=%CD%\build-cache"
set "SYS_CACHE=%LOCALAPPDATA%\electron-builder\Cache"
if exist "%LOCAL_CACHE%\winCodeSign" (
  if not exist "%SYS_CACHE%\winCodeSign" mkdir "%SYS_CACHE%\winCodeSign" 2>nul
  xcopy "%LOCAL_CACHE%\winCodeSign\*" "%SYS_CACHE%\winCodeSign\" /e /i /y /q >nul 2>nul
  xcopy "%LOCAL_CACHE%\nsis\*" "%SYS_CACHE%\nsis\" /e /i /y /q >nul 2>nul
  echo  [OK] Cache seeded
) else (
  if exist "%SYS_CACHE%\winCodeSign" ( echo  [OK] System cache found ) else ( echo  [..] No cache found )
)
echo.
goto :step6

REM --- Package ---
:step6
echo [7/7] Packaging app...
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"
for /f "tokens=2 delims=:," %%a in ('type package.json ^| findstr /C:"\"version\""') do set "VER=%%a"
set "VER=%VER:"=%"
set "VER=%VER: =%"
set "VER=%VER:,=%"
set "OUTDIR=release\AgentRouter-%VER%"
if exist "%OUTDIR%" rmdir /s /q "%OUTDIR%" 2>nul
mkdir "%OUTDIR%" 2>nul
call npx electron-builder --win --dir -c.directories.output=%OUTDIR% >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  echo FAILED: electron-builder packaging
  pause & exit /b 1
)
if exist "%OUTDIR%\win-unpacked\AgentRouter.exe" (
  echo  [OK] %OUTDIR%\win-unpacked\AgentRouter.exe
)
echo.
goto :summary

:summary
echo ========================================
echo  BUILD COMPLETE
echo ========================================
echo.
echo  Node: !NVER!
echo  Log:  %BUILD_LOG%
echo.
if "%CI_MODE%"=="1" exit /b 0
pause
