<div align="center">

<img src="https://img.shields.io/badge/GADA-v1.1.0-4f6ef7?style=for-the-badge&logo=rocket&logoColor=white" alt="version">

# 🚀 GitHub Deploy Assistant

**把任意 GitHub 项目装到你电脑上 —— 零基础，一键搞定**

[快速开始](#-快速开始) · [全部功能](#-全部功能) · [AI 配置](#-配置-ai) · [常见问题](#-常见问题) · [English](#english)

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen?style=flat-square&logo=node.js)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey?style=flat-square)

</div>

---

## 是什么？

GADA 是一个运行在你本地的 Web 应用。你只需粘贴一个 GitHub 仓库链接，它就能：

1. **自动分析**项目类型（Node.js / Python / Docker / Go / Rust …）
2. **AI 智能生成**针对该项目的专属部署方案
3. **一键安装** —— 克隆、装依赖、配置、启动，全自动
4. 看不懂？还有**傻瓜式手动教程**，每一步都说清楚
5. 部署后**统一管理**所有项目，一键启动 / 停止 / 更新 / 回滚
6. **私有仓库**？用 Token 一键克隆，无需改任何命令
7. **远程部署**？SSH 直连树莓派、云服务器，一键推送
8. **代码一推就自动更新**？Webhook 流水线帮你搞定
9. **想分享给朋友复现**？一键生成分享链接

> 适合人群：想跑开源 AI 项目但不懂命令行的普通用户、嫌每次部署麻烦的开发者、需要管理多台机器的运维同学

---

## 📸 界面预览

### 主界面 —— 粘贴链接，开始部署

```
┌─────────────────────────────────────────────────────────────┐
│  🚀 GADA    GitHub 部署助手                     🌙  环境就绪  │
├─────────────┬───────────────────────────────────────────────┤
│  🏠 部署向导  │                                               │
│  📂 项目管理  │   把 GitHub 项目装到你的电脑                     │
│  🔍 本地扫描  │                                               │
│  🔎 项目搜索  │  ┌──────────────────────────────────────┐     │
│  🖥️ 设备信息  │  │ 🔗 https://github.com/xxx/yyy      │ 分析 │
│  📦 软件检测  │  └──────────────────────────────────────┘     │
│  📋 环境指南  │                                               │
│  ✅ 环境检测  │  常用推荐：lobe-chat  stable-diffusion  ...   │
│  🗂️ 部署模板  │                                               │
│  🖥️ 系统状态  │                                               │
│  📄 日志浏览  │                                               │
│  📊 资源监控  │                                               │
│  🤖 AI 设置  │                                               │
│  🔗 分享记录  │                                               │
│  🌍 远程部署  │                                               │
│  ⚡ 自动触发  │                                               │
│  🔒 私有仓库  │                                               │
└─────────────┴───────────────────────────────────────────────┘
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

> ⚠️ 运行前需要先安装两个工具，**缺一不可**：
>
> | 工具 | 用途 | 下载地址 |
> |------|------|----------|
> | **Node.js 18+** | 运行 GADA 本体 | [nodejs.org](https://nodejs.org) |
> | **Git** | 克隆仓库 | [git-scm.com](https://git-scm.com) |

**Windows 安装步骤（傻瓜版）：**

1. 打开 [nodejs.org](https://nodejs.org)，下载 LTS 版本，一路 Next 安装
2. 打开 [git-scm.com](https://git-scm.com)，下载安装，一路 Next
3. 按 `Win+R`，输入 `cmd`，回车，打开命令提示符
4. 依次运行：

```cmd
git clone https://github.com/4129163/github-deploy-assistant.git
cd github-deploy-assistant
npm install
npm start
```

看到 `Server: http://localhost:3456` 后，打开浏览器访问 **http://localhost:3456**

> 💡 **以后每次使用**：打开命令提示符 → `cd` 到安装目录 → `npm start` → 浏览器打开地址，前三步只需做一次。

