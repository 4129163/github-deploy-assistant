<div align="center">

<img src="https://img.shields.io/badge/GADA-v1.0.0-4f6ef7?style=for-the-badge&logo=rocket&logoColor=white" alt="version">

# 🚀 GitHub Deploy Assistant

**把任意 GitHub 项目装到你电脑上 —— 零基础，一键搞定**

[快速开始](#-快速开始) · [功能演示](#-功能演示) · [AI 配置](#-配置-ai) · [常见问题](#-常见问题) · [English](#english)

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen?style=flat-square&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey?style=flat-square)

</div>

---

## 是什么？

GADA 是一个运行在你本地的 Web 应用。你只需粘贴一个 GitHub 仓库链接，它就能：

1. **自动分析**项目类型（Node.js / Python / Docker / Go / Rust …）
2. **AI 生成**针对该项目的专属部署方案
3. **一键安装** —— 克隆、装依赖、配置、启动，全自动
4. 看不懂？还有**傻瓜式手动教程**，每一步都说清楚
5. 部署后**统一管理**所有项目，一键启动/停止/更新

> 适合人群：想跑开源 AI 项目但不懂命令行的普通用户、嫌每次部署麻烦的开发者

---

## 📸 功能演示

### 主界面 —— 粘贴链接，开始部署

```
┌─────────────────────────────────────────────────┐
│  🚀 GADA    GitHub 部署助手          🌙  环境就绪  │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│  🏠 部署  │   把 GitHub 项目装到你的电脑           │
│  📂 管理  │                                      │
│  🔍 扫描  │  ┌─────────────────────────────┐     │
│  🖥️ 系统  │  │ 🔗 https://github.com/...  │ 分析 │
│  🤖 AI   │  └─────────────────────────────┘     │
│          │                                      │
│          │  gpt4free  SD WebUI  Lobe Chat  ...  │
└──────────┴──────────────────────────────────────┘
```

### 自动安装 —— 实时进度日志

```
正在自动安装...                              ████████░░  78%

[INFO]  克隆仓库到 workspace/lobe-chat
[INFO]  检测到 Node.js 项目，运行 npm install
[✓]     依赖安装完成 (127 packages)
[INFO]  检测到 .env.example，生成默认配置
[✓]     项目启动成功，端口: 3210
```

---

## ⚡ 快速开始

### 方式一：一键脚本（推荐，Linux / macOS）

```bash
curl -fsSL https://raw.githubusercontent.com/4129163/github-deploy-assistant/main/install.sh | bash
```

安装完成后：

```bash
cd github-deploy-assistant
npm start
# 浏览器打开 http://localhost:3456
```

### 方式二：手动安装（3 步）

```bash
# 1. 克隆
git clone https://github.com/4129163/github-deploy-assistant.git
cd github-deploy-assistant

# 2. 安装依赖
npm install

# 3. 启动
npm start
```

浏览器访问 → **http://localhost:3456**

### Windows 用户

