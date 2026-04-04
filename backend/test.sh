#!/bin/bash

# GitHub Deploy Assistant Go 后端测试脚本

echo "正在测试 GitHub Deploy Assistant Go 后端..."

# 构建项目
echo "1. 构建项目..."
go build -o test-server main.go

if [ $? -ne 0 ]; then
    echo "构建失败!"
    exit 1
fi

echo "构建成功!"

# 启动测试服务器
echo "2. 启动测试服务器..."
./test-server &
SERVER_PID=$!

# 等待服务器启动
echo "等待服务器启动..."
sleep 3

# 测试健康检查
echo "3. 测试健康检查..."
curl -s http://localhost:3000/api/health | python3 -m json.tool

if [ $? -ne 0 ]; then
    echo "健康检查失败!"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# 测试获取项目列表
echo "4. 测试获取项目列表..."
curl -s http://localhost:3000/api/projects | python3 -m json.tool

if [ $? -ne 0 ]; then
    echo "获取项目列表失败!"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# 测试创建项目
echo "5. 测试创建项目..."
curl -s -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-go-app",
    "type": "Go",
    "port": 8080,
    "path": "/tmp/test-go-app"
  }' | python3 -m json.tool

if [ $? -ne 0 ]; then
    echo "创建项目失败!"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# 测试获取单个项目
echo "6. 测试获取单个项目..."
curl -s http://localhost:3000/api/projects/1 | python3 -m json.tool

if [ $? -ne 0 ]; then
    echo "获取单个项目失败!"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# 测试获取活动列表
echo "7. 测试获取活动列表..."
curl -s http://localhost:3000/api/activities | python3 -m json.tool

if [ $? -ne 0 ]; then
    echo "获取活动列表失败!"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# 停止服务器
echo "8. 停止测试服务器..."
kill $SERVER_PID 2>/dev/null

# 清理
echo "9. 清理..."
rm -f test-server

echo "测试完成！所有测试通过！"