> ❌ **常见错误：**
> - `'git' 不是内部或外部命令` → 重新安装 Git 后重启命令行
> - `'npm' 不是内部或外部命令` → 重新安装 Node.js 后重启命令行
> - `npm install` 卡住 → 运行 `npm config set registry https://registry.npmmirror.com` 后重试

---

## 🎯 全部功能

### 🏠 部署向导

粘贴任意 GitHub 仓库链接（或用自然语言描述），GADA 自动：

- 识别项目类型（Node.js / Python / Docker / Go / Rust / Java / PHP …）
- 检查本地环境是否满足要求
- AI 分析项目结构和配置
- 生成专属部署方案（自动 or 手动教程二选一）
- 实时进度日志，全程可见

### 📂 项目管理

所有已安装的项目统一管理，每个项目卡片提供：

| 按钮 | 功能 |
|------|------|
| ▶ 启动 | 启动项目进程 |
| ⏹ 停止 | 停止项目进程 |
| 🔔 检测更新 | 检查是否有新版本（git pull）|
| 💬 问AI | 遇到问题直接问 AI |
| 🔔 Webhook | 配置代码推送自动部署 |
| 💾 备份/回滚 | 查看历史备份，一键回滚 |
| 📋 部署日志 | 查看历次部署记录 |
| 🔗 分享 | 生成分享链接 |
| 🌍 远程部署 | 一键推送到远程主机 |
| 🌐 打开 | 直接在浏览器打开项目 |
| 🗑 卸载 | 卸载项目（可选保留备份）|

### 🔍 本地扫描

扫描本地磁盘，自动发现已存在的 GitHub 项目，一键导入到 GADA 管理。

### 🔎 项目搜索

在 GitHub 上搜索热门项目，按分类浏览，直接点击部署。

### 🖥️ 设备信息

查看本机硬件信息（CPU、内存、磁盘、GPU）、网络状态、系统版本。

### 📦 软件检测

自动检测已安装的开发工具（Node.js / Python / Docker / Git / Java …）版本，缺失时提供安装链接。

### 📋 环境指南

各类开发环境（Node.js / Python / Docker / Go / Rust / Java）的安装教程，图文并茂，步步引导。

### ✅ 环境检测

一键检测当前系统环境是否满足常见项目的运行要求，列出缺失项和解决方案。

### 🗂️ 部署模板

内置常用部署脚本模板（Node.js / Python / Docker / Nginx 反代 / PM2 守护 …），可直接套用。

### 🖥️ 系统状态

- CPU、内存、磁盘实时使用率
- 运行中的项目进程列表
- 全身自检（一键诊断 GADA 自身健康状态）
- 网络连通性检测
- 配置导出 / 导入（换机迁移）

### 📄 日志浏览

浏览 GADA 系统日志文件，支持实时刷新、关键词过滤（error / warn / info）。

### 📊 资源监控

CPU、内存、磁盘使用率实时折线图，历史记录可追溯。

### 🤖 AI 设置

支持多家 AI 提供商，无 AI 也可基础使用：

| 提供商 | 说明 |
|--------|------|
| OpenAI | GPT-4o / GPT-4o-mini 等 |
| DeepSeek | 国内可用，价格极低 |
| Google Gemini | 免费额度较大 |
| Anthropic Claude | Claude 3.x 系列 |
| 自定义 | 任何 OpenAI 兼容接口（中转站）|

配置方式：直接粘贴 API Key（自动识别格式），或粘贴 JSON 配置，支持一键粘贴多种格式。

### 🔗 分享记录

为部署成功的项目生成加密分享链接，支持：

- 设置有效期（24h / 3天 / 7天 / 30天 / 永久）
- 包含项目配置 + 复现步骤
- 朋友打开链接即可查看，无需安装 GADA
- 管理已创建的分享，随时撤销

### 🌍 远程部署

