# 贡献指南

感谢你有兴趣为 GADA 做出贡献！

## 开发环境

```bash
git clone https://github.com/4129163/github-deploy-assistant.git
cd github-deploy-assistant
npm install
cp .env.example .env
npm run dev   # 开发模式，自动重载
```

访问 http://localhost:3456 查看效果。

## 项目结构

```
github-deploy-assistant/
├── src/
│   ├── server/
│   │   └── index.js          # Express 服务入口，注册所有路由
│   ├── routes/               # API 路由（每个文件一组功能）
│   │   ├── deploy.js         # 部署向导（分析/克隆/自动部署）
│   │   ├── project.js        # 项目管理（CRUD/启停/更新）
│   │   ├── ai.js             # AI 对话与提供商管理
│   │   ├── share.js          # 分享记录（生成/查看链接）
│   │   ├── remote.js         # 远程主机部署（SSH）
│   │   ├── webhook-enhanced.js # Webhook 自动触发
│   │   ├── private.js        # 私有仓库 Token 管理
│   │   ├── monitor.js        # 资源监控（CPU/内存/磁盘）
│   │   ├── logs.js           # 日志浏览
│   │   ├── system.js         # 系统状态 & 自检
│   │   ├── scan.js           # 本地磁盘扫描
│   │   ├── search.js         # GitHub 项目搜索
│   │   ├── docker.js         # Docker 容器管理
│   │   ├── env.js            # 环境检测
│   │   ├── envguide.js       # 环境安装指南
│   │   ├── templates.js      # 部署模板
│   │   ├── settings.js       # 配置读写（.env）
│   │   ├── config.js         # 项目配置
│   │   ├── config-io.js      # 配置导入/导出
│   │   ├── software.js       # 本地软件检测
│   │   ├── device.js         # 设备信息
│   │   ├── diagnose.js       # AI 故障诊断
│   │   ├── network-opt.js    # 网络优化
│   │   ├── process.js        # 进程管理
│   │   ├── repo.js           # 仓库信息
│   │   └── webhook.js        # 基础 Webhook
│   ├── services/             # 业务逻辑
│   │   ├── deploy.js         # 部署核心逻辑（命令执行/进程管理）
│   │   ├── ai.js             # AI 多提供商适配
│   │   ├── github.js         # GitHub API 封装
│   │   ├── share.js          # 分享链接生成/验证
│   │   ├── remote-deploy.js  # SSH 远程部署（node-ssh）
│   │   ├── private-repo.js   # 私有仓库 Token 加密存储
│   │   ├── database.js       # SQLite 数据库（项目/日志/分享等）
│   │   ├── process-manager.js# 进程生命周期管理
│   │   ├── health-checker.js # 项目健康检查
│   │   ├── self-check.js     # GADA 自身全身自检
│   │   ├── risk-scanner.js   # 代码风险扫描
│   │   ├── search.js         # GitHub 项目搜索
│   │   ├── docker-service.js # Docker 操作
│   │   ├── env-detector.js   # 环境检测
│   │   ├── network-checker.js# 网络连通性检测
│   │   ├── network-optimizer.js # 网络优化（镜像源切换）
│   │   ├── software-scanner.js  # 本地软件扫描
│   │   ├── device-scan.js    # 设备硬件信息
│   │   ├── config-io.js      # 配置导入/导出逻辑
│   │   └── audit-log.js      # 操作审计日志
│   ├── utils/
│   │   ├── logger.js         # 日志工具（winston）
│   │   └── port.js           # 端口扫描工具
│   ├── cli/
│   │   └── index.js          # CLI 入口（inquirer 交互）
│   ├── data/
│   │   ├── deploy-templates.js # 内置部署模板
│   │   └── env-tools.js      # 环境工具定义
│   └── config.js             # 全局配置（端口/目录/超时等）
├── public/
│   ├── index.html            # 单页应用 HTML
│   ├── css/
│   │   └── style.css         # 全部样式（CSS 变量 + 暗色模式）
│   └── js/
│       ├── app.js            # 主前端逻辑（部署/管理/AI 对话等）
│       └── features.js       # 新功能前端逻辑（分享/远程/Webhook/私有仓库）
├── .env.example              # 环境变量模板
├── package.json
├── install.sh                # 一键安装脚本（Linux/macOS）
├── CHANGELOG.md
├── CONTRIBUTING.md
└── README.md
```

## 提交规范

```
feat:     添加新功能
fix:      修复 Bug
docs:     文档更新
style:    样式调整（不影响逻辑）
refactor: 代码重构
perf:     性能优化
test:     测试相关
chore:    构建/依赖/工具变更
ui:       界面视觉调整
```

示例：
```
feat: add one-click rollback to project card
fix: safeParseLogOutput handles non-array JSON
docs: update README with v1.1.0 features
```

## 提 PR 前

1. `node src/server/index.js` 确认服务能正常启动，无报错
2. `node --check` 检查所有修改的 JS 文件语法
3. 前端操作流程走一遍（新功能 + 回归已有功能）
4. 更新 `CHANGELOG.md`

## 新增 API 路由

1. 在 `src/routes/` 下创建新文件
2. 在 `src/server/index.js` 中 `app.use('/api/xxx', require('./routes/xxx'))`
3. 如需数据库表，在 `src/services/database.js` 的 `initDB()` 中添加 `CREATE TABLE IF NOT EXISTS`

## 新增前端功能

- **新 Tab 页面**：在 `public/index.html` 添加 `<div id="xxx" class="tab hidden">` 结构，在侧边栏添加 `<button class="nav-item" data-tab="xxx">` 导航
- **已有 Tab 扩展**：在 `public/js/app.js` 或 `public/js/features.js` 中添加函数
- **样式**：在 `public/css/style.css` 末尾追加，优先使用 CSS 变量（`var(--primary)` 等）

## 常见贡献方向

- 支持更多项目类型的自动识别（`src/services/deploy.js`）
- Windows 一键安装脚本（`install.ps1`）
- 改进 AI 提示词（`src/services/ai.js` 中的 `buildPrompt`）
- 远程部署支持 Docker 自动安装
- Webhook 支持更多代码托管平台（Gitee / Bitbucket）
- 私有仓库支持 SSH Key 认证
- 性能优化、错误处理改进
- 完善英文文档
