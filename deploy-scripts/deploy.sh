#!/bin/bash
# GADA 云服务器部署脚本

set -e

REPO_URL="https://github.com/4129163/github-deploy-assistant.git"
INSTALL_DIR="/opt/gada"
SERVICE_NAME="gada"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 开始部署 GitHub Deploy Assistant...${NC}"

# 安装 Node.js（如果未安装）
if ! command -v node &> /dev/null; then
    echo -e "${BLUE}📦 安装 Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 安装 Git（如果未安装）
if ! command -v git &> /dev/null; then
    echo -e "${BLUE}📦 安装 Git...${NC}"
    apt-get update
    apt-get install -y git
fi

# 创建安装目录
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 克隆或更新代码
if [ -d ".git" ]; then
    git pull origin main
else
    git clone "$REPO_URL" .
fi

# 安装依赖
npm install --production

# 创建 .env
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

# 创建工作目录
mkdir -p workspace logs database

# 创建 systemd 服务
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=GitHub Deploy Assistant
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 重载 systemd
systemctl daemon-reload

# 启动服务
systemctl enable $SERVICE_NAME
systemctl restart $SERVICE_NAME

echo -e "${GREEN}✅ 部署完成！${NC}"
echo -e "${GREEN}访问地址: http://$(hostname -I | awk '{print $1}'):3456${NC}"
