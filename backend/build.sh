#!/bin/bash

# GitHub Deploy Assistant Go 后端构建脚本
# 构建单文件二进制，无需Node.js依赖

set -e

# 版本信息
VERSION="3.0.0"
BUILD_DATE=$(date +%Y-%m-%d)
BUILD_TIME=$(date +%H:%M:%S)

echo "========================================="
echo "GitHub Deploy Assistant Go 后端构建"
echo "版本: $VERSION"
echo "构建时间: $BUILD_DATE $BUILD_TIME"
echo "========================================="

# 清理之前的构建
echo "清理构建目录..."
rm -rf build/
mkdir -p build/{linux,windows,macos}

# 构建Linux版本 (x86_64)
echo "构建Linux x86_64版本..."
GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -X main.version=$VERSION -X main.buildDate=$BUILD_DATE" \
    -o build/linux/gda-server \
    main.go

# 构建Windows版本 (x86_64)
echo "构建Windows x86_64版本..."
GOOS=windows GOARCH=amd64 go build \
    -ldflags="-s -w -X main.version=$VERSION -X main.buildDate=$BUILD_DATE" \
    -o build/windows/gda-server.exe \
    main.go

# 构建macOS版本 (x86_64)
echo "构建macOS x86_64版本..."
GOOS=darwin GOARCH=amd64 go build \
    -ldflags="-s -w -X main.version=$VERSION -X main.buildDate=$BUILD_DATE" \
    -o build/macos/gda-server-macos \
    main.go

# 构建macOS版本 (ARM64)
echo "构建macOS ARM64版本..."
GOOS=darwin GOARCH=arm64 go build \
    -ldflags="-s -w -X main.version=$VERSION -X main.buildDate=$BUILD_DATE" \
    -o build/macos/gda-server-macos-arm64 \
    main.go

# 创建静态链接版本（可选）
echo "构建静态链接版本..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -a -ldflags="-s -w -extldflags '-static' -X main.version=$VERSION -X main.buildDate=$BUILD_DATE" \
    -o build/linux/gda-server-static \
    main.go

# 检查文件大小
echo ""
echo "构建完成，文件大小："
echo "========================================="
ls -lh build/linux/gda-server
ls -lh build/linux/gda-server-static
ls -lh build/windows/gda-server.exe
ls -lh build/macos/gda-server-macos
ls -lh build/macos/gda-server-macos-arm64

# 创建压缩包
echo ""
echo "创建发布包..."
cd build
tar -czf gda-server-linux-amd64-$VERSION.tar.gz -C linux .
tar -czf gda-server-linux-static-$VERSION.tar.gz -C linux gda-server-static
zip -q gda-server-windows-amd64-$VERSION.zip -j windows/gda-server.exe
tar -czf gda-server-macos-amd64-$VERSION.tar.gz -C macos gda-server-macos
tar -czf gda-server-macos-arm64-$VERSION.tar.gz -C macos gda-server-macos-arm64
cd ..

echo ""
echo "发布包已创建："
echo "========================================="
ls -lh build/*.tar.gz build/*.zip

# 创建快速启动脚本
echo ""
echo "创建快速启动脚本..."
cat > build/start.sh << 'EOF'
#!/bin/bash
# GitHub Deploy Assistant 快速启动脚本

set -e

VERSION="3.0.0"
PORT=${PORT:-3000}
DATA_DIR="./data"

echo "========================================="
echo "GitHub Deploy Assistant v$VERSION"
echo "========================================="

# 检查是否已安装
if [ ! -f "./gda-server" ]; then
    echo "错误: gda-server 二进制文件不存在"
    echo "请从发布包中解压 gda-server 文件到当前目录"
    exit 1
fi

# 检查文件权限
if [ ! -x "./gda-server" ]; then
    echo "设置执行权限..."
    chmod +x ./gda-server
fi

# 创建数据目录
mkdir -p "$DATA_DIR"

echo "启动参数:"
echo "  端口: $PORT"
echo "  数据目录: $DATA_DIR"
echo "  版本: $VERSION"
echo "========================================="

# 设置环境变量并启动
PORT=$PORT ./gda-server
EOF

chmod +x build/start.sh

cat > build/start.bat << 'EOF'
@echo off
REM GitHub Deploy Assistant Windows 启动脚本

echo =========================================
echo GitHub Deploy Assistant v3.0.0
echo =========================================

REM 检查是否已安装
if not exist "gda-server.exe" (
    echo 错误: gda-server.exe 文件不存在
    echo 请从发布包中解压 gda-server.exe 文件到当前目录
    pause
    exit /b 1
)

REM 创建数据目录
if not exist "data" mkdir data

echo 启动参数:
echo   端口: %PORT%
if "%PORT%"=="" set PORT=3000
echo   数据目录: data
echo   版本: 3.0.0
echo =========================================

REM 设置环境变量并启动
set PORT=%PORT%
gda-server.exe
EOF

# 创建README文件
cat > build/README.md << 'EOF'
# GitHub Deploy Assistant Go 后端

## 版本 v3.0.0

### 特性
- 完全替代 Node.js 后端，无 Node.js 依赖
- 单文件二进制，下载即可运行
- 支持 Linux, Windows, macOS 系统
- 静态链接版本，无需额外依赖库
- 性能更好，内存占用更低

### 快速开始

#### Linux/macOS
```bash
# 下载对应版本
# 解压并运行
chmod +x gda-server
./gda-server
# 或使用启动脚本
chmod +x start.sh
./start.sh
```

#### Windows
```bash
# 下载 Windows 版本
# 双击 gda-server.exe 或运行
start.bat
```

### 默认配置
- 端口: 3000 (可通过 PORT 环境变量修改)
- 数据目录: ./data
- API 端点: http://localhost:3000/api

### 健康检查
```bash
curl http://localhost:3000/api/health
```

### 版本信息
```bash
curl http://localhost:3000/api/version
```

### 构建说明
如需从源码构建，请运行:
```bash
cd backend
./build.sh
```

### 从 Node.js 迁移
1. 停止 Node.js 服务
2. 下载 Go 二进制文件
3. 复制配置文件
4. 启动 Go 服务
5. 验证功能正常

### 许可证
MIT
EOF

echo ""
echo "构建完成！"
echo "========================================="
echo "二进制文件位置: build/"
echo "启动脚本: build/start.sh (Linux/macOS)"
echo "启动脚本: build/start.bat (Windows)"
echo "README: build/README.md"
echo "========================================="
echo "使用方法:"
echo "  1. 将对应平台的二进制文件复制到目标位置"
echo "  2. 运行启动脚本或直接执行二进制文件"
echo "  3. 访问 http://localhost:3000"
echo "========================================="