通过 SSH 将项目一键推送到任意远程主机：

- 支持密码 / SSH 私钥两种认证方式
- 自动识别远程环境，安装依赖后启动
- 支持树莓派、云服务器（腾讯云/阿里云/VPS）、NAS 等任何 Linux 机器
- 支持测试连接，确认 SSH 可用后再部署

**快速上手：**
1. 侧边栏 → 🌍 远程部署 → 「添加主机」
2. 填写 IP、端口（默认22）、用户名、密码 或 私钥路径
3. 点「测试连接」，成功后选择项目点「开始远程部署」

### ⚡ 自动触发（Webhook）

代码一推，服务器自动更新 —— 实现 CI/CD 流水线：

- 支持 GitHub Webhook 和 GitLab Webhook
- HMAC-SHA256 签名验证，防伪造请求
- 按分支过滤（只有 push 到 `main` 才触发）
- 按事件过滤（push / release / pull_request）
- 自动执行：git pull → 安装依赖 → 重启服务

**快速上手：**
1. 项目卡片 → 🔔 Webhook → 复制 Webhook URL 和密钥
2. GitHub 仓库 → Settings → Webhooks → Add webhook
3. 填入 URL 和密钥，选择 `push` 事件，保存
4. 之后每次 `git push`，GADA 自动拉取并重启

### 🔒 私有仓库

克隆需要权限的私有 GitHub / GitLab 仓库：

- Personal Access Token 加密存储（AES-256-GCM）
- 支持 GitHub / GitLab / Gitee
- Token 一次配置，多个私有项目复用
- 配合部署向导，私有项目与公开项目操作完全一致

**快速上手：**
1. 侧边栏 → 🔒 私有仓库 → 「添加 Token」
2. 在 GitHub → Settings → Developer settings → Personal access tokens 生成 Token（勾选 `repo` 权限）
3. 填写名称和 Token，保存
4. 返回部署向导，粘贴私有仓库链接，正常部署即可

---

## 🔧 配置 AI

AI 功能用于分析项目、生成部署方案、故障诊断。**不配置也可以使用基础部署功能**。

### 推荐方案（国内用户）

**DeepSeek**（价格极低，稳定好用）：

