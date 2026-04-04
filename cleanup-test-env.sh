#!/bin/bash

echo "🧹 清理测试环境..."

# 删除测试数据
rm -rf test-data
rm -f test-config.json
rm -f .env.test

echo "✅ 测试环境清理完成！"
