@echo off
chcp 65001 >nul
title AgentRouter 构建脚本

echo ═══════════════════════════════════════
echo  AgentRouter 构建脚本
echo ═══════════════════════════════════════
echo.

REM ── 获取版本号 ──
for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"version\"" package.json') do (
  set VERSION=%%~a
  goto :gotversion
)
:gotversion
set VERSION=%VERSION:"=%
set VERSION=%VERSION: =%
echo 版本: v%VERSION%
echo.

REM ── 构建后端 TypeScript ──
echo [1/4] 编译 Electron TypeScript...
call npm run build:electron
if %errorlevel% neq 0 (
  echo ❌ TypeScript 编译失败
  pause
  exit /b 1
)
echo ✅ TypeScript 编译完成
echo.

REM ── 构建前端 Vite ──
echo [2/4] 构建 Vite 前端...
call npx vite build
if %errorlevel% neq 0 (
  echo ❌ Vite 构建失败
  pause
  exit /b 1
)
echo ✅ Vite 构建完成
echo.

REM ── 打包为便携版 exe ──
echo [3/4] 打包为 Windows 便携版 exe...
echo ⚠ 如果你看到 symlink 错误，请以管理员身份重新运行此脚本
call npx electron-builder --win portable
if %errorlevel% neq 0 (
  echo ❌ 打包失败
  echo.
  echo 常见原因:
  echo   1. 需要以管理员身份运行（右键 → 以管理员身份运行）
  echo   2. 网络问题，GitHub 下载超时
  echo.
  pause
  exit /b 1
)
echo ✅ 打包完成
echo.

REM ── 整理到版本号目录 ──
echo [4/4] 整理输出文件...
set OUTPUT_DIR=release\AgentRouter-%VERSION%
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"
if exist "release\AgentRouter-%VERSION%.exe" (
  move "release\AgentRouter-%VERSION%.exe" "%OUTPUT_DIR%\" >nul
  echo ✅ 便携版: %OUTPUT_DIR%\AgentRouter-%VERSION%.exe
)
echo.

echo ═══════════════════════════════════════
echo  ✅ 构建成功
echo ═══════════════════════════════════════
echo.
echo 输出目录: %OUTPUT_DIR%
echo.
pause
