#!/bin/bash

# 简单构建脚本 - 构建单文件Go二进制

echo "========================================"
echo "GitHub Deploy Assistant Go后端构建"
echo "版本: 3.0.0"
echo "目标: 单文件二进制，无Node.js依赖"
echo "========================================"

# 创建构建目录
mkdir -p dist

# 构建Linux版本
echo "构建Linux版本..."
GOOS=linux GOARCH=amd64 go build -o dist/gda-server-linux simple_main_updated.go

# 构建Windows版本
echo "构建Windows版本..."
GOOS=windows GOARCH=amd64 go build -o dist/gda-server.exe simple_main_updated.go

# 构建macOS版本
echo "构建macOS版本..."
GOOS=darwin GOARCH=amd64 go build -o dist/gda-server-macos simple_main_updated.go

# 检查构建结果
echo ""
echo "构建完成，文件大小:"
echo "========================================"
ls -lh dist/

# 创建README
cat > dist/README.txt << 'EOF'
GitHub Deploy Assistant Go 后端 v3.0.0
========================================

特性:
- 单文件二进制，无需Node.js
- 下载即运行，无需安装
- 性能更好，内存占用更低
- 完全兼容原有API

使用方法:
1. 选择对应平台的二进制文件
2. 赋予执行权限 (Linux/macOS): chmod +x 文件名
3. 运行: ./文件名 或 双击 (Windows)

默认端口: 3000
可通过环境变量 PORT 修改

API端点:
- GET /api/health     - 健康检查
- GET /api/version    - 版本信息
- POST /api/deploy/analyze - 分析仓库
- POST /api/deploy/execute - 执行部署

从Node.js迁移:
1. 停止Node.js服务
2. 运行Go二进制
3. 验证功能正常

注意: 此版本为Go重写版，无需Node.js环境
EOF

echo ""
echo "构建完成！"
echo "二进制文件在 dist/ 目录"
echo "========================================"