> 需要先安装 [Node.js 18+](https://nodejs.org) 和 [Git](https://git-scm.com)

```powershell
git clone https://github.com/4129163/github-deploy-assistant.git
cd github-deploy-assistant
npm install
npm start
```

---

## 🤖 配置 AI

AI 功能用于智能分析项目、生成部署方案、回答问题。**不配置也能用**，只是没有 AI 分析。

### 方法一：界面配置（推荐）

启动后点击左侧「**🤖 AI 设置**」→ 粘贴你的 API Key，自动识别。

支持直接粘贴任意格式：
- 纯 Key：`sk-xxxxxxxxxxxxxxxx`
- 带地址：`baseURL: https://xxx.com/v1  apiKey: sk-xxx`
- JSON：`{"apiKey": "sk-xxx", "baseURL": "..."}`
- 中转站的完整说明文字

### 方法二：环境变量

```bash
cp .env.example .env
# 编辑 .env 填入 Key
```

| 提供商 | 环境变量 | 获取地址 |
|--------|----------|----------|
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| DeepSeek | `DEEPSEEK_API_KEY` | [platform.deepseek.com](https://platform.deepseek.com) |
| Gemini | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) |
| Claude | `CLAUDE_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| 自定义中转 | 界面添加 | 任意 OpenAI 兼容接口 |

> 💡 **推荐**：DeepSeek 价格极低，适合日常使用

---

## 📖 功能详解

### 🏠 部署向导

| 步骤 | 说明 |
|------|------|
| 粘贴链接 | 支持任意公开 GitHub 仓库 |
| 智能分析 | 识别语言、框架、依赖、端口 |
| AI 分析 | 生成项目说明和部署建议 |
| 自动安装 | 一键完成，实时日志 |
| 手动教程 | 逐步说明，遇到问题问 AI |

### 📂 项目管理

- 查看所有已安装项目，按状态筛选
- 一键**启动 / 停止 / 重启**
- **⬇️ 更新**：git pull 拉取最新代码
- **🔄 重试**：失败项目一键重新部署
- **🌐 打开**：直接跳转项目访问地址
- 添加**备注和标签**，方便管理多个项目

### 🔍 扫描发现

自动扫描本地磁盘，发现已有的 GitHub 项目，批量导入统一管理。

### 🖥️ 系统状态

实时查看运行中的进程、端口占用、健康状态。

---

## ⚙️ 配置说明

`.env` 文件支持以下配置：

```env
# 服务端口（默认 3456）
PORT=3456

# 工作目录（克隆项目存放位置）
WORK_DIR=./workspace

# 是否允许自动执行命令（false = 只生成教程，不自动运行）
ALLOW_AUTO_EXEC=true

# 克隆超时（毫秒，默认 2 分钟）
CLONE_TIMEOUT_MS=120000

# 日志级别
LOG_LEVEL=info

# AI 提供商（openai / deepseek / gemini / claude）
DEFAULT_AI_PROVIDER=openai
```

---

## 🗂️ 项目结构

```
github-deploy-assistant/
├── src/
│   ├── server/           # Express 服务器
│   ├── routes/           # API 路由
│   │   ├── deploy.js     # 部署（含重试、git pull）
│   │   ├── ai.js         # AI 对话、提供商管理
│   │   ├── project.js    # 项目 CRUD
│   │   ├── process.js    # 进程启停
│   │   ├── scan.js       # 本地扫描
│   │   ├── system.js     # 系统状态、健康检查
│   │   └── settings.js   # .env 配置管理
│   ├── services/
│   │   ├── github.js     # GitHub 仓库解析
│   │   ├── ai.js         # AI 多提供商封装
│   │   ├── deploy.js     # 自动部署逻辑
│   │   ├── process-manager.js  # 进程生命周期
│   │   ├── health-checker.js   # 健康检查（30s 轮询）
│   │   └── database.js   # SQLite 数据持久化
│   ├── cli/              # 命令行界面
│   └── utils/
├── public/               # 前端（纯 HTML/CSS/JS）
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── workspace/            # 克隆的项目（gitignored）
├── database/             # SQLite 数据库（gitignored）
├── logs/                 # 日志文件（gitignored）
├── .env.example          # 环境变量示例
└── install.sh            # 一键安装脚本
```

---

## ❓ 常见问题

**Q: 不懂编程可以用吗？**
> 可以。Web 界面按提示操作即可，不需要敲命令。

**Q: 不配置 AI 能用吗？**
> 能用，自动/手动安装功能正常。AI 分析和 AI 问答需要配置 Key。

**Q: 支持哪些项目类型？**
> Node.js、Python、Docker、Go、Rust、Java、静态网站，以及任何有 README 的项目。

**Q: 端口 3456 被占用怎么办？**
> ```bash
> PORT=3457 npm start
> ```

**Q: 克隆失败？**
> 检查网络。国内用户可设置镜像：
> ```bash
> git config --global url."https://ghproxy.com/".insteadOf "https://github.com/"
> ```

**Q: npm install 很慢？**
> ```bash
> npm config set registry https://registry.npmmirror.com
> ```

**Q: AI 分析一直失败？**
> 1. 检查 API Key 是否正确（在 AI 设置页点「🔗 测试」）
> 2. 检查网络能否访问 AI 服务
> 3. 查看 `logs/` 目录下的错误日志

---

## 🛠️ 系统要求

| 环境 | 最低版本 | 备注 |
|------|----------|------|
| Node.js | 18.0.0 | [下载](https://nodejs.org) |
| npm | 8.0.0 | 随 Node.js 附带 |
| Git | 2.x | [下载](https://git-scm.com)，可选但推荐 |
| 内存 | 512 MB | | 磁盘空间 | 200 MB | 不含项目本身 |

---

## 🤝 参与贡献

欢迎提 Issue 和 PR！

```bash
# Fork 后克隆你的 fork
git clone https://github.com/你的用户名/github-deploy-assistant.git
cd github-deploy-assistant
npm install

# 开发模式（自动重载）
npm run dev

# 提交前确保没有报错
node src/server/index.js
```

常见贡献方向：
- 支持更多项目类型的自动识别
- 改进 AI 分析提示词
- 添加 Windows 安装脚本
- 优化前端体验
- 完善文档和测试

---

## 📄 许可证

[MIT License](LICENSE) © 2024 GitHub Deploy Assistant

---

## English

### What is GADA?

GADA (GitHub Deploy Assistant) is a local web app that helps non-technical users install and run any GitHub project without using the command line.

### Quick Start

```bash
git clone https://github.com/4129163/github-deploy-assistant.git
cd github-deploy-assistant
npm install
npm start
# Open http://localhost:3456
```

### Features

- 🔗 Paste any GitHub URL → auto-analyze project structure
- 🤖 AI-powered deployment plan generation (OpenAI / DeepSeek / Gemini / Claude)
- ⚡ One-click auto install (clone + deps + config + start)
- 📖 Step-by-step manual guide for non-technical users
- 📂 Unified project management (start / stop / update / rollback)
- 🔍 Scan local disk for existing GitHub projects
- 💬 Ask AI when something goes wrong

### Requirements

- Node.js >= 18.0.0
- Git (optional but recommended)

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star，谢谢！**

*If this project helps you, please give it a ⭐ Star!*

</div>
