@echo off
chcp 65001 >nul
title GADA - GitHub 部署助手

echo.
echo  ====================================
echo   🚀 GADA - GitHub 项目部署助手
echo  ====================================
echo.

:: 检测 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo ❌ 未检测到 Node.js，请先安装 Node.js 18 或以上版本。
  echo.
  echo 下载地址: https://nodejs.org/zh-cn/download/
  echo.
  echo 安装完成后，重新双击本文件即可启动。
  pause
  start https://nodejs.org/zh-cn/download/
  exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo ✅ Node.js 已安装: %NODE_VER%

:: 检测 Git
where git >nul 2>&1
if %errorlevel% neq 0 (
  echo ⚠️  未检测到 Git，部分功能可能受限。
  echo     下载地址: https://git-scm.com/downloads
  echo.
) else (
  for /f "tokens=*" %%i in ('git --version') do set GIT_VER=%%i
  echo ✅ Git 已安装: %GIT_VER%
)

:: 安装依赖
if not exist "node_modules" (
  echo.
  echo 📦 首次运行，正在安装依赖，请稍候...
  call npm install --registry https://registry.npmmirror.com
  if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败，请检查网络连接后重试。
    pause
    exit /b 1
  )
  echo ✅ 依赖安装完成。
)

:: 创建 .env 文件（如果不存在）
if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo ✅ 已创建 .env 配置文件
  )
)

echo.
echo 🚀 正在启动 GADA 服务...
echo.
echo 启动后请在浏览器访问: http://localhost:3456
echo 关闭此窗口即可停止服务
echo.

:: 延迟 2 秒后打开浏览器
powershell -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3456'"

:: 启动服务
node src/server/index.js

pause
