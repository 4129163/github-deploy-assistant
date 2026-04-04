#!/bin/bash

# GitHub Deploy Assistant Docker构建脚本
# 用法: ./build-docker.sh [版本号]

set -e

# 默认版本
VERSION=${1:-"latest"}
IMAGE_NAME="kai0339/github-deploy-assistant"

echo "🚀 开始构建 GitHub Deploy Assistant Docker镜像..."
echo "📦 镜像名称: ${IMAGE_NAME}:${VERSION}"

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 构建镜像
echo "🔨 正在构建Docker镜像..."
docker build -t ${IMAGE_NAME}:${VERSION} .

if [ $? -eq 0 ]; then
    echo "✅ Docker镜像构建成功: ${IMAGE_NAME}:${VERSION}"
    
    # 显示镜像信息
    echo ""
    echo "📊 镜像信息:"
    docker images | grep ${IMAGE_NAME}
    
    # 运行测试
    echo ""
    echo "🧪 测试运行容器..."
    docker run --rm -d -p 3456:3456 --name gada-test ${IMAGE_NAME}:${VERSION}
    
    sleep 3
    
    # 检查容器状态
    if docker ps | grep -q gada-test; then
        echo "✅ 容器运行正常"
        echo "🌐 访问地址: http://localhost:3456"
        
        # 停止测试容器
        docker stop gada-test
        echo "🛑 测试容器已停止"
    else
        echo "⚠️  容器启动可能有问题，请检查日志"
        docker logs gada-test
    fi
    
    # 显示使用说明
    echo ""
    echo "📖 使用说明:"
    echo "1. 运行镜像: docker run -p 3456:3456 -v ./workspace:/workspace ${IMAGE_NAME}:${VERSION}"
    echo "2. 使用Docker Compose: docker-compose up -d"
    echo "3. 推送到Docker Hub: docker push ${IMAGE_NAME}:${VERSION}"
    
else
    echo "❌ Docker镜像构建失败"
    exit 1
fi