# 🚀 GitHub Deploy Assistant (GADA)

> 智能 GitHub 项目部署助手 - 让部署变得简单

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)

## ✨ 功能特点

- 🔗 **智能解析** - 输入 GitHub 仓库地址，自动分析项目结构和依赖
- 🤖 **AI 助手** - 支持 OpenAI、DeepSeek、Gemini、Claude 多模型
- 📖 **手动模式** - 生成详细的部署教程，小白也能看懂
- 🚀 **自动模式** - 一键自动安装依赖、构建、部署
- 💬 **实时问答** - 遇到问题？直接问 AI 助手
- 📂 **项目管理** - 统一管理所有部署的项目
- 📝 **日志记录** - 完整的部署日志和问题追踪

## 📸 界面预览

```
╔═══════════════════════════════════════════════════════════════╗
║              🚀 GitHub Deploy Assistant                       ║
║                  智能项目部署助手 v1.0.0                       ║
╚═══════════════════════════════════════════════════════════════╝

请选择操作:
❯ 🔗 分析并部署新项目
  📂 查看已管理项目
  ⚙️  配置 AI 模型
  📋 检查系统环境
  ❌ 退出
```

## 🚀 快速开始

### 方式一：一键安装脚本（推荐）

**Linux/macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/4129163/github-deploy-assistant/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/4129163/github-deploy-assistant/main/install.ps1 | iex
```

### 方式二：手动安装

#### 1. 克隆仓库

```bash
git clone https://github.com/4129163/github-deploy-assistant.git
cd github-deploy-assistant
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填写你的 AI API Key
```

#### 4. 启动服务

**Web 界面:**
```bash
npm start
# 访问 http://localhost:3456
```

**命令行:**
```bash
npm run cli
```

## 📖 详细使用指南

### Web 界面使用

1. **打开浏览器**访问 `http://localhost:3456`
2. **输入 GitHub 仓库地址**，例如：`https://github.com/username/repo`
3. 点击 **"开始分析"**
4. 等待分析完成，查看项目信息
5. 选择部署模式：
   - **手动模式** - 查看详细教程，按步骤自行安装
   - **自动模式** - 一键自动部署

### CLI 使用

```bash
# 启动 CLI
npm run cli

# 选择 "分析并部署新项目"
# 输入 GitHub 仓库地址
# 选择部署模式
```

### AI 配置

支持以下 AI 模型：

| 提供商 | 环境变量 | 获取地址 |
|--------|----------|----------|
| OpenAI | `OPENAI_API_KEY` | https://platform.openai.com |
| DeepSeek | `DEEPSEEK_API_KEY` | https://platform.deepseek.com |
| Google Gemini | `GEMINI_API_KEY` | https://makersuite.google.com |
| Claude | `CLAUDE_API_KEY` | https://console.anthropic.com |

在 `.env` 文件中配置：

```env
# OpenAI
OPENAI_API_KEY=sk-your-api-key

# DeepSeek (可选)
DEEPSEEK_API_KEY=sk-your-api-key

# 默认使用的 AI
DEFAULT_AI_PROVIDER=openai
```

## 🛠️ 系统要求

### 必需环境

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git** >= 2.0.0

### 可选环境

- **Python** >= 3.8 (用于部署 Python 项目)
- **Docker** >= 20.0 (用于部署 Docker 项目)

### 检查系统环境

```bash
npm run cli
# 选择 "检查系统环境"
```

## 📁 项目结构

```
github-deploy-assistant/
├── src/
│   ├── server/           # 后端服务
│   │   ├── index.js      # 主入口
│   │   └── routes/       # API 路由
│   ├── cli/              # CLI 工具
│   │   └── index.js      # CLI 入口
│   ├── services/         # 业务逻辑
│   │   ├── github.js     # GitHub 解析
│   │   ├── ai.js         # AI 服务
│   │   ├── deploy.js     # 部署执行
│   │   └── database.js   # 数据库
│   └── utils/            # 工具函数
│       └── logger.js     # 日志
├── public/               # 前端界面
│   ├── index.html
│   ├── css/
│   └── js/
├── workspace/            # 项目克隆目录
├── logs/                 # 日志文件
├── database/             # SQLite 数据库
├── .env.example          # 环境变量示例
└── package.json
```

## 🔧 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 3456 |
| `WORK_DIR` | 工作目录 | ./workspace |
| `ALLOW_AUTO_EXEC` | 允许自动执行 | true |
| `LOG_LEVEL` | 日志级别 | info |
| `DEFAULT_AI_PROVIDER` | 默认 AI 提供商 | openai |

### 支持的項目類型

- ✅ Node.js (npm/yarn/pnpm)
- ✅ Python (pip/poetry)
- ✅ Docker
- ✅ Go
- ✅ Rust
- ✅ Java
- ✅ 静态网站

## 🐛 故障排查

### 1. 端口被占用

```bash
# 修改端口
PORT=3457 npm start
```

### 2. AI 分析失败

- 检查 API Key 是否正确
- 检查网络连接
- 查看日志文件 `logs/`

### 3. 克隆失败

- 检查 Git 是否安装
- 检查网络连接
- 确认仓库地址正确

### 4. 依赖安装失败

- 检查 Node.js 版本 >= 18
- 清除 npm 缓存: `npm cache clean --force`
- 使用淘宝镜像: `npm config set registry https://registry.npmmirror.com`

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/xxx`
3. 提交更改: `git commit -am 'Add xxx'`
4. 推送分支: `git push origin feature/xxx`
5. 创建 Pull Request

## 📄 许可证

[MIT](LICENSE)

## 🙏 致谢

- [OpenAI](https://openai.com) - AI 模型支持
- [DeepSeek](https://deepseek.com) - AI 模型支持
- [GitHub](https://github.com) - 代码托管平台

---

**Made with ❤️ by GitHub Deploy Assistant Team**
