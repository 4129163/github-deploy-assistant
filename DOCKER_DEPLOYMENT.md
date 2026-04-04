# 🐳 GitHub Deploy Assistant - Docker部署指南

## 📋 目录
- [快速开始](#快速开始)
- [Docker镜像构建](#docker镜像构建)
- [Docker Compose部署](#docker-compose部署)
- [环境变量配置](#环境变量配置)
- [数据持久化](#数据持久化)
- [健康检查与监控](#健康检查与监控)
- [CI/CD自动构建](#cicd自动构建)
- [故障排除](#故障排除)

---

## 🚀 快速开始

### 使用官方镜像（推荐）
```bash
# 一键运行GitHub Deploy Assistant
docker run -d \
  --name github-deploy-assistant \
  -p 3456:3456 \
  -v $(pwd)/workspace:/workspace \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/database:/app/database \
  kai0339/github-deploy-assistant:latest
```

### 使用Docker Compose
```bash
# 下载配置文件
curl -O https://gitee.com/kai0339/github-deploy-assistant/raw/main/docker-compose.yml

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 验证部署
```bash
# 检查容器状态
docker ps

# 检查健康状态
curl http://localhost:3456/api/health

# 查看日志
docker logs github-deploy-assistant
```

---

## 🔨 Docker镜像构建

### 构建自己的镜像
```bash
# 克隆仓库
git clone https://gitee.com/kai0339/github-deploy-assistant.git
cd github-deploy-assistant

# 使用构建脚本
./build-docker.sh

# 或手动构建
docker build -t your-username/github-deploy-assistant:latest .
```

### 多阶段构建说明
Dockerfile采用多阶段构建：
1. **构建阶段**：安装生产依赖
2. **运行阶段**：创建非root用户，设置权限，配置环境

### 镜像标签策略
```bash
# 版本标签
docker build -t kai0339/github-deploy-assistant:1.0.0 .

# 最新标签
docker build -t kai0339/github-deploy-assistant:latest .

# 推送镜像
docker push kai0339/github-deploy-assistant:latest
```

---

## 🐳 Docker Compose部署

### 完整配置文件
创建 `docker-compose.yml`：
```yaml
version: '3.8'

services:
  gada:
    image: kai0339/github-deploy-assistant:latest
    container_name: github-deploy-assistant
    restart: unless-stopped
    ports:
      - "3456:3456"
    volumes:
      - ./workspace:/workspace
      - ./logs:/app/logs
      - ./database:/app/database
    environment:
      - NODE_ENV=production
      - PORT=3456
      - HOST=0.0.0.0
      - WORK_DIR=/workspace
      - LOG_LEVEL=info
    networks:
      - gada-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3456/api/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s

networks:
  gada-network:
    driver: bridge
```

### 生产环境配置
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  gada:
    image: kai0339/github-deploy-assistant:latest
    container_name: github-deploy-assistant
    restart: always
    ports:
      - "3456:3456"
    volumes:
      - /data/gada/workspace:/workspace
      - /data/gada/logs:/app/logs
      - /data/gada/database:/app/database
    environment:
      - NODE_ENV=production
      - PORT=3456
      - HOST=0.0.0.0
      - WORK_DIR=/workspace
      - LOG_LEVEL=warn
      - GADA_SECRET_KEY=${GADA_SECRET_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
      - JWT_SECRET=${JWT_SECRET}
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '1'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## ⚙️ 环境变量配置

### 核心环境变量
| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | 3456 | 服务端口 |
| `HOST` | 0.0.0.0 | 绑定地址 |
| `NODE_ENV` | production | 运行环境 |
| `WORK_DIR` | /workspace | 工作目录 |
| `LOG_LEVEL` | info | 日志级别 |
| `ALLOW_AUTO_EXEC` | true | 允许自动执行 |

### 安全配置
```bash
# 生成随机密钥
openssl rand -base64 32

# 设置环境变量
export GADA_SECRET_KEY="生成的密钥"
export SESSION_SECRET="会话密钥"
export JWT_SECRET="JWT密钥"
```

### 数据库配置
```bash
# 使用SQLite（默认）
export DB_PATH=/app/database/gada.db

# 或使用PostgreSQL
export DATABASE_URL=postgresql://user:password@postgres:5432/gada
```

---

## 💾 数据持久化

### 必须挂载的目录
```bash
# 工作目录 - 存储项目数据
-v ./workspace:/workspace

# 日志目录 - 存储运行日志
-v ./logs:/app/logs

# 数据库目录 - 存储SQLite数据库
-v ./database:/app/database
```

### 备份策略
```bash
# 创建备份脚本 backup.sh
#!/bin/bash
BACKUP_DIR="/backups/gada"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份数据库
docker exec github-deploy-assistant tar -czf /tmp/db_backup_$DATE.tar.gz /app/database

# 备份工作目录
docker exec github-deploy-assistant tar -czf /tmp/workspace_backup_$DATE.tar.gz /workspace

# 复制到宿主机
docker cp github-deploy-assistant:/tmp/db_backup_$DATE.tar.gz $BACKUP_DIR/
docker cp github-deploy-assistant:/tmp/workspace_backup_$DATE.tar.gz $BACKUP_DIR/

# 清理旧备份（保留最近7天）
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

---

## 🩺 健康检查与监控

### 内置健康检查
```bash
# 手动检查
curl http://localhost:3456/api/health

# 预期响应
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

### Prometheus监控
```yaml
# docker-compose.monitor.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - monitor-network

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3000:3000"
    networks:
      - monitor-network

networks:
  monitor-network:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:
```

---

## 🔄 CI/CD自动构建

### Gitee CI配置 (.gitee-ci.yml)
```yaml
version: '1.0'
name: Docker Build and Push

stages:
  - build
  - test
  - deploy

variables:
  IMAGE_NAME: kai0339/github-deploy-assistant
  DOCKER_REGISTRY: registry.cn-hangzhou.aliyuncs.com

before_script:
  - echo "开始构建Docker镜像..."

build:
  stage: build
  script:
    - docker build -t $IMAGE_NAME:$CI_COMMIT_SHA .
    - docker tag $IMAGE_NAME:$CI_COMMIT_SHA $IMAGE_NAME:latest
  only:
    - main
    - master

test:
  stage: test
  script:
    - docker run --rm $IMAGE_NAME:$CI_COMMIT_SHA npm test
    - docker run --rm -p 3456:3456 -d --name test-container $IMAGE_NAME:$CI_COMMIT_SHA
    - sleep 10
    - curl -f http://localhost:3456/api/health || exit 1
    - docker stop test-container
  only:
    - main
    - master

deploy:
  stage: deploy
  script:
    - echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin $DOCKER_REGISTRY
    - docker push $IMAGE_NAME:$CI_COMMIT_SHA
    - docker push $IMAGE_NAME:latest
  only:
    - tags
```

### GitHub Actions配置 (.github/workflows/docker.yml)
```yaml
name: Docker Build and Push

on:
  push:
    branches: [ main, master ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to Docker Hub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: kai0339/github-deploy-assistant
    
    - name: Build and push
      uses: docker/build-push-action@v4
      with:
        context: .
        push: ${{ github.event_name != 'pull_request' }}
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
```

---

## 🐛 故障排除

### 常见问题

#### 1. 端口被占用
```bash
# 检查端口占用
netstat -tulpn | grep 3456

# 更改端口
docker run -p 4567:3456 ...  # 将外部端口改为4567
```

#### 2. 权限问题
```bash
# 检查目录权限
ls -la ./workspace

# 修复权限
sudo chown -R 1001:1001 ./workspace ./logs ./database
```

#### 3. 容器无法启动
```bash
# 查看容器日志
docker logs github-deploy-assistant

# 检查容器状态
docker inspect github-deploy-assistant

# 进入容器调试
docker exec -it github-deploy-assistant sh
```

#### 4. 内存不足
```yaml
# 在docker-compose中限制内存
deploy:
  resources:
    limits:
      memory: 512M
    reservations:
      memory: 256M
```

### 调试命令
```bash
# 查看容器资源使用
docker stats github-deploy-assistant

# 查看容器进程
docker top github-deploy-assistant

# 查看容器网络
docker network inspect bridge

# 导出容器配置
docker inspect github-deploy-assistant > container_info.json
```

---

## 📞 支持与帮助

### 获取帮助
1. **查看文档**：阅读 [README.md](README.md)
2. **检查日志**：`docker logs github-deploy-assistant`
3. **社区支持**：访问 [Gitee Issues](https://gitee.com/kai0339/github-deploy-assistant/issues)

### 报告问题
```bash
# 收集诊断信息
docker version
docker-compose version
docker inspect github-deploy-assistant
docker logs github-deploy-assistant > gada_logs.txt
```

### 更新镜像
```bash
# 拉取最新镜像
docker pull kai0339/github-deploy-assistant:latest

# 重启服务
docker-compose down
docker-compose pull
docker-compose up -d
```

---

**🎉 祝你使用愉快！如果有任何问题，请随时联系我们。**