# 🚀 GitHub Deploy Assistant (GADA) - 零基础小白也能轻松部署GitHub项目！

<p align="center">
  <img src="https://img.shields.io/badge/版本-2.0.0-i18n-blue" alt="版本">
  <img src="https://img.shields.io/badge/Node.js-≥18.0.0-green" alt="Node.js版本">
  <img src="https://img.shields.io/badge/许可证-MIT-yellow" alt="许可证">
  <img src="https://img.shields.io/badge/状态-稳定发布-brightgreen" alt="状态">
</p>

<p align="center">
  <strong>「GitHub项目一键部署，不懂命令行也能搞定！」</strong><br>
  一个智能的GitHub项目自动安装助手，从粘贴链接到项目运行，全程鼠标点击完成
</p>

<p align="center">
  <a href="#📚-给小白用户的一封信">给小白的话</a> •
  <a href="#🎯-这个工具能帮你做什么">它能做什么</a> •
  <a href="#📦-快速开始小白5分钟上手">快速开始</a> •
  <a href="#🎮-详细使用教程">详细教程</a> •
  <a href="#🔧-仓库所有功能大揭秘">所有功能</a> •
  <a href="#❓-常见问题我遇到了怎么办">常见问题</a>
</p>

---

## 📚 给小白用户的一封信

你好！我知道你可能：

- ❌ **完全没学过编程**，看到`git clone`、`npm install`这些命令就头疼
- ❌ **想用开源AI项目**，但跟着教程做总是卡住，不知道错在哪里
- ❌ **不懂命令行**，每次部署都要找朋友帮忙
- ❌ **怕把电脑搞坏**，不敢随便安装东西

**别担心！** GADA就是为你设计的：

- ✅ **不需要懂命令行**：全程按钮操作，鼠标点点点就行
- ✅ **有手就能用**：就像安装手机APP一样简单
- ✅ **自动帮你解决所有问题**：遇到错误？AI自动诊断
- ✅ **安全第一**：不会破坏你的系统，随时可以卸载

**简单来说：** 你只需要**粘贴GitHub链接**，剩下的交给GADA！

---

## 🎯 这个工具能帮你做什么？

### 🎨 一句话总结
**把GitHub上的任何项目（AI工具、网站、软件）一键安装到你的电脑上，就像安装手机APP一样简单。**

### 🌟 具体能做什么？

1. **部署AI项目**：比如ChatGPT网页版、AI绘画工具、语音识别工具
2. **搭建个人网站**：博客、作品集、在线简历
3. **运行实用工具**：文件管理、数据备份、系统监控
4. **学习编程**：安全地尝试各种开源项目，不用担心搞坏电脑
5. **管理多个项目**：所有项目统一管理，一键启动/停止

### ⚡ 核心优势

| 功能 | 传统方式 | GADA方式 |
|------|---------|---------|
| **安装项目** | 要学git命令、找教程、看文档 | 粘贴链接 → 点击"一键部署" |
| **解决错误** | 百度搜半天，问大佬，可能还解决不了 | AI自动诊断，给出修复方案 |
| **管理项目** | 手动记录，容易忘记 | 统一界面管理，状态一目了然 |
| **安全考虑** | 自己安装可能破坏系统 | 安全沙箱，不影响电脑其他软件 |

---

## 📦 快速开始（小白5分钟上手）

### 💡 准备工作清单

**在开始之前，你需要准备：**
1. 一台电脑（Windows/Mac/Linux都可以）
2. 能上网（需要访问GitHub）
3. **不需要**编程知识
4. **不需要**懂命令行

### 🛠️ 第一步：安装所需软件（一次安装，永久使用）

#### ⚠️ 重要提醒：这是唯一的安装步骤，以后就再也不用安装了！

#### 📥 **Windows用户**安装步骤（截图级指引）：

