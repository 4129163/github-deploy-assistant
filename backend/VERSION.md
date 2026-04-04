# GitHub Deploy Assistant Go 后端版本信息

## v3.0.0 - 远景版本

### 主要变更
- **核心架构**: 从 Node.js 迁移到 Go 语言
- **部署方式**: 从需要 Node.js 运行时改为单文件二进制
- **依赖关系**: 完全移除 Node.js 依赖

### 新特性
1. **单文件部署**: 用户只需下载一个二进制文件即可运行
2. **跨平台支持**: 支持 Linux、Windows、macOS 三大平台
3. **零依赖**: 无需安装任何运行时环境
4. **快速启动**: Go 编译的二进制文件启动速度更快
5. **资源占用**: 内存和 CPU 使用率显著降低

### API 兼容性
保持与原有 Node.js 版本完全兼容的 API：
- `GET /api/health` - 健康检查
- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建项目
- `GET /api/projects/{id}` - 获取单个项目
- `PUT /api/projects/{id}` - 更新项目
- `DELETE /api/projects/{id}` - 删除项目
- `GET /api/activities` - 获取活动列表

### 构建信息
- **编译时间**: 2026-04-05
- **Go 版本**: 1.21+
- **构建方式**: 静态链接，无外部依赖
- **文件大小**: ~7MB (各平台略有差异)

### 使用说明

#### Linux/macOS
```bash
# 下载并运行
chmod +x github-deploy-assistant-linux-amd64
./github-deploy-assistant-linux-amd64

# 指定端口
PORT=8080 ./github-deploy-assistant-linux-amd64
```

#### Windows
```bash
# 直接运行
github-deploy-assistant-windows-amd64.exe

# 使用 PowerShell
$env:PORT=8080
.\github-deploy-assistant-windows-amd64.exe
```

### 迁移说明
从 Node.js 版本迁移到 Go 版本：

1. **停止旧服务**
   ```bash
   # 停止 Node.js 服务
   pkill -f "node server.js"
   ```

2. **备份数据** (如果使用文件存储)
   ```bash
   cp data.json data.json.backup
   ```

3. **部署新服务**
   ```bash
   # 下载对应的平台版本
   # 运行 Go 版本
   ./github-deploy-assistant-linux-amd64
   ```

4. **验证迁移**
   ```bash
   curl http://localhost:3000/api/health
   ```

### 文件清单
- `simple_main.go` - 主程序源代码
- `go.mod` - Go 模块定义
- `Makefile` - 构建脚本
- `build.sh` - 构建脚本 (bash)
- `test.sh` - 测试脚本
- `VERSION.md` - 版本说明

### 已知问题
- 当前版本为最小功能实现，包含核心 API
- WebSocket 支持需要额外实现
- 文件存储使用内存，重启后数据丢失（生产环境需集成数据库）

### 未来计划
- 集成 SQLite 数据库持久化
- 实现完整的 WebSocket 支持
- 添加配置文件支持
- 实现服务管理（systemd/launchd）
- 添加监控和日志功能

---
**构建时间**: 2026-04-05  
**提交者**: kai0339 (19106440339@163.com)  
**仓库**: https://gitee.com/kai0339/github-deploy-assistant