1. 打开 [platform.deepseek.com](https://platform.deepseek.com) 注册
2. 创建 API Key
3. GADA → 🤖 AI 设置 → 选择 DeepSeek → 粘贴 Key → 保存

### 支持的提供商

| 提供商 | 免费额度 | 推荐模型 | 获取地址 |
|--------|----------|----------|----------|
| OpenAI | 无 | gpt-4o-mini | [platform.openai.com](https://platform.openai.com) |
| DeepSeek | 有 | deepseek-chat | [platform.deepseek.com](https://platform.deepseek.com) |
| Gemini | 有（免费版） | gemini-1.5-flash | [aistudio.google.com](https://aistudio.google.com) |
| Claude | 无 | claude-3-haiku | [console.anthropic.com](https://console.anthropic.com) |
| 自定义 | 取决于平台 | 任意 | — |

### 中转站 / 自定义接口

1. GADA → 🤖 AI 设置 → 「添加自定义」
2. 填写：接口地址 / API Key / 模型名称
3. 点「测试连接」验证

---

## 🌐 环境变量配置

复制 `.env.example` 为 `.env`，按需修改：

```bash
cp .env.example .env
```

常用配置项：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3456` | Web 服务端口 |
| `WORK_DIR` | `./workspace` | 项目克隆目录 |
| `ALLOW_AUTO_EXEC` | `true` | 是否允许自动执行命令 |
| `LOG_LEVEL` | `info` | 日志级别（error/warn/info/debug）|
| `CLONE_TIMEOUT_MS` | `120000` | 克隆超时（毫秒）|
| `GADA_SECRET_KEY` | _(需修改)_ | 私有仓库 Token 加密密钥，**强烈建议改为随机字符串** |
| `DEFAULT_AI_PROVIDER` | `openai` | 默认 AI 提供商 |

生成安全密钥：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ❓ 常见问题

### 启动后浏览器打不开

检查端口是否被占用：
```bash
lsof -i :3456          # macOS / Linux
netstat -ano | findstr 3456  # Windows
```
修改端口：在 `.env` 里改 `PORT=你想要的端口号`，重启 GADA。

### npm install 很慢

切换国内镜像：
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### 项目启动失败

1. 点项目卡片上的「💬 问AI」，描述问题，AI 自动诊断
2. 查看 `logs/` 目录下的错误日志
3. 侧边栏 → 系统状态 → 「一键自检」查看诊断报告

### 克隆很慢 / 失败

网络问题，可尝试：
```bash
git config --global url."https://ghproxy.com/https://github.com/".insteadOf "https://github.com/"
```

### 私有仓库提示没有权限

1. 确认 Token 有 `repo` 权限（GitHub 设置页面可查看）
2. Token 是否已过期（GitHub 限制有效期）
3. 侧边栏 → 🔒 私有仓库 → 「验证」按钮重新验证

### Webhook 收不到请求

1. 确认 GADA 服务器有公网 IP（本地开发机无法直接接收 GitHub Webhook）
2. 检查防火墙是否开放 GADA 端口（默认 3456）
3. GitHub Webhook 设置页面查看「Recent Deliveries」里的错误信息

### 忘记 AI Key 了 / 想换提供商

侧边栏 → 🤖 AI 设置，直接修改。Key 保存在 `.env` 文件里，不会明文显示在页面上。

---

## 🛠️ 系统要求

| 环境 | 最低版本 | 备注 |
|------|----------|------|
| Node.js | 18.0.0 | [下载](https://nodejs.org) |
| npm | 8.0.0 | 随 Node.js 附带 |
| Git | 2.x | [下载](https://git-scm.com)，可选但推荐 |
| 内存 | 512 MB | — |
| 磁盘空间 | 200 MB | 不含项目本身 |

---

## 🤝 参与贡献

欢迎提 Issue 和 PR！

```bash
# Fork 后克隆你的 fork
git clone https://github.com/你的用户名/github-deploy-assistant.git
cd github-deploy-assistant
npm install
cp .env.example .env

# 开发模式（自动重载）
npm run dev

# 提交前确认服务能正常启动
node src/server/index.js
```

常见贡献方向：
- 支持更多项目类型的自动识别
- Windows 一键安装脚本（`.ps1`）
- 改进 AI 分析提示词（`src/services/ai.js`）
- 性能优化、错误处理改进
- 翻译文档（英文完善）

---

## 📄 许可证

[MIT License](LICENSE) © 2025 GitHub Deploy Assistant

---

## English

### What is GADA?

GADA (GitHub Deploy Assistant) is a local web app that helps non-technical users install and run any GitHub project without touching the command line.

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
- 🤖 AI-powered deployment plan (OpenAI / DeepSeek / Gemini / Claude / Custom)
- ⚡ One-click auto install (clone + deps + config + start)
- 📖 Step-by-step manual guide for non-technical users
- 📂 Unified project management (start / stop / update / rollback / logs)
- 💾 Auto backup before every deploy + one-click rollback
- 🔒 Private repo support (encrypted PAT storage)
- 🌍 Remote SSH deploy to Raspberry Pi, VPS, cloud servers
- ⚡ Webhook auto-deploy on git push (GitHub / GitLab)
- 🔗 Share deployment records via encrypted links
- 🔍 Scan local disk for existing projects
- 💬 Ask AI when something goes wrong
- 📊 Real-time resource monitoring (CPU / memory / disk)
- 🌙 Dark mode

### Requirements

- Node.js >= 18.0.0
- Git (optional but recommended)

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star，谢谢！**

*If this project helps you, please give it a ⭐ Star!*

</div>
