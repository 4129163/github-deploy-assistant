# 🚀 GitHub Deploy Assistant (GADA)

<p align="center">
  <img src="https://img.shields.io/badge/版本-1.0.0-blue" alt="版本">
  <img src="https://img.shields.io/badge/Node.js-≥18.0.0-green" alt="Node.js版本">
  <img src="https://img.shields.io/badge/许可证-MIT-yellow" alt="许可证">
  <img src="https://img.shields.io/badge/状态-稳定发布-brightgreen" alt="状态">
</p>

<p align="center">
  <strong>「零基础小白也能轻松部署GitHub项目！」</strong><br>
  一个智能的GitHub项目辅助安装程序，自动解读仓库并一键部署
</p>

<p align="center">
  <a href="#✨-主要特性">特性</a> •
  <a href="#📦-快速开始">快速开始</a> •
  <a href="#🎮-使用方式">使用方式</a> •
  <a href="#🔧-核心功能">功能</a> •
  <a href="#📖-详细教程">教程</a> •
  <a href="#❓-常见问题">常见问题</a>
</p>

---

## ✨ 主要特性

### 🎯 智能部署
- **AI智能分析**：自动识别项目类型（Node.js、Python、Go、React等）
- **一键部署**：输入GitHub链接，自动完成所有部署步骤
- **自动依赖安装**：自动安装所需的依赖包

### 🛡️ 安全可靠
- **部署前预检**：自动检查端口、磁盘、依赖等
- **一键修复**：发现问题自动修复或提供解决方案
- **实时监控**：监控系统资源使用情况

### 🎨 友好界面
- **可视化Web界面**：完全按钮化操作，无需输入命令
- **双模式支持**：Web界面 + 命令行工具，满足不同需求
- **响应式设计**：支持电脑、平板、手机访问

### 🔄 持续管理
- **项目管理**：启动、停止、重启、删除项目
- **自动备份**：定期自动备份，支持一键回滚
- **Webhook支持**：GitHub推送自动触发部署更新

---

## 📦 快速开始（5分钟上手）

### 第一步：环境准备（小白必读）

#### 1. 安装Node.js（如果还没有安装）

