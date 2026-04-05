# 资源完全隔离（基于 Docker）功能文档

## 概述

GitHub Deploy Assistant (GADA) 现在支持基于 Docker 的完全资源隔离功能。每个项目可以运行在独立的 Docker 容器中，彻底避免依赖冲突和环境影响。

## 功能特性

### v3.0 资源完全隔离功能
- **完全隔离**: 每个项目运行在独立的 Docker 容器中
- **依赖隔离**: 避免不同项目间的依赖冲突
- **环境隔离**: 独立的运行时环境，不受主机环境影响
- **网络隔离**: 独立的网络命名空间
- **资源控制**: 可配置 CPU、内存限制（未来版本）

### 支持的模式
1. **默认运行时**: 在当前环境中直接运行项目（传统模式）
2. **Docker 容器运行时**: 在独立 Docker 容器中运行（推荐用于生产环境）

## 使用方法

### 1. 安装 Docker
确保系统中已安装 Docker：
```bash
# 检查 Docker 是否安装
docker --version

# 如果未安装，请参考官方文档安装
# https://docs.docker.com/get-docker/
```

### 2. 使用新的 CLI 工具

#### 安装项目后
```bash
# 使用支持运行时的新 CLI
npm install -g github-deploy-assistant

# 或者使用项目内的 CLI
node src/cli/with-runtime.js
```

#### 命令行用法
```bash
# 列出可用运行时选项
gada-runtime runtime list

# 检查 Docker 环境
gada-runtime runtime check

# 分析并部署项目（带容器运行时）
gada-runtime analyze https://github.com/user/repo --runtime=docker --port=8080

# 部署现有项目
gada-runtime deploy <project-id> --runtime=docker --port=3000

# 使用环境变量
gada-runtime deploy <project-id> --runtime=docker --env NODE_ENV=production --env API_KEY=xxx

# 交互模式
gada-runtime --interactive
```

### 3. 在现有项目中使用

如果你已经使用 GADA 管理项目，可以切换到容器运行时：

```bash
# 查看现有项目
gada-runtime project list

# 部署项目到容器
gada-runtime deploy <project-id> --runtime=docker
```

## 技术实现

### 容器运行时适配层

位于 `src/services/container-runtime.js`:
- `ContainerRuntime`: 运行时基类
- `DockerContainerRuntime`: Docker 实现
- `ContainerRuntimeFactory`: 运行时工厂

### 部署服务增强

位于 `src/services/deploy-with-runtime.js`:
- 支持 `--runtime=docker` 参数
- 自动检测项目类型并生成合适的 Dockerfile
- 完整的容器生命周期管理

### CLI 增强

位于 `src/cli/with-runtime.js`:
- 统一的命令行接口
- 交互式部署向导
- 运行时环境检查

## 项目类型支持

### Node.js 项目
- 自动检测 `package.json`
- 生成优化的 Node.js Dockerfile
- 使用生产模式安装依赖

### Python 项目
- 自动检测 `requirements.txt`
- 生成 Python Dockerfile
- 使用虚拟环境

### 通用项目
- 基础 Alpine Linux 镜像
- 可自定义启动命令

## Dockerfile 自动生成

系统会根据项目类型自动生成合适的 Dockerfile:

### Node.js 项目
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
USER node
CMD ["npm", "start"]
```

### Python 项目
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
```

## 容器管理命令

部署后，你可以使用标准 Docker 命令管理容器：

```bash
# 查看容器状态
docker ps --filter "name=gada-"

# 查看容器日志
docker logs -f gada-<project-name>

# 进入容器
docker exec -it gada-<project-name> sh

# 停止容器
docker stop gada-<project-name>

# 删除容器
docker rm gada-<project-name>
```

## 配置选项

### 环境变量
```bash
# 部署时设置环境变量
gada-runtime deploy <id> --env NODE_ENV=production --env PORT=8080
```

### 端口映射
```bash
# 自定义端口映射
gada-runtime deploy <id> --runtime=docker --port=8080
# 主机端口 8080 映射到容器端口 8080
```

### 网络配置
- 每个项目创建独立的 Docker 网络
- 支持项目间网络隔离
- 可配置网络驱动（未来版本）

## 安全性

### 安全特性
1. **非 root 用户运行**: 容器内使用非 root 用户
2. **资源限制**: 可配置 CPU、内存限制
3. **只读文件系统**: 支持只挂载必要目录
4. **网络策略**: 限制容器网络访问

### 安全建议
1. 定期更新基础镜像
2. 使用最小化基础镜像（Alpine）
3. 扫描镜像漏洞
4. 限制容器权限

## 故障排除

### 常见问题

#### 1. Docker 未安装
```
错误: Docker 运行时不可用: Command failed with code 127
```
解决方案：安装 Docker

#### 2. Docker 服务未运行
```
错误: Cannot connect to the Docker daemon
```
解决方案：启动 Docker 服务
```bash
# Linux
sudo systemctl start docker

# macOS
open -a Docker
```

#### 3. 权限不足
```
错误: permission denied while trying to connect to the Docker daemon socket
```
解决方案：将用户添加到 docker 组
```bash
sudo usermod -aG docker $USER
# 需要重新登录
```

#### 4. 端口冲突
```
错误: Bind for 0.0.0.0:3000 failed: port is already allocated
```
解决方案：使用其他端口
```bash
gada-runtime deploy <id> --port=3001
```

## 性能优化

### 构建优化
- 使用多阶段构建减小镜像大小
- 利用 Docker 构建缓存
- 按需安装依赖

### 运行时优化
- 使用轻量级基础镜像
- 限制资源使用
- 优化启动时间

## 未来规划

### v3.1 版本计划
1. **Firecracker 支持**: 更轻量的容器运行时
2. **GPU 支持**: 机器学习项目支持
3. **持久化存储**: 数据库和文件持久化
4. **集群部署**: 多节点容器编排

### v3.2 版本计划
1. **资源配额**: CPU、内存、磁盘限制
2. **健康检查**: 自动健康监测和恢复
3. **监控集成**: Prometheus、Grafana 集成
4. **日志聚合**: 集中式日志管理

## 示例

### 完整部署示例
```bash
# 1. 分析仓库
gada-runtime analyze https://github.com/example/node-app

# 2. 选择 Docker 运行时
# （交互式选择）

# 3. 部署到容器
gada-runtime deploy 1 --runtime=docker --port=3000 --env NODE_ENV=production

# 4. 验证部署
curl http://localhost:3000
```

### 批量部署
```bash
# 部署多个项目到独立容器
for project_id in 1 2 3; do
  gada-runtime deploy $project_id --runtime=docker --port=$((3000+$project_id))
done
```

## 贡献指南

欢迎贡献代码和文档！请参考 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。