# 项目编排功能快速入门

## 概述
项目编排功能允许您一键部署组合应用，如Lobe Chat + MinIO，自动配置网络连接和依赖启动顺序。

## 功能特性
- **编排DSL解析**: 支持YAML/JSON格式的编排配置
- **依赖管理**: 自动拓扑排序，检测循环依赖
- **一键部署**: 按顺序部署组合应用
- **网络配置**: 自动创建和管理Docker网络
- **健康检查**: 监控服务健康状态
- **并行部署**: 支持无依赖应用的并行启动

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 生成示例配置
```bash
# 生成Lobe Chat + MinIO示例配置
node src/orchestration/cli.js generate -o my-stack.yaml

# 或直接使用示例文件
cp examples/orchestration-lobe-chat-minio.yaml my-stack.yaml
```

### 3. 验证配置
```bash
node src/orchestration/cli.js validate my-stack.yaml
```

### 4. 执行部署
```bash
# 基本部署
node src/orchestration/cli.js deploy my-stack.yaml

# 启用并行部署
node src/orchestration/cli.js deploy my-stack.yaml --parallel

# 模拟运行（不实际部署）
node src/orchestration/cli.js deploy my-stack.yaml --dry-run
```

### 5. 查看状态和日志
```bash
# 查看部署状态
node src/orchestration/cli.js status

# 查看具体部署状态
node src/orchestration/cli.js status <deployment-id>

# 查看部署日志
node src/orchestration/cli.js logs <deployment-id>

# 查看特定应用日志
node src/orchestration/cli.js logs <deployment-id> <app-name>
```

### 6. 停止部署
```bash
node src/orchestration/cli.js stop <deployment-id>
```

## 配置示例

### Lobe Chat + MinIO (AI聊天+对象存储)
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

startup_order:
  - "minio"
  - "lobe-chat"
```

### Node.js + Redis + PostgreSQL (完整Web栈)
```yaml
version: "1.0"
name: "node-redis-pg-stack"
description: "Node.js应用 + Redis缓存 + PostgreSQL数据库"

applications:
  - name: "node-app"
    type: "node"
    source: "https://github.com/your-username/node-app"
    version: "main"
    dependencies:
      - "postgres"
      - "redis"
    environment:
      - "DATABASE_URL=postgresql://admin:secret@postgres:5432/myapp"
      - "REDIS_URL=redis://redis:6379"
    ports:
      - "3000:3000"

dependencies:
  - name: "postgres"
    type: "database"
    image: "postgres:15-alpine"
    environment:
      - "POSTGRES_DB=myapp"
      - "POSTGRES_USER=admin"
      - "POSTGRES_PASSWORD=secret"
    ports:
      - "5432:5432"
    volumes:
      - "./postgres-data:/var/lib/postgresql/data"

  - name: "redis"
    type: "cache"
    image: "redis:7-alpine"
    ports:
      - "6379:6379"
    volumes:
      - "./redis-data:/data"

startup_order:
  - "postgres"
  - "redis"
  - "node-app"
```

## DSL配置规范

### 基本结构
```yaml
version: "1.0"          # 必填，版本号
name: "stack-name"      # 必填，编排名称
description: "描述"      # 可选，描述信息

applications: []        # 必填，应用列表
dependencies: []        # 可选，外部依赖
networks: []           # 可选，网络配置
startup_order: []      # 可选，启动顺序
```

### 应用配置
```yaml
- name: "app-name"            # 必填，应用名称
  type: "docker|node|python" # 必填，应用类型
  source: "镜像或仓库URL"     # 必填，源地址
  version: "版本"            # 可选，版本号
  dependencies: []           # 可选，依赖列表
  environment: []           # 可选，环境变量
  ports: []                 # 可选，端口映射
  volumes: []               # 可选，卷映射
  command: "启动命令"        # 可选，自定义命令
  health_check:             # 可选，健康检查
    endpoint: "/health"     # HTTP端点
    interval: 30           # 检查间隔(秒)
    timeout: 10            # 超时时间(秒)
    retries: 3             # 重试次数