**Windows用户**：
1. 访问 [Node.js官网](https://nodejs.org/) 下载安装包
2. 双击安装，**一定要勾选 "Add to PATH"**（见图1）
3. 一路点击"Next"，使用默认设置即可

**macOS用户**：
```bash
# 方法1：使用Homebrew（推荐）
brew install node@18

# 方法2：官网下载安装包
# 访问 https://nodejs.org/ 下载macOS安装包
```

**Linux用户**：
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

#### 2. 验证Node.js安装成功
打开**终端**（Windows叫"命令提示符"或"PowerShell"）：
```bash
node --version
npm --version
```

✅ **预期看到**：
```
v18.17.0  # 版本号可能不同，只要≥18.0.0即可
9.6.7     # npm版本号
```

❌ **如果看到错误**：
- `node: command not found` → Node.js没安装或PATH没设置
- 重新安装，确保勾选"Add to PATH"

### 第二步：安装GitHub Deploy Assistant

#### 方法A：从Gitee克隆（推荐国内用户）
```bash
# 1. 打开终端，创建一个工作目录
mkdir ~/projects
cd ~/projects

# 2. 克隆项目
git clone https://gitee.com/kai0339/github-deploy-assistant.git
cd github-deploy-assistant

# 3. 安装依赖
npm install
```
✅ **预期看到**：
```
added 245 packages in 15s
```

#### 方法B：使用安装脚本
```bash
# 使用一键安装脚本
curl -fsSL https://raw.githubusercontent.com/4129163/github-deploy-assistant/main/install.sh | bash
# 或
wget -qO- https://raw.githubusercontent.com/4129163/github-deploy-assistant/main/install.sh | bash
```

### 第三步：启动服务

#### 方式1：启动Web界面（推荐小白）
```bash
# 启动Web服务器
npm run ui
```

✅ **预期看到**：
```
GitHub Deploy Assistant Web UI
服务器运行在: http://localhost:3000
按 Ctrl+C 停止服务器
```

#### 方式2：使用命令行工具
```bash
# 启动CLI工具
npm run cli
```

### 第四步：访问Web界面

1. 打开浏览器（Chrome/Edge/Firefox都可以）
2. 输入地址：`http://localhost:3000`
3. 看到漂亮的界面啦！🎉

---

## 🎮 使用方式

### 🌐 方式一：Web可视化界面（小白首选）

**访问地址**：`http://localhost:3000`

#### 界面布局：
```
┌─────────────────────────────────────┐
│ 左侧：项目列表                       │
│ 中间：项目详情                       │
│ 右侧：操作按钮组                     │
└─────────────────────────────────────┘
```

#### 部署一个新项目的步骤：
1. **点击** "添加项目" 按钮（左上角）
2. **粘贴** GitHub项目链接，例如：`https://github.com/facebook/react`
3. **点击** "分析仓库" 按钮
4. **查看** AI分析报告（会告诉你这是什么项目）
5. **点击** "一键部署" 按钮
6. **等待** 自动完成所有步骤
7. **完成**！项目已启动，可以访问了

### 💻 方式二：命令行工具（高级用户）

```bash
# 启动CLI
npm run cli

# 在CLI中部署项目
gada deploy https://github.com/facebook/react

# 查看帮助
gada --help
```

---

## 🔧 核心功能详解

### 1. 🎯 智能部署流程
```
输入GitHub链接 → AI分析项目 → 自动克隆 → 安装依赖 → 配置项目 → 启动服务
```

**支持的项目类型**：
- ✅ **前端项目**：React、Vue、Angular、Next.js、Nuxt.js
- ✅ **后端项目**：Node.js、Express、Koa、NestJS
- ✅ **Python项目**：Flask、Django、FastAPI
- ✅ **Go项目**：Gin、Echo、Beego
- ✅ **Java项目**：Spring Boot
- ✅ **Docker项目**：docker-compose
- ✅ **静态网站**：HTML/CSS/JS

### 2. 🛡️ 部署前预检清单
在部署前自动检查：
- ✅ **端口占用**：要用的端口是否被占用
- ✅ **磁盘空间**：硬盘空间是否足够
- ✅ **软件依赖**：Git、Node.js、Python等是否安装
- ✅ **系统库**：必要的系统库是否存在
- ✅ **网络连接**：能否访问GitHub和npm/pip源

**发现问题怎么办？**
- 🔧 **一键修复**：点击"一键修复"按钮自动解决问题
- 📖 **引导安装**：提供详细的安装指南
- 🔄 **自动换端口**：如果端口被占用，自动换一个可用端口

### 3. 🎨 按钮化界面操作
**所有操作都通过按钮完成**，不需要输入命令：

#### 核心操作组（绿色按钮）：
- 🟢 **启动项目**：启动已停止的项目
- 🔴 **停止项目**：停止运行中的项目
- 🔄 **重启项目**：重启项目服务
- 📋 **查看日志**：查看项目运行日志

#### 配置管理组（蓝色按钮）：
- 🔧 **修改端口**：修改项目运行端口
- 🌍 **环境变量**：设置项目环境变量
- 📦 **更新依赖**：更新项目的依赖包
- 🏗️ **重新构建**：重新构建项目

#### 高级操作组（紫色按钮）：
- 💾 **备份项目**：创建项目备份
- ↩️ **回滚项目**：恢复到之前版本
- 🩺 **项目诊断**：运行健康检查
- 🗑️ **删除项目**：删除项目（谨慎操作）

#### 诊断工具组（橙色按钮）：
- 🧪 **运行诊断**：全面检查项目状态
- ❤️ **健康检查**：检查项目是否健康运行
- 📊 **性能监控**：查看性能指标
- 🛠️ **一键修复**：自动修复发现的问题

### 4. 🔄 项目管理
- **项目列表**：所有项目一目了然
- **状态显示**：运行中、已停止、错误状态
- **快速筛选**：按类型、状态筛选项目
- **批量操作**：批量启动、停止多个项目

### 5. 📊 系统监控
- **CPU使用率**：实时监控CPU占用
- **内存使用**：监控内存使用情况
- **磁盘空间**：查看磁盘剩余空间
- **网络状态**：监控网络连接状态

### 6. 🔧 自动修复功能
**常见问题自动修复**：
1. **端口被占用** → 自动换一个可用端口
2. **依赖缺失** → 自动安装缺失的依赖
3. **权限不足** → 自动修复文件权限
4. **配置错误** → 自动修正配置问题

---

## 📖 详细教程

### 教程1：部署你的第一个React项目

#### 目标：部署一个React应用

#### 步骤：
```bash
# 1. 确保GitHub Deploy Assistant正在运行
npm run ui

# 2. 打开浏览器访问：http://localhost:3000

# 3. 点击"添加项目"按钮

# 4. 输入React项目链接（示例项目）：
https://github.com/facebook/create-react-app

# 5. 点击"分析仓库"按钮
#   等待AI分析完成，你会看到：
#   - 项目类型：React
#   - 需要的依赖：Node.js, npm
#   - 建议端口：3000

# 6. 点击"一键部署"按钮
#   系统会自动：
#   1. 克隆项目到本地
#   2. 安装依赖（npm install）
#   3. 启动开发服务器
#   4. 显示访问地址

# 7. 部署完成后，点击"启动项目"按钮
# 8. 在浏览器访问：http://localhost:3000
#    看到React欢迎页面！🎉
```

### 教程2：部署Python Flask项目

#### 目标：部署一个Python Flask Web应用

#### 步骤：
```bash
# 1. 在Web界面点击"添加项目"

# 2. 输入Flask项目链接（示例）：
https://github.com/pallets/flask

# 3. 点击"分析仓库"
#    如果系统提示"需要Python"，点击"一键修复"

# 4. 一键修复会：
#    - 检查Python是否安装
#    - 如果没有，提供安装指南
#    - 检查pip是否安装
#    - 自动安装Flask依赖

# 5. 点击"一键部署"
#    系统会自动创建虚拟环境并安装依赖

# 6. 部署完成后，点击"启动项目"
# 7. 访问：http://localhost:5000
```

### 教程3：使用CLI工具批量部署

```bash
# 1. 准备一个项目列表文件 projects.txt
https://github.com/facebook/react
https://github.com/vuejs/vue
https://github.com/expressjs/express

# 2. 使用CLI批量部署
gada batch-deploy projects.txt

# 3. 查看部署状态
gada list-projects

# 4. 启动所有项目
gada start-all
```

---

## 🔌 API接口（开发者参考）

### 基础API

#### 1. 健康检查
```http
GET /api/health
```
**响应**：
```json
{
  "status": "ok",
  "timestamp": "2026-04-04T05:54:08.123Z",
  "uptime": 1234.56
}
```

#### 2. 部署项目
```http
POST /api/deploy
Content-Type: application/json

{
  "repoUrl": "https://github.com/facebook/react",
  "branch": "main",
  "port": 3000
}
```

#### 3. 项目管理
```http
# 启动项目
POST /api/projects/{id}/start

# 停止项目
POST /api/projects/{id}/stop

# 重启项目
POST /api/projects/{id}/restart

# 删除项目
DELETE /api/projects/{id}
```

### 预检API

#### 1. 运行预检
```http
POST /api/precheck
Content-Type: application/json

{
  "port": 3000,
  "requiredDeps": ["node", "git", "python3"]
}
```

#### 2. 一键修复
```http
POST /api/fix
Content-Type: application/json

{
  "issue": "port_in_use",
  "port": 3000,
  "suggestedPort": 3001
}
```

---

## ⚙️ 配置说明

### 环境变量配置
复制 `.env.example` 为 `.env` 并修改：

```bash
# 复制配置文件
cp .env.example .env

# 编辑配置文件（用记事本或VS Code打开）
nano .env  # 或 code .env
```

#### 重要配置项：
```env
# 服务器端口
PORT=3000

# AI提供商（支持多种AI）
DEFAULT_AI_PROVIDER=openai
OPENAI_API_KEY=your_key_here

# 安全配置（重要！）
GADA_SECRET_KEY=your_secure_random_key_here
SESSION_SECRET=another_random_key_here

# 日志配置
LOG_LEVEL=info
MAX_LOG_SIZE_MB=50
```

#### 生成安全密钥：
```bash
# 生成一个安全的随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 将输出的字符串复制到 GADA_SECRET_KEY
```

---

## ❓ 常见问题（FAQ）

### Q1: 启动时提示"端口被占用"怎么办？
**A**: 点击"一键修复"按钮，系统会自动：
1. 检测哪个程序占用了端口
2. 建议关闭该程序或换端口
3. 提供"自动换端口"选项

### Q2: Node.js安装失败怎么办？
**A**: 按步骤解决：
1. **Windows用户**：确保以管理员身份运行安装程序
2. **macOS用户**：尝试 `brew install node@18 --force`
3. **Linux用户**：使用NodeSource仓库安装
4. **仍然失败**：访问 [Node.js官网](https://nodejs.org/) 下载安装包手动安装

### Q3: 克隆GitHub项目很慢怎么办？
**A**: 系统内置了网络优化：
1. 自动检测网络环境
2. 使用国内镜像加速（如果在中国）
3. 支持配置代理服务器
4. 提供手动下载选项

### Q4: 依赖安装失败怎么办？
**A**: 点击"项目诊断"按钮，系统会：
1. 分析失败原因
2. 提供修复方案
3. 自动切换npm/pip源
4. 清理缓存重试

### Q5: 如何备份和恢复项目？
**A**: 
1. **备份**：点击"备份项目"按钮，选择备份位置
2. **恢复**：点击"回滚项目"，选择备份文件
3. **自动备份**：系统每天自动备份一次

### Q6: 支持私有仓库吗？
**A**: 支持！需要配置GitHub Token：
1. 生成GitHub Token：[创建Token](https://github.com/settings/tokens)
2. 在Web界面设置中配置Token
3. 系统会自动加密保存Token

### Q7: 如何更新到最新版本？
**A**: 
```bash
# 方法1：通过Git更新
git pull origin main
npm install

# 方法2：使用内置更新功能
# 在Web界面点击"系统设置" → "检查更新"
```

---

## 🚨 故障排除

### 问题1: 无法启动Web服务器
**症状**：运行 `npm run ui` 后立即退出
**解决**：
```bash
# 1. 检查端口是否被占用
lsof -i :3000  # Linux/macOS
netstat -ano | findstr :3000  # Windows

# 2. 换一个端口
PORT=4000 npm run ui

# 3. 检查Node.js版本
node --version  # 需要≥18.0.0
```

### 问题2: Web界面无法访问
**症状**：浏览器显示"无法连接"
**解决**：
1. 确认服务器正在运行：`npm run ui` 没有退出
2. 检查防火墙：确保3000端口开放
3. 尝试访问：`http://127.0.0.1:3000` 或 `http://localhost:3000`
4. 检查浏览器控制台：按F12查看错误

### 问题3: 部署过程中卡住
**症状**：部署进度条不动
**解决**：
1. 点击"查看日志"按钮查看详细进度
2. 可能是网络问题，等待几分钟
3. 点击"取消"后重新部署
4. 检查网络连接：`ping github.com`

### 问题4: 项目启动后无法访问
**症状**：项目状态显示"运行中"，但浏览器访问不了
**解决**：
1. 点击"查看日志"查看项目输出
2. 可能是端口冲突，点击"修改端口"换一个端口
3. 检查项目配置是否正确
4. 运行"项目诊断"查找问题

---

## 📁 项目结构

```
github-deploy-assistant/
├── README.md                   # 你现在看的这个文件
├── package.json               # 项目配置和依赖
├── server.js                  # Web服务器入口
├── public/                    # Web界面文件
│   ├── index.html            # 主页面
│   ├── css/                  # 样式文件
│   └── js/                   # JavaScript文件
├── src/                      # 源代码
│   ├── cli/                  # 命令行工具
│   ├── server/               # 服务器代码
│   ├── routes/               # API路由
│   ├── repo-analyzer/        # 仓库分析器
│   ├── project-doctor/       # 项目医生（诊断修复）
│   ├── env-checker/          # 环境检查器
│   └── utils/                # 工具函数
├── database/                 # 数据库文件
├── logs/                     # 日志文件
└── workspace/                # 项目工作目录
```

---

## 🤝 贡献指南

欢迎贡献代码！请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

### 开发环境搭建：
```bash
# 1. 克隆项目
git clone https://gitee.com/kai0339/github-deploy-assistant.git
cd github-deploy-assistant

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 运行测试
npm test

# 5. 代码检查
npm run lint
```

### 提交代码规范：
1. 创建功能分支：`git checkout -b feature/your-feature`
2. 提交更改：`git commit -m "feat: 添加新功能"`
3. 推送分支：`git push origin feature/your-feature`
4. 创建Pull Request

---

## 📄 许可证

MIT License © 2026 GitHub Deploy Assistant

---

## 📞 支持与反馈

- **GitHub Issues**: [提交问题](https://github.com/4129163/github-deploy-assistant/issues)
- **Gitee Issues**: [国内用户](https://gitee.com/kai0339/github-deploy-assistant/issues)
- **邮箱**: 19106440339@163.com

## 🙏 致谢

感谢所有贡献者和用户的支持！特别感谢：

- OpenAI、DeepSeek、智谱等AI提供商
- GitHub、Gitee等代码托管平台
- 所有测试用户和反馈者

---

## 🚀 下一步做什么？

### 如果你是小白用户：
1. ✅ **已完成**：阅读了README
2. 👉 **下一步**：按照"快速开始"安装软件
3. 🎯 **目标**：在30分钟内部署第一个项目

### 如果你已经安装：
1. 👉 **试试这些功能**：
   - 部署一个React项目
   - 运行项目诊断
   - 创建项目备份
2. 📖 **深入学习**：
   - 查看详细教程
   - 学习API接口
   - 了解配置选项

### 如果你是开发者：
1. 👨💻 **贡献代码**：查看贡献指南
2. 🔧 **扩展功能**：添加新的项目类型支持
3. 🐛 **报告问题**：帮助我们改进

---

<p align="center">
  <strong>祝你使用愉快！如果有任何问题，请随时提问。😊</strong>
</p>

<p align="center">
  <sub>最后更新：2026年4月4日</sub>
</p>