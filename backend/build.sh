#!/bin/bash

# GitHub Deploy Assistant Go 后端构建脚本

echo "正在构建 GitHub Deploy Assistant Go 后端..."

# 设置环境变量
export GO111MODULE=on
export GOPROXY=https://goproxy.cn,direct

# 清理旧的构建文件
echo "清理旧的构建文件..."
rm -rf dist/
mkdir -p dist

# 下载依赖
echo "下载依赖..."
go mod download

# 构建 Linux 版本
echo "构建 Linux 版本..."
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o dist/github-deploy-assistant-linux-amd64 main.go

# 构建 Windows 版本
echo "构建 Windows 版本..."
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o dist/github-deploy-assistant-windows-amd64.exe main.go

# 构建 macOS 版本
echo "构建 macOS 版本..."
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o dist/github-deploy-assistant-darwin-amd64 main.go

# 构建 macOS ARM64 版本
echo "构建 macOS ARM64 版本..."
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o dist/github-deploy-assistant-darwin-arm64 main.go

# 生成配置文件
echo "生成配置文件..."
cat > dist/config.yaml << EOF
server:
  port: 3000
  host: "0.0.0.0"

database:
  file: "data.db"

logging:
  level: "info"
  file: "server.log"

security:
  cors_origins: ["*"]
EOF

# 生成 README
echo "生成 README..."
cat > dist/README.md << EOF
# GitHub Deploy Assistant Go 后端

## 简介
这是 GitHub Deploy Assistant 的 Go 语言后端版本，打包成单个可执行文件，无需安装 Node.js。

## 快速开始

### Linux/macOS
\`\`\`bash
chmod +x github-deploy-assistant-linux-amd64
./github-deploy-assistant-linux-amd64
\`\`\`

### Windows
\`\`\`bash
github-deploy-assistant-windows-amd64.exe
\`\`\`

## 配置
编辑 \`config.yaml\` 文件进行配置。

## 默认端口
- 服务器端口: 3000
- 访问地址: http://localhost:3000

## API 文档
健康检查: \`GET /api/health\`
项目列表: \`GET /api/projects\`
创建项目: \`POST /api/projects\`

## 许可证
MIT
EOF

echo "构建完成！"
echo "构建文件已保存在 dist/ 目录中"
echo ""
echo "可执行文件列表:"
ls -la dist/