1. **下载Node.js**（运行GADA需要的环境）
   - 打开浏览器，访问：https://nodejs.org/
   - 点击绿色的"LTS"按钮下载
   - 下载完成后双击安装
   - **⚠️ 关键步骤**：安装时一定要勾选✅ **"Add to PATH"**（如图1）
   - 其他选项全部默认，一路点击"Next"

   ![Node.js安装截图](https://img.shields.io/badge/安装截图-看图1-red)

2. **下载Git**（下载GitHub项目需要的工具）
   - 打开浏览器，访问：https://git-scm.com/
   - 点击"Download for Windows"下载
   - 下载完成后双击安装
   - **⚠️ 关键步骤**：安装时选择✅ **"Use Git from the Windows Command Prompt"**（如图2）
   - 其他选项全部默认，一路点击"Next"

   ![Git安装截图](https://img.shields.io/badge/安装截图-看图2-red)

3. **验证安装成功**
   - 按`Win+R`键，输入`cmd`，回车
   - 在黑色窗口（这叫"命令提示符"）中输入：
     ```
     node --version
     npm --version
     git --version
     ```
   - ✅ **预期看到**（版本号可能不同，只要看到数字就行）：
     ```
     v18.17.0
     9.6.7
     git version 2.45.0
     ```
   - ❌ **如果看到错误**：
     - `node: command not found` → Node.js没装好，重新安装勾选"Add to PATH"
     - `git: command not found` → Git没装好，重新安装

#### 🍎 **Mac用户**安装步骤：

1. **安装Homebrew**（一个软件安装工具）
   - 打开"终端"（在"应用程序"→"实用工具"里找）
   - 粘贴下面命令，回车：
     ```bash
     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
     ```
   - 等它安装完（可能需要10-20分钟）

2. **安装Node.js和Git**
   - 在终端里继续输入：
     ```bash
     brew install node@18 git
     ```
   - 等它安装完（可能需要5-10分钟）

3. **验证安装**
   ```bash
   node --version
   npm --version
   git --version
   ```
   - 应该能看到版本号

#### 🐧 **Linux用户**安装步骤：

```bash
# Ubuntu/Debian系统
sudo apt update
sudo apt install nodejs npm git

# CentOS/RHEL系统
sudo yum install nodejs npm git
```

### 🚀 第二步：安装GitHub Deploy Assistant（GADA）

现在安装GADA本身：

#### **方法A：一键安装（推荐！）**

打开终端/命令提示符，粘贴下面命令：

```bash
# Linux/Mac用户
curl -fsSL https://raw.githubusercontent.com/4129163/github-deploy-assistant/main/install.sh | bash

# Windows用户（用PowerShell）
# 1. 按Win+R，输入powershell，回车
# 2. 粘贴下面命令，回车
irm https://raw.githubusercontent.com/4129163/github-deploy-assistant/main/install.ps1 | iex
```

✅ **预期看到**：
```
正在安装GitHub Deploy Assistant...
下载完成！
安装成功！
请运行: cd github-deploy-assistant && npm start
```

#### **方法B：手动安装（如果一键安装失败）**

```bash
# 1. 下载项目
git clone https://gitee.com/kai0339/github-deploy-assistant.git

# 2. 进入项目文件夹
cd github-deploy-assistant

# 3. 安装依赖（这步需要时间，可以喝杯咖啡）
npm install
```

✅ **预期看到**：
```
added 245 packages in 15s
```

### 🖥️ 第三步：启动GADA

```bash
# 进入项目文件夹（如果已经不在的话）
cd github-deploy-assistant

# 启动Web界面
npm start
```

✅ **预期看到**：
```
GitHub Deploy Assistant (GADA) v2.0.0
============================================
Server:    http://localhost:3456
WorkDir:   ./workspace
WebSocket: ws://localhost:3456
Press Ctrl+C to stop
============================================
```

### 🌐 第四步：打开Web界面

1. **打开浏览器**（Chrome/Edge/Firefox都可以）
2. **输入地址**：`http://localhost:3456`
3. **看到界面啦！** 🎉

✅ **预期看到**：
```
┌──────────────────────────────────────────┐
│ 🚀 GitHub Deploy Assistant                │
│                                          │
│ 左侧菜单：                                │
│ • 🏠 部署向导                            │
│ • 📂 项目管理                            │
│ • 🔍 本地扫描                            │
│ • ...（更多功能）                         │
│                                          │
│ 中间区域：                                │
│ 粘贴GitHub链接，一键部署！                │
└──────────────────────────────────────────┘
```

### ⏸️ 如何停止GADA？

- 在终端/命令提示符里按`Ctrl+C`
- 看到`^C`就表示停止了

### 🔄 下次如何启动？

1. 打开终端/命令提示符
2. 输入：
   ```bash
   cd github-deploy-assistant
   npm start
   ```
3. 浏览器打开`http://localhost:3456`

---

## 🎮 详细使用教程（从零开始，手把手）

### 📖 教程1：部署你的第一个项目（React示例）

#### **目标**：部署一个React网站到你的电脑

#### **步骤详解**：

**第1步：找到想部署的项目**
- 打开GitHub，找一个React项目，比如：https://github.com/facebook/create-react-app
- 或者直接用这个链接，这是Facebook官方的React创建工具

**第2步：在GADA中粘贴链接**
1. 确保GADA正在运行（看到`http://localhost:3456`能打开）
2. 在GADA界面中间的大输入框里，粘贴GitHub链接
3. 点击"分析仓库"按钮

**第3步：等待AI分析**
- ⏳ 等待30秒左右
- ✅ **预期看到**：
  ```
  🧠 AI分析完成！
  项目类型：React前端项目
  所需环境：Node.js 18+
  建议端口：3000
  ```

**第4步：一键部署**
1. 点击"一键部署"按钮
2. 看进度条动起来！系统会自动：
   - 📥 下载项目到你的电脑
   - 📦 安装所有需要的软件包
   - ⚙️ 配置项目设置
   - 🚀 启动项目

**第5步：查看结果**
- 部署完成后，你会看到：
  ```
  ✅ 部署成功！
  项目已启动：http://localhost:3000
  点击"打开"访问项目
  ```
- 点击"打开"，浏览器会自动打开React欢迎页面！

**第6步：管理项目**
- 在左侧"📂 项目管理"里，能看到你部署的所有项目
- 每个项目都有：
  - ▶️ **启动**：项目停止时点这个
  - ⏹️ **停止**：想关闭项目时点这个
  - 🔄 **重启**：项目卡住时点这个
  - 📋 **日志**：查看项目运行信息

### 📖 教程2：部署Python项目（Flask网站）

#### **目标**：部署一个Python写的网站

#### **如果系统提示"需要Python"怎么办？**

**情况1：你还没安装Python**
- GADA会提示："检测到需要Python 3.8+，但未安装"
- 点击"一键修复"
- ✅ **预期看到**：
  ```
  🔧 正在安装Python...
  1. 访问 https://www.python.org/downloads/
  2. 下载Python 3.11+
  3. 安装时勾选"Add Python to PATH"
  4. 安装完成后重启GADA
  ```
- 按照提示安装Python，然后重新部署

**情况2：已有Python但版本不对**
- GADA会提示："当前Python 3.7，建议升级到3.8+"
- 可以：
  1. 点击"忽略警告，继续部署"（大多数情况能运行）
  2. 或先升级Python，再重新部署

#### **Python项目部署流程**：
1. 粘贴Python项目链接，如：`https://github.com/pallets/flask`
2. 点击"分析仓库"
3. 点击"一键部署"
4. 系统会自动创建虚拟环境、安装依赖
5. 部署完成后，点击"启动"
6. 访问`http://localhost:5000`

### 📖 教程3：使用Docker快速体验（不用安装Node.js）

#### **如果你不想安装Node.js和Git**，可以用Docker：

```bash
# 前提：你的电脑已经安装了Docker
# 如果没安装，访问 https://www.docker.com/get-started

# 一键运行GADA
docker run -p 3456:3456 -v ./workspace:/workspace kai0339/github-deploy-assistant:latest

# 然后访问 http://localhost:3456
```

**Docker方式的优势**：
- ✅ **不用安装Node.js和Git**
- ✅ **环境隔离**，不会影响电脑其他软件
- ✅ **一键清理**：删除容器就完全清理干净

---

## 🔧 仓库所有功能大揭秘（你可能不知道的隐藏功能）

### 🏠 1. 部署向导（核心功能）
**做什么**：粘贴GitHub链接，自动部署
**怎么用**：主界面中间输入框
**看到什么**：项目分析报告、部署进度条、完成提示
**然后做什么**：点击"打开"访问项目，或到"项目管理"统一管理

### 📂 2. 项目管理（已部署项目的家）
**功能列表**：
- **▶️ 启动**：让停止的项目运行起来
- **⏹️ 停止**：关闭运行中的项目
- **🔄 重启**：重新启动项目（解决卡顿）
- **🔔 检测更新**：检查GitHub上有没有新版本
- **💬 问AI**：项目出问题了？直接问AI
- **🔔 Webhook**：设置代码一推送就自动更新
- **💾 备份/回滚**：创建备份，有问题时一键恢复
- **📋 部署日志**：查看每次部署的详细记录
- **🔗 分享**：生成分享链接发给朋友
- **🌍 远程部署**：把项目部署到云服务器/树莓派
- **🌐 打开**：在浏览器打开项目
- **🗑 卸载**：删除项目（可选保留备份）

### 🔍 3. 本地扫描（发现电脑里已有的项目）
**做什么**：扫描你的电脑，自动发现已经下载的GitHub项目
**怎么用**：点击左侧"🔍 本地扫描"
**看到什么**：扫描到的项目列表
**然后做什么**：点击"导入到GADA"统一管理

### 🔎 4. 项目搜索（找热门项目）
**做什么**：在GitHub上搜索热门项目
**怎么用**：点击左侧"🔎 项目搜索"，输入关键词
**看到什么**：搜索结果，按分类筛选
**然后做什么**：点击项目直接部署

### 🖥️ 5. 设备信息（查看电脑配置）
**做什么**：查看你的电脑硬件信息
**能看到**：
- **CPU**：型号、核心数、使用率
- **内存**：总量、已用、剩余
- **磁盘**：各个硬盘的使用情况
- **GPU**：显卡信息（如果有）
- **网络**：IP地址、连接状态
- **系统**：操作系统版本

### 📦 6. 软件检测（检查所需软件是否安装）
**做什么**：检查运行项目需要的软件是否已安装
**检查项**：
- ✅ **Node.js**：版本号，是否≥18.0.0
- ✅ **Python**：版本号，是否≥3.8
- ✅ **Docker**：是否安装，版本号
- ✅ **Git**：是否安装，版本号
- ✅ **Java**：是否安装，版本号
- ❌ **如果缺失**：提供安装链接和教程

### 📋 7. 环境指南（各种软件的安装教程）
**包含内容**：
- **Node.js安装**：Windows/Mac/Linux全平台教程
- **Python安装**：详细步骤+截图
- **Docker安装**：从零开始手把手
- **Git安装**：配置用户名邮箱教程
- **Java安装**：JDK下载配置指南
- **Go安装**：环境变量设置
- **Rust安装**：Cargo配置

### ✅ 8. 环境检测（一键检查所有需求）
**做什么**：全面检查你的电脑是否满足项目运行要求
**检查项目**：
- ✅ **端口**：需要的端口是否被占用
- ✅ **磁盘空间**：硬盘是否够用
- ✅ **内存**：内存是否充足
- ✅ **依赖软件**：Node.js/Python等是否安装
- ✅ **系统库**：必要的系统文件是否存在
- ✅ **网络**：能否访问GitHub和软件源

### 🗂️ 9. 部署模板（常用部署脚本）
**做什么**：提供常见项目的部署脚本模板
**模板类型**：
- **Node.js项目**：Express、Koa、NestJS
- **Python项目**：Flask、Django、FastAPI
- **Docker项目**：docker-compose配置
- **Nginx反代**：配置域名和SSL证书
- **PM2守护**：让Node.js项目后台运行
- **系统服务**：设置开机自启动

### 🖥️ 10. 系统状态（GADA自身健康）
**查看内容**：
- **CPU使用率**：实时图表
- **内存使用**：实时图表
- **运行中的项目**：列表+状态
- **一键自检**：检查GADA是否健康
- **网络连通性**：测试网络连接
- **配置导出/导入**：换电脑时迁移设置

### 📄 11. 日志浏览（查看所有记录）
**做什么**：查看GADA运行的所有记录
**功能**：
- **实时刷新**：自动显示最新日志
- **关键词过滤**：搜索error、warn、info
- **日志级别**：按严重程度筛选
- **导出日志**：保存到本地文件

### 📊 12. 资源监控（性能图表）
**显示内容**：
- **CPU使用率**：折线图，看历史趋势
- **内存使用**：折线图，看内存占用
- **磁盘使用**：饼图，看各个目录占用
- **网络流量**：实时流量图

### 🤖 13. AI设置（配置智能助手）
**支持哪些AI**：
| 提供商 | 特点 | 适合谁 |
|--------|------|--------|
| **DeepSeek** | 国内可用，价格便宜 | 国内用户首选 |
| **OpenAI** | GPT-4o，功能强大 | 有OpenAI账号的用户 |
| **Google Gemini** | 免费额度大 | 想免费体验的用户 |
| **Claude** | 逻辑清晰，代码能力强 | 开发者 |
| **月之暗面** | 中文理解好 | 中文项目分析 |
| **通义千问** | 阿里出品，免费额度 | 阿里云用户 |
| **智谱GLM** | 国产优秀模型 | 支持国产AI |

**如何配置**：
1. 点击"🤖 AI设置"
2. 选择提供商
3. 粘贴API Key（AI服务商给的密码）
4. 点击"保存"
5. ✅ 看到"配置成功"即可

### 🔗 14. 分享记录（把项目分享给朋友）
**做什么**：生成一个链接，朋友点开就能看到你的部署配置
**功能**：
- **设置有效期**：24小时、3天、7天、30天、永久
- **包含内容**：项目配置+部署步骤
- **朋友无需安装**：直接浏览器打开就能看
- **管理分享**：随时撤销分享链接

### 🌍 15. 远程部署（部署到云服务器）
**做什么**：把项目部署到其他电脑/服务器
**支持**：
- **树莓派**：智能家居、物联网项目
- **云服务器**：腾讯云、阿里云、VPS
- **NAS**：家庭存储服务器
- **任何Linux机器**：只要能SSH连接

**使用步骤**：
1. 点击"🌍 远程部署" → "添加主机"
2. 填写：IP地址、端口（默认22）、用户名、密码
3. 点击"测试连接"
4. ✅ 连接成功后，选择项目，点击"开始远程部署"

### ⚡ 16. 自动触发（代码一推就自动更新）
**做什么**：设置后，GitHub代码一更新，服务器自动跟着更新
**原理**：
```
你改代码 → 推送到GitHub → GitHub通知GADA → GADA自动拉取最新代码 → 重启服务
```

**设置步骤**：
1. 项目卡片点击"🔔 Webhook"
2. 复制Webhook URL和密钥
3. 到GitHub仓库 → Settings → Webhooks → Add webhook
4. 粘贴URL和密钥，选择`push`事件
5. 保存

### 🔒 17. 私有仓库（部署需要密码的项目）
**做什么**：部署需要登录才能看的GitHub项目
**步骤**：
1. 到GitHub → Settings → Developer settings → Personal access tokens
2. 生成Token（勾选`repo`权限）
3. 在GADA中点击"🔒 私有仓库" → "添加Token"
4. 填写名称和Token
5. 保存后，就可以像公开项目一样部署私有项目了

### 🩺 18. 项目医生（AI自动诊断修复）
**做什么**：项目出问题了？AI帮你诊断
**能诊断**：
- ❌ 依赖安装失败
- ❌ 项目启动失败
- ❌ 端口被占用
- ❌ 配置文件错误
- ❌ 权限问题
- ❌ 网络问题

**使用**：
1. 项目出问题时，点击"💬 问AI"
2. 描述问题，或者直接点"自动诊断"
3. AI分析错误日志，给出修复方案
4. 可以点击"一键修复"自动执行修复命令

### 🔐 19. 安全扫描（检查项目安全性）
**做什么**：自动扫描项目的依赖是否存在安全漏洞
**检查项**：
- ✅ **npm audit**：Node.js项目依赖漏洞
- ✅ **pip check**：Python项目依赖问题
- ✅ **代码风险扫描**：检查常见安全问题
- ✅ **权限检查**：文件权限是否安全

**发现漏洞怎么办**：
- ⚠️ **高危漏洞**：红色警告，建议立即修复
- ⚠️ **中危漏洞**：黄色警告，建议近期修复
- ℹ️ **低危漏洞**：蓝色提示，可选择性修复

### 💾 20. 智能存档与回档（后悔药功能）
**做什么**：自动备份，随时可以回到之前的版本
**功能**：
- **自动存档**：每次部署前自动备份
- **手动存档**：随时创建备份点
- **永久保留第一份**：永远保留第一次部署的版本
- **自动导出数据**：备份包含所有配置和数据
- **回档提示**：回滚前提示会丢失哪些数据

**使用**：
1. 项目卡片点击"💾 备份/回滚"
2. 看到所有历史备份
3. 选择要恢复的版本
4. 点击"回滚到此版本"
5. 确认后，项目就回到那个时间点了

---

## 🤖 配置AI（让GADA更聪明）

### 🎯 为什么要配置AI？
AI能让GADA：
- 🧠 **更聪明地分析项目**：准确识别项目类型
- 🔧 **更好地解决问题**：遇到错误时给出准确方案
- 💬 **回答你的问题**：不懂就问，AI耐心解答

### ❌ 不配置AI能用吗？
**可以！** 不配置AI也能：
- ✅ 部署大部分常见项目
- ✅ 使用所有管理功能
- ✅ 手动解决问题

只是没有AI辅助分析而已。

### 🏆 推荐方案（国内用户）

#### **方案1：DeepSeek（最推荐）**
**优点**：便宜、稳定、中文好、国内直连
**步骤**：
1. 访问 https://platform.deepseek.com
2. 注册账号（手机号或邮箱）
3. 点击"API Keys" → "Create new key"
4. 复制生成的Key
5. 在GADA中：🤖 AI设置 → 选择DeepSeek → 粘贴Key → 保存

#### **方案2：通义千问（免费额度）**
**优点**：阿里出品，有免费额度
**步骤**：
1. 访问 https://dashscope.aliyun.com
2. 用支付宝登录
3. 获取API Key
4. 在GADA中配置

### 🔧 其他AI提供商配置

| 提供商 | 获取Key地址 | 免费额度 |
|--------|------------|----------|
| **OpenAI** | https://platform.openai.com | 无，需付费 |
| **Google Gemini** | https://aistudio.google.com | 有，较多 |
| **Claude** | https://console.anthropic.com | 无，需付费 |
| **月之暗面** | https://platform.moonshot.cn | 有免费额度 |
| **智谱GLM** | https://open.bigmodel.cn | 有免费额度 |

### 🔄 如何切换AI提供商？
1. 点击"🤖 AI设置"
2. 选择新的提供商
3. 粘贴新的API Key
4. 点击"保存"
5. ✅ 看到"配置成功"即可

---

## 🌐 环境变量配置（高级设置）

### ⚠️ 注意：普通用户不需要配置这个！

**什么时候需要配置？**
- 想修改GADA的默认端口
- 想修改项目保存位置
- 需要设置代理服务器
- 调整高级安全设置

### 📝 配置方法

```bash
# 1. 复制配置文件模板
cp .env.example .env

# 2. 用记事本打开 .env 文件
# Windows：右键 .env → 打开方式 → 记事本
# Mac：双击 .env → 选择"文本编辑"
# Linux：nano .env 或 vim .env

# 3. 修改需要的配置
```

### 🔧 常用配置项说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3456` | GADA网页的端口号 |
| `WORK_DIR` | `./workspace` | 项目保存的位置 |
| `ALLOW_AUTO_EXEC` | `true` | 是否允许自动执行命令 |
| `LOG_LEVEL` | `info` | 日志详细程度 |
| `GADA_SECRET_KEY` | **需要修改** | 加密密钥（重要！） |

### 🔐 生成安全密钥

```bash
# 运行这个命令生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 把输出的长字符串复制到 .env 的 GADA_SECRET_KEY
```

**为什么需要改密钥？**
- 保护你的私有仓库Token
- 防止他人窃取你的GitHub访问权限
- 提高整体安全性

---

## ❓ 常见问题（"我遇到了...该怎么办"）

### ❓ 问题1：启动后浏览器打不开 http://localhost:3456

**可能原因**：
1. 端口被其他程序占用
2. 防火墙阻止了访问
3. GADA没有正常启动

**解决步骤**：

**步骤1：检查GADA是否真的启动了**
- 看终端/命令提示符里有没有显示：
  ```
  Server:    http://localhost:3456
  ```
- 如果没有，按`Ctrl+C`停止，重新运行`npm start`

**步骤2：检查端口是否被占用**
```bash
# Windows
netstat -ano | findstr :3456

# Mac/Linux
lsof -i :3456
```
- 如果看到其他程序占用了3456端口，可以：
  1. 关闭那个程序
  2. 或修改GADA端口（见下面）

**步骤3：修改GADA端口**
```bash
# 方法1：临时修改
PORT=4000 npm start
# 然后访问 http://localhost:4000

# 方法2：永久修改
# 修改 .env 文件，把 PORT=3456 改成 PORT=4000
# 然后重新启动
```

**步骤4：检查防火墙**
- **Windows**：控制面板 → Windows Defender防火墙 → 允许应用通过防火墙
- **Mac**：系统设置 → 隐私与安全性 → 防火墙
- 确保Node.js和你的浏览器能通过防火墙

### ❓ 问题2：npm install 很慢，卡住了

**原因**：国内访问npm官方源很慢

**解决方案**：

**方案1：使用国内镜像（推荐）**
```bash
# 设置淘宝镜像
npm config set registry https://registry.npmmirror.com

# 然后重新运行 npm install
```

**方案2：使用yarn（如果项目支持）**
```bash
# 如果项目有 yarn.lock 文件
yarn install
```

**方案3：手动下载依赖**
```bash
# 1. 先设置镜像
npm config set registry https://registry.npmmirror.com

# 2. 清理缓存
npm cache clean --force

# 3. 重新安装
npm install
```

**预期时间**：
- 国内镜像：通常1-5分钟
- 官方源：可能10-30分钟甚至更久

### ❓ 问题3：项目启动失败，显示错误

**解决流程**：

**第1步：查看详细错误**
- 在GADA界面，找到失败的项目
- 点击"📋 日志"按钮
- 查看错误信息（红色部分）

**第2步：问AI帮忙**
- 点击"💬 问AI"按钮
- 描述问题，或者直接点"自动诊断"
- AI会分析错误并给出解决方案

**第3步：常见错误解决方案**

**错误类型1：端口被占用**
```
Error: listen EADDRINUSE: address already in use :::3000
```
**解决**：
1. 点击"🔧 修改端口"按钮
2. 输入新端口，如`3001`
3. 点击"保存并重启"

**错误类型2：依赖缺失**
```
Error: Cannot find module 'express'
```
**解决**：
1. 点击"📦 更新依赖"按钮
2. 系统会重新安装依赖
3. 或者手动运行`npm install`

**错误类型3：配置文件错误**
```
Error: Invalid configuration in .env
```
**解决**：
1. 点击"🌍 环境变量"按钮
2. 检查配置是否正确
3. 参考项目README中的配置说明

**错误类型4：内存不足**
```
JavaScript heap out of memory
```
**解决**：
1. 点击"🩺 项目诊断"
2. AI会建议增加内存限制
3. 或者简化项目配置

**第4步：如果还不行**
1. 点击"🔔 检测更新"，确保项目是最新版
2. 点击"💾 备份/回滚"，回到之前能用的版本
3. 到GitHub Issues页面查看是否有相同问题

### ❓ 问题4：克隆GitHub项目很慢或失败

**原因**：国内访问GitHub有时不稳定

**解决方案**：

**方案1：使用Gitee镜像（推荐）**
- 很多热门项目都有Gitee镜像
- 在GADA中搜索时，优先选择Gitee源

**方案2：配置Git代理**
```bash
# 如果使用代理
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 取消代理
git config --global --unset http.proxy
git config --global --unset https.proxy
```

**方案3：使用ghproxy加速**
```bash
git config --global url."https://ghproxy.com/https://github.com/".insteadOf "https://github.com/"
```

**方案4：手动下载ZIP**
1. 到GitHub页面，点击"Code" → "Download ZIP"
2. 解压到`workspace`目录
3. 在GADA中点击"🔍 本地扫描" → 导入项目

### ❓ 问题5：私有仓库提示"没有权限"

**原因**：需要GitHub Token才能访问私有仓库

**解决步骤**：

**步骤1：创建GitHub Token**
1. 登录GitHub
2. 点击右上角头像 → Settings
3. 左侧 Developer settings → Personal access tokens → Tokens (classic)
4. 点击"Generate new token" → "Generate new token (classic)"
5. **重要**：勾选✅ `repo`（全部仓库权限）
6. 设置过期时间（建议选"90 days"）
7. 点击"Generate token"
8. **立即复制Token**（只显示一次！）

**步骤2：在GADA中配置Token**
1. GADA左侧菜单 → "🔒 私有仓库"
2. 点击"添加Token"
3. 名称随意，如"我的GitHub"
4. 粘贴刚才复制的Token
5. 点击"保存"

**步骤3：验证Token**
1. 点击"验证"按钮
2. ✅ 看到"验证成功"即可

**步骤4：部署私有仓库**
1. 像公开仓库一样粘贴链接
2. 系统会自动使用Token克隆
3. 如果还不行，点击"重新验证"

### ❓ 问题6：Webhook收不到请求，代码更新不自动部署

**可能原因**：
1. GADA服务器没有公网IP（家用宽带通常没有）
2. 防火墙阻止了Webhook请求
3. GitHub Webhook配置错误

**解决方案**：

**方案1：使用内网穿透（推荐给家用宽带）**
1. 使用工具如：frp、ngrok、花生壳
2. 将本地3456端口映射到公网
3. 用公网地址配置Webhook

**方案2：手动触发更新**
1. 放弃Webhook，改为手动更新
2. 代码更新后，在GADA中点击"🔔 检测更新"
3. 点击"更新"按钮

**方案3：检查GitHub配置**
1. 到GitHub仓库 → Settings → Webhooks
2. 查看"Recent Deliveries"
3. 看错误信息，根据提示修复

**方案4：使用GitHub Actions替代**
```yaml
# 在项目根目录创建 .github/workflows/deploy.yml
name: Deploy via GADA
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger GADA Webhook
        run: |
          curl -X POST https://你的公网IP:3456/api/webhookx \
            -H "Content-Type: application/json" \
            -d '{"ref":"refs/heads/main","repository":{"full_name":"你的用户名/仓库名"}}'
```

### ❓ 问题7：忘记AI Key了，或想换AI提供商

**解决**：
1. 点击"🤖 AI设置"
2. 直接修改API Key
3. 点击"保存"
4. Key保存在`.env`文件里，不会在页面上显示

**找到已保存的Key**：
```bash
# 查看 .env 文件
cat .env | grep API_KEY
```

### ❓ 问题8：想卸载GADA，怎么彻底清理？

**完全卸载步骤**：

**步骤1：停止GADA**
- 在终端按`Ctrl+C`
- 确保没有Node.js进程在运行

**步骤2：删除项目文件夹**
```bash
# 进入上级目录
cd ..

# 删除GADA文件夹
# Windows
rmdir /s github-deploy-assistant

# Mac/Linux
rm -rf github-deploy-assistant
```

**步骤3：清理数据（可选）**
```bash
# 删除工作目录（你部署的项目）
rm -rf workspace

# 删除日志
rm -rf logs

# 删除数据库
rm -rf database
```

**步骤4：卸载Node.js和Git（如果不想要了）**
- **Windows**：控制面板 → 程序和功能 → 卸载Node.js和Git
- **Mac**：`brew uninstall node git`
- **Linux**：`sudo apt remove nodejs npm git`

---

## 🛠️ 系统要求

### 💻 最低配置
| 项目 | 要求 | 说明 |
|------|------|------|
| **操作系统** | Windows 10 / macOS 10.15+ / Ubuntu 18.04+ | 主流系统都可以 |
| **Node.js** | ≥18.0.0 | [下载地址](https://nodejs.org/) |
| **npm** | ≥8.0.0 | 随Node.js附带 |
| **Git** | ≥2.x | [下载地址](https://git-scm.com/) |
| **内存** | 512 MB | 运行GADA本身需要 |
| **磁盘空间** | 200 MB | 不含部署的项目 |

### 💪 推荐配置
| 项目 | 推荐 | 为什么 |
|------|------|--------|
| **操作系统** | 最新版本 | 兼容性更好 |
| **Node.js** | LTS版本 | 更稳定 |
| **内存** | 2 GB+ | 能同时运行多个项目 |
| **磁盘空间** | 10 GB+ | 可以部署更多项目 |
| **网络** | 稳定宽带 | 下载项目更快 |

### 📱 支持平台
- ✅ **Windows**：10、11（推荐）
- ✅ **macOS**：10.15及以上
- ✅ **Linux**：Ubuntu、Debian、CentOS、Fedora等
- ✅ **树莓派**：Raspberry Pi OS（远程部署）
- ⚠️ **Android/iOS**：不支持（需要电脑）

---

## 🤝 参与贡献（给开发者）

### 🎉 感谢你想贡献代码！

### 🔧 开发环境搭建
```bash
# 1. 克隆项目
git clone https://gitee.com/kai0339/github-deploy-assistant.git
cd github-deploy-assistant

# 2. 安装依赖
npm install

# 3. 复制环境配置
cp .env.example .env

# 4. 启动开发服务器（修改代码自动重载）
npm run dev

# 5. 访问 http://localhost:3456
```

### 🧪 运行测试
```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e

# 查看测试覆盖率
npm run test:coverage
```

### 📝 代码规范
```bash
# 代码检查
npm run lint

# 自动修复代码格式
npm run lint:fix

# 代码格式化
npm run format
```

### 📋 提交规范
请使用以下格式提交代码：

```
feat: 添加新功能
fix: 修复Bug
docs: 文档更新
style: 样式调整
refactor: 代码重构
perf: 性能优化
test: 测试相关
chore: 构建/工具变更
```

示例：
```
feat: 添加一键回滚功能
fix: 修复端口占用检测逻辑
docs: 更新README安装步骤
```

### 🎯 常见贡献方向
1. **支持更多项目类型**：识别更多框架和语言
2. **改进AI提示词**：让AI分析更准确
3. **Windows优化**：完善一键安装脚本
4. **UI改进**：让界面更友好
5. **性能优化**：加快部署速度
6. **错误处理**：更友好的错误提示
7. **文档翻译**：完善英文文档

### 📬 提交流程
1. **Fork项目**：在Gitee上点击Fork
2. **创建分支**：`git checkout -b feature/你的功能`
3. **提交代码**：`git commit -m "feat: 描述你的功能"`
4. **推送分支**：`git push origin feature/你的功能`
5. **创建PR**：到Gitee创建Pull Request

### 🐛 报告问题
如果你发现Bug或有建议：
1. 到 [Issues页面](https://gitee.com/kai0339/github-deploy-assistant/issues)
2. 点击"新建Issue"
3. 描述清楚问题，最好附上截图
4. 我们会尽快回复

---

## 📄 许可证

MIT License © 2026 GitHub Deploy Assistant

**简单理解**：你可以免费使用、修改、分发这个软件，但需要保留原作者的版权声明。

---

## 📞 支持与反馈

### 🆘 遇到问题怎么办？
1. **先看常见问题**：上面可能已经有解决方案
2. **查看日志**：在GADA界面点击"📄 日志浏览"
3. **问AI**：点击"💬 问AI"让AI帮忙
4. **搜索Issues**：看是否有人遇到相同问题
5. **提交新Issue**：如果都没解决

### 📮 联系方式
- **Gitee Issues**：[提交问题](https://gitee.com/kai0339/github-deploy-assistant/issues)
- **邮箱**：19106440339@163.com
- **GitHub**：https://github.com/4129163/github-deploy-assistant

### 💬 社区交流
如果你有：
- ✅ 成功部署的经验分享
- ✅ 改进建议
- ✅ 使用教程
- ✅ 遇到的问题和解决方案

欢迎在Issues中分享！

---

## 🙏 致谢

感谢所有让这个项目变得更好的人：

### 🤝 贡献者
- 所有提交代码的开发者
- 所有报告问题的用户
- 所有提出建议的朋友

### 🧠 AI提供商
- **OpenAI**：提供强大的GPT模型
- **DeepSeek**：国内可用的优秀AI
- **Google Gemini**：慷慨的免费额度
- **Anthropic Claude**：清晰的逻辑分析
- **月之暗面**：优秀的中文理解
- **通义千问**：阿里云的AI服务
- **智谱GLM**：国产AI的优秀代表

### 🌐 平台支持
- **GitHub**：代码托管和开源社区
- **Gitee**：国内镜像和加速
- **Node.js**：强大的JavaScript运行时
- **npm**：丰富的包生态系统

### 👥 用户感谢
特别感谢所有测试用户和反馈者，你们的每一条建议都让GADA变得更好！

---

## 🚀 下一步做什么？

### 👶 如果你是小白用户：
1. ✅ **已完成**：阅读了这个超详细README
2. 👉 **下一步**：按照"快速开始"安装软件
3. 🎯 **目标**：在30分钟内部署你的第一个项目
4. 💪 **挑战**：尝试部署不同类型的项目
5. 📚 **学习**：遇到问题自己尝试解决，实在不行再问

### 🧑‍💻 如果你已经安装成功：
1. 👉 **试试这些功能**：
   - 部署一个React项目
   - 部署一个Python项目
   - 尝试远程部署到其他电脑
   - 设置Webhook自动更新
2. 📖 **深入学习**：
   - 了解环境变量配置
   - 学习如何使用AI诊断
   - 掌握备份和回滚
3. 🤝 **帮助他人**：
   - 分享你的使用经验
   - 帮助遇到问题的新手
   - 提出改进建议

### 👨‍💻 如果你是开发者：
1. 👨‍💻 **贡献代码**：查看贡献指南，修复Bug或添加功能
2. 🔧 **扩展功能**：添加对新框架的支持
3. 🐛 **报告问题**：遇到Bug及时报告
4. 📚 **完善文档**：帮助改进文档和教程
5. 🌍 **推广分享**：让更多人知道这个工具

---

## 📅 最后更新
**最后更新：2026年4月5日**
**版本：2.0.0-i18n**

---

<p align="center">
  <strong>祝你使用愉快！😊</strong><br>
  <em>如果有任何问题，随时提问，我会尽力帮你解决。</em>
</p>

<p align="center">
  <sub>Made with ❤️ for everyone who wants to deploy GitHub projects easily.</sub>
</p>