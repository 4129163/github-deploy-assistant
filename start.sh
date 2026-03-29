#!/bin/bash

echo ""
echo "  ===================================="
echo "   🚀 GADA - GitHub 项目部署助手"
echo "  ===================================="
echo ""

# 检测 Node.js
if ! command -v node &>/dev/null; then
  echo "❌ 未检测到 Node.js，请先安装 Node.js 18+"
  echo ""
  echo "   macOS:  brew install node"
  echo "   Ubuntu: sudo apt install nodejs npm"
  echo "   或访问: https://nodejs.org/zh-cn/download/"
  exit 1
fi

NODE_VER=$(node -v)
echo "✅ Node.js 已安装: $NODE_VER"

# 检测 Git
if ! command -v git &>/dev/null; then
  echo "⚠️  未检测到 Git"
  echo "   macOS:  brew install git"
  echo "   Ubuntu: sudo apt install git"
else
  GIT_VER=$(git --version)
  echo "✅ $GIT_VER"
fi

# 安装依赖
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 首次运行，正在安装依赖..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
  fi
  echo "✅ 依赖安装完成"
fi

# 创建 .env
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "✅ 已创建 .env 配置文件"
fi

echo ""
echo "🚀 正在启动 GADA..."
echo "访问地址: http://localhost:3456"
echo "按 Ctrl+C 停止服务"
echo ""

# 打开浏览器
(sleep 2 && {
  if command -v open &>/dev/null; then
    open http://localhost:3456
  elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:3456
  fi
}) &

node src/server/index.js
