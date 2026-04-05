# 项目编排DSL规范

## 概述
项目编排DSL（领域特定语言）用于定义多应用组合部署的配置，支持一键部署如Lobe Chat + MinIO等组合应用，自动配置网络连接和依赖启动顺序。

## DSL语法规范

### 基本结构
```yaml
version: "1.0"
name: "应用编排名称"
description: "应用编排描述"

applications:
  - name: "应用1名称"
    type: "docker-compose|docker|node|python|go"
    source: "github.com/owner/repo|docker-image|local-path"
    version: "v1.0.0"
    dependencies:
      - "应用2名称"
      - "redis"
    environment:
      - "ENV_VAR=value"
    ports:
      - "3000:3000"
    volumes:
      - "./data:/app/data"
    health_check:
      endpoint: "/health"
      interval: 30
      timeout: 10
      retries: 3

networks:
  - name: "backend-network"
    driver: "bridge"
    subnet: "172.20.0.0/16"

dependencies:
  - name: "redis"
    type: "external-service"
    image: "redis:alpine"
    ports:
      - "6379:6379"
    environment:
      - "REDIS_PASSWORD=password"

startup_order:
  - "redis"
  - "应用2名称"
  - "应用1名称"
```

### 字段说明

#### 应用定义 (applications)
- **name**: 应用唯一标识符
- **type**: 应用类型
  - `docker-compose`: Docker Compose项目
  - `docker`: 单个Docker容器
  - `node`: Node.js应用
  - `python`: Python应用
  - `go`: Go应用
  - `java`: Java应用
- **source**: 应用源
  - GitHub仓库URL
  - Docker镜像名称
  - 本地路径
- **version**: 版本号或分支/标签
- **dependencies**: 依赖的其他应用或服务
- **environment**: 环境变量
- **ports**: 端口映射
- **volumes**: 卷映射
- **health_check**: 健康检查配置

#### 网络配置 (networks)
- **name**: 网络名称
- **driver**: 网络驱动
- **subnet**: 子网配置

#### 外部依赖 (dependencies)
- **name**: 依赖服务名称
- **type**: 依赖类型
- **image**: Docker镜像
- **ports**: 端口配置
- **environment**: 环境变量

#### 启动顺序 (startup_order)
- 定义应用启动的先后顺序
- 支持依赖关系解析

## 示例配置

### Lobe Chat + MinIO组合
```yaml
version: "1.0"
name: "lobe-chat-minio-stack"
description: "Lobe Chat AI助手与MinIO对象存储组合部署"

applications:
  - name: "minio"
    type: "docker"
    source: "minio/minio:latest"
    environment:
      - "MINIO_ROOT_USER=admin"
      - "MINIO_ROOT_PASSWORD=password123"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - "./minio-data:/data"
    command: "server /data --console-address :9001"
    health_check:
      endpoint: "/minio/health/live"
      interval: 30

  - name: "lobe-chat"
    type: "docker-compose"
    source: "https://github.com/lobehub/lobe-chat"
    version: "main"
    dependencies:
      - "minio"
    environment:
      - "STORAGE_TYPE=minio"
      - "MINIO_ENDPOINT=http://minio:9000"
      - "MINIO_ACCESS_KEY=admin"
      - "MINIO_SECRET_KEY=password123"
      - "MINIO_BUCKET=lobe-chat"
    ports:
      - "3210:3210"

networks:
  - name: "chat-network"
    driver: "bridge"

startup_order:
  - "minio"
  - "lobe-chat"
```