```

### 应用类型支持
- **docker**: 单个Docker容器
- **docker-compose**: Docker Compose项目
- **node**: Node.js应用
- **python**: Python应用
- **go**: Go应用
- **java**: Java应用
- **custom**: 自定义应用

## 集成到现有CLI

### 通过gada命令使用
```bash
# 直接使用gada命令（需要将编排CLI集成到主CLI）
gada orchestrate deploy my-stack.yaml
gada orchestrate status
gada orchestrate logs <deployment-id>
```

### 手动集成
将以下代码添加到 `src/cli/index.js`:

```javascript
// 添加编排命令
program
  .command('orchestrate')
  .description('项目编排功能')
  .argument('<subcommand>', '子命令: deploy|status|logs|stop|validate|generate|analyze')
  .argument('[args...]', '参数')
  .action((subcommand, args) => {
    // 调用编排CLI
    require('../orchestration/cli').program.parse(['node', 'script', subcommand, ...args]);
  });
```

## 高级功能

### 并行部署
```bash
# 启用并行部署（无依赖关系的应用会并行启动）
node src/orchestration/cli.js deploy config.yaml --parallel
```

### 依赖关系分析
```bash
# 分析配置文件的依赖关系
node src/orchestration/cli.js analyze config.yaml

# 生成可视化图表
node src/orchestration/cli.js analyze config.yaml --visualize
```

### 导出Docker Compose
```bash
# 将编排配置导出为Docker Compose文件
node -e "
const { OrchestrationService } = require('./src/orchestration');
const service = new OrchestrationService();
service.parseConfig('config.yaml').then(result => {
  if (result.success) {
    const exportResult = service.exportDeployment('temp', 'docker-compose');
    console.log(exportResult.content);
  }
});
"
```

## 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口使用情况
   node src/orchestration/cli.js validate config.yaml
   ```

2. **循环依赖**
   ```bash
   # 检测循环依赖
   node src/orchestration/cli.js analyze config.yaml
   ```

3. **Docker权限问题**
   ```bash
   # 确保有Docker权限
   docker ps
   ```

4. **网络创建失败**
   ```bash
   # 清理旧网络
   docker network prune -f
   ```

### 调试模式
```bash
# 启用详细日志
export LOG_LEVEL=debug
node src/orchestration/cli.js deploy config.yaml
```

## API使用

### 编程方式使用
```javascript
const { OrchestrationService } = require('./src/orchestration');

const service = new OrchestrationService();

// 解析配置
const parseResult = await service.parseConfig('config.yaml');

// 执行部署
const deployResult = await service.deploy('config.yaml');

// 获取状态
const status = service.getDeploymentStatus(deployResult.deploymentId);

// 获取日志
const logs = await service.getDeploymentLogs(deployResult.deploymentId);
```

## 性能优化

### 并行启动
编排器会自动检测无依赖关系的应用，并尝试并行启动它们。

### 健康检查优化
- 适当调整健康检查间隔和超时时间
- 对于启动较慢的服务，增加重试次数

### 资源管理
- 使用Docker资源限制控制容器资源使用
- 监控部署过程中的资源消耗

## 安全建议

1. **环境变量安全**: 不要在配置文件中存储敏感信息
2. **镜像验证**: 只使用可信的Docker镜像
3. **网络隔离**: 为不同应用栈使用不同的Docker网络
4. **权限控制**: 以非root用户运行容器

## 后续计划

1. **Kubernetes支持**: 添加K8s编排支持
2. **监控集成**: 集成Prometheus/Grafana监控
3. **自动扩缩容**: 基于负载自动调整实例数
4. **蓝绿部署**: 支持无中断部署
5. **配置模板市场**: 共享和发现编排模板

## 获取帮助

```bash
# 查看帮助信息
node src/orchestration/cli.js help

# 查看具体命令帮助
node src/orchestration/cli.js deploy --help
```

## 贡献指南

欢迎提交Issue和Pull Request来改进项目编排功能！

1. 遵循现有代码风格
2. 添加相应的测试用例
3. 更新相关文档
4. 确保向后兼容性