# GitHub Deploy Assistant Go 后端架构设计 (v3.0)

## 目标
- 完全替代 Node.js 后端，消除 Node.js 依赖
- 打包成单文件二进制，用户下载即可运行
- 保持与现有前端 API 兼容
- 支持所有现有功能

## 项目结构
```
backend/
├── main.go                    # 主入口文件
├── go.mod                     # Go 模块定义
├── go.sum                     # 依赖锁定文件
├── database.go               # 数据库初始化和管理
├── config/                   # 配置管理
│   ├── config.go
│   └── env.go
├── handlers/                 # 请求处理器
│   ├── github.go            # GitHub 相关功能
│   ├── project.go           # 项目管理
│   ├── community.go         # 社区功能
│   ├── health.go           # 健康检查
│   ├── deploy.go           # 部署功能 (新增)
│   ├── ai.go               # AI 诊断功能 (新增)
│   └── browser.go          # 浏览器扩展支持 (新增)
├── models/                  # 数据模型
│   ├── project.go
│   ├── community.go
│   ├── deploy.go          # 部署模型 (新增)
│   └── user.go           # 用户模型 (新增)
├── routes/                 # 路由定义
│   ├── routes.go
│   ├── community.go
│   ├── deploy.go         # 部署路由 (新增)
│   └── api.go           # API 路由分组 (新增)
├── services/              # 业务服务层
│   ├── github_service.go
│   ├── deploy_service.go
│   ├── ai_service.go
│   └── template_service.go
├── utils/                # 工具函数
│   ├── file_utils.go
│   ├── http_utils.go
│   ├── validation.go
│   └── logger.go
├── middleware/          # 中间件
│   ├── cors.go
│   ├── auth.go
│   ├── logging.go
│   └── recovery.go
├── static/             # 静态文件服务 (可选)
└── build/              # 构建脚本和输出
    ├── build.sh
    ├── build.bat
    └── Makefile
```

## API 接口设计

### 1. 健康检查
- `GET /api/health` - 服务状态检查
- `GET /api/version` - 版本信息

### 2. 项目管理
- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建新项目
- `GET /api/projects/{id}` - 获取项目详情
- `PUT /api/projects/{id}` - 更新项目
- `DELETE /api/projects/{id}` - 删除项目

### 3. 部署功能
- `POST /api/deploy/analyze` - 分析仓库
- `POST /api/deploy/execute` - 执行部署
- `GET /api/deploy/status/{id}` - 获取部署状态
- `POST /api/deploy/cancel/{id}` - 取消部署
- `GET /api/deploy/logs/{id}` - 获取部署日志

### 4. AI 诊断功能
- `POST /api/ai/diagnose` - AI 诊断部署问题
- `GET /api/ai/suggestions` - 获取改进建议
- `POST /api/ai/fix` - 应用AI建议的修复

### 5. 社区功能
- `GET /api/community/templates` - 获取部署模板
- `POST /api/community/templates` - 提交新模板
- `GET /api/community/issues` - 获取社区问题
- `POST /api/community/issues` - 提交问题

### 6. 浏览器扩展支持
- `GET /api/browser/config` - 获取浏览器配置
- `POST /api/browser/action` - 执行浏览器动作
- `WS /ws/browser` - WebSocket 连接

## 数据库设计

使用 SQLite 作为本地存储：
- `projects` 表 - 项目信息
- `deployments` 表 - 部署记录
- `templates` 表 - 部署模板
- `issues` 表 - 问题跟踪
- `users` 表 - 用户信息 (可选)

## 配置管理

支持环境变量和配置文件：
```bash
# 环境变量
PORT=3000
GITHUB_TOKEN=xxx
GITHUB_REPO=owner/repo
DATABASE_PATH=./data/gda.db
LOG_LEVEL=info
```

## 构建和打包

### 单文件二进制构建
```bash
# Linux
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o gda-server

# Windows
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o gda-server.exe

# macOS
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o gda-server-macos
```

### 静态链接 (可选)
```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -ldflags="-s -w -extldflags '-static'" -o gda-server-static
```

## 依赖管理

### 核心依赖
- `github.com/gorilla/mux` - HTTP 路由
- `github.com/rs/cors` - CORS 支持
- `github.com/mattn/go-sqlite3` - SQLite 数据库
- `github.com/google/uuid` - UUID 生成
- `github.com/sirupsen/logrus` - 日志记录 (可选)

### 可选依赖
- `github.com/gorilla/websocket` - WebSocket 支持
- `github.com/go-playground/validator` - 数据验证
- `github.com/joho/godotenv` - 环境变量加载

## 部署方式

1. **直接运行**：下载二进制文件，直接执行
2. **系统服务**：配置为 systemd/launchd/Windows 服务
3. **Docker**：提供 Docker 镜像
4. **包管理器**：提供 deb/rpm 包

## 兼容性说明

### 与 Node.js 后端的差异
1. **性能**：Go 后端性能更高，内存占用更低
2. **启动时间**：Go 二进制启动更快
3. **依赖管理**：无需 Node.js 环境，单文件即可运行
4. **并发处理**：Go 的 goroutine 提供更好的并发支持

### API 兼容性
- 保持所有现有 API 端点不变
- 保持相同的请求/响应格式
- 确保 WebSocket 连接兼容
- 保持相同的错误码格式

## 测试策略

1. **单元测试**：测试各个组件功能
2. **集成测试**：测试 API 端点
3. **性能测试**：对比 Node.js 版本性能
4. **兼容性测试**：确保前端正常使用

## 迁移指南

从 Node.js 迁移到 Go 后端：
1. 停止 Node.js 服务
2. 下载 Go 二进制文件
3. 复制配置文件
4. 启动 Go 服务
5. 验证功能正常