### Node.js + Redis + PostgreSQL组合
```yaml
version: "1.0"
name: "node-redis-pg-stack"
description: "Node.js应用 + Redis缓存 + PostgreSQL数据库"

applications:
  - name: "postgres"
    type: "docker"
    source: "postgres:15-alpine"
    environment:
      - "POSTGRES_DB=myapp"
      - "POSTGRES_USER=admin"
      - "POSTGRES_PASSWORD=secret"
    ports:
      - "5432:5432"
    volumes:
      - "./postgres-data:/var/lib/postgresql/data"

  - name: "redis"
    type: "docker"
    source: "redis:7-alpine"
    ports:
      - "6379:6379"
    volumes:
      - "./redis-data:/data"

  - name: "node-app"
    type: "node"
    source: "https://github.com/user/node-app"
    version: "main"
    dependencies:
      - "postgres"
      - "redis"
    environment:
      - "DATABASE_URL=postgresql://admin:secret@postgres:5432/myapp"
      - "REDIS_URL=redis://redis:6379"
    ports:
      - "3000:3000"

startup_order:
  - "postgres"
  - "redis"
  - "node-app"
```

## DSL解析规则

### 依赖解析算法
1. 构建有向图，节点为应用，边为依赖关系
2. 使用拓扑排序确定启动顺序
3. 检测循环依赖并报错
4. 支持多级依赖关系

### 网络配置规则
1. 同一网络内的应用可以通过服务名互相访问
2. 支持跨网络通信配置
3. 自动生成网络别名

### 健康检查策略
1. 按配置顺序等待依赖服务健康
2. 超时重试机制
3. 失败回滚策略

## 实现模块

### 1. DSL解析器 (orchestration-parser.js)
- YAML/JSON解析
- 语法验证
- 依赖关系提取

### 2. 依赖管理器 (dependency-manager.js)
- 拓扑排序
- 循环依赖检测
- 启动顺序生成

### 3. 部署执行器 (orchestration-deployer.js)
- 按顺序部署应用
- 网络配置管理
- 健康检查监控

### 4. 状态管理器 (orchestration-state.js)
- 部署状态跟踪
- 错误恢复
- 日志记录

## 集成点

### 与现有系统集成
1. 扩展 `src/services/deploy.js` 支持编排部署
2. 新增CLI命令 `gada orchestrate <config-file>`
3. Web UI支持编排配置可视化
4. 模板市场添加编排模板

### API接口
```javascript
POST /api/orchestrate/deploy
{
  "config": "yaml配置内容",
  "name": "部署名称"
}

GET /api/orchestrate/status/:id
GET /api/orchestrate/logs/:id
DELETE /api/orchestrate/stop/:id
```

## 错误处理

### 验证错误
- 语法错误
- 缺少必需字段
- 类型不匹配
- 循环依赖

### 部署错误
- 网络连接失败
- 镜像拉取失败
- 端口冲突
- 健康检查超时

### 恢复策略
1. 自动重试（可配置次数）
2. 部分回滚
3. 状态保存和恢复
4. 详细错误日志

## 安全考虑

### 输入验证
- 限制文件路径访问
- 验证URL和镜像源
- 环境变量安全检查
- 命令注入防护

### 权限控制
- 最小权限原则
- 容器用户配置
- 卷挂载权限
- 网络隔离

## 性能优化

### 并行部署
- 无依赖关系的应用并行启动
- 镜像预拉取
- 缓存优化

### 资源管理
- 内存限制
- CPU限制
- 网络带宽控制
- 磁盘空间监控

## 监控和日志

### 监控指标
- 部署成功率
- 启动时间
- 资源使用率
- 健康状态

### 日志格式
```json
{
  "timestamp": "2026-04-05T07:30:48Z",
  "level": "info",
  "orchestration_id": "uuid",
  "application": "app-name",
  "stage": "deploy|start|health-check",
  "status": "success|failure",
  "message": "详细描述",
  "duration_ms": 1234
}
```

## 未来扩展

### 计划功能
1. 动态扩缩容
2. 蓝绿部署
3. 金丝雀发布
4. 自动回滚
5. 多环境支持（开发、测试、生产）

### 集成生态
1. Kubernetes支持
2. Terraform集成
3. CI/CD流水线
4. 监控告警集成