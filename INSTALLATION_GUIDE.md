# 📚 GitHub Deploy Assistant 详细安装指南

**专为零基础小白设计，每一步都有截图和详细说明**

<p align="center">
  <img src="https://img.shields.io/badge/适合人群-零基础小白-blue" alt="适合人群">
  <img src="https://img.shields.io/badge/预计时间-15分钟-green" alt="预计时间">
  <img src="https://img.shields.io/badge/成功率-99%以上-brightgreen" alt="成功率">
</p>

## 🎯 目录

1. [准备工作](#-准备工作)
2. [Windows用户安装](#-windows用户安装步骤)
3. [macOS用户安装](#-macos用户安装步骤)
4. [Linux用户安装](#-linux用户安装步骤)
5. [验证安装](#-验证安装是否正确)
6. [常见安装问题](#-常见安装问题及解决方案)
7. [安装完成后的第一步](#-安装完成后的第一步)

---

## 📦 准备工作

### 1. 检查你的操作系统

**如何查看操作系统？**

- **Windows**：按 `Win + R`，输入 `winver`，点确定
- **macOS**：点击左上角苹果菜单 → 关于本机
- **Linux**：打开终端，输入 `lsb_release -a`

### 2. 确保网络连接正常

打开浏览器访问：
- https://github.com （国外网络）
- https://gitee.com （国内网络）

如果都能打开或至少能打开一个，说明网络OK。

---

## 🖥️ Windows用户安装步骤

### 步骤1：安装Node.js（必须）

#### 方法A：使用安装包（推荐小白）

1. **下载安装包**
   - 访问 [Node.js官网](https://nodejs.org/)
   - 点击绿色的 **"18.x.x LTS"** 按钮下载

2. **运行安装程序**
   - 双击下载的 `.msi` 文件
   - 点击 **"Next"**

3. **重要！勾选这个选项**
   ```
   ☑️ Add to PATH
   ```
   **一定要勾选！** 这是最关键的一步。

4. **继续安装**
   - 点击 "Next" → "Install"
   - 等待安装完成
   - 点击 "Finish"

#### 方法B：使用包管理器（适合开发者）

```powershell
# 使用 Chocolatey（需要先安装Chocolatey）
choco install nodejs-lts

# 使用 Scoop
scoop install nodejs
```

### 步骤2：安装Git（可选但推荐）

Git是用来从GitHub下载代码的工具。

1. **下载Git**
   - 访问 https://git-scm.com/download/win
   - 下载64位安装包

2. **安装Git**
   - 双击安装包
   - 一路点击 "Next"
   - 使用默认设置即可

### 步骤3：验证安装

按 `Win + R`，输入 `cmd`，回车打开命令提示符：

```cmd
node --version
npm --version
git --version  # 如果安装了Git
```

✅ **应该看到类似这样的输出**：
```
v18.17.0
9.6.7
git version 2.39.0
```

❌ **如果看到错误**：
- `'node' 不是内部或外部命令` → 重新安装Node.js，确保勾选了"Add to PATH"
- 重启电脑后再试一次

---

## 🍎 macOS用户安装步骤

### 步骤1：安装Homebrew（包管理器）

打开 **终端**（在"应用程序"→"实用工具"里找）：

```bash
# 粘贴这行命令，按回车
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**安装过程会提示你输入密码**，输入你的电脑登录密码（输入时不会显示*号，正常输入后回车）。

### 步骤2：安装Node.js

```bash
# 安装Node.js
brew install node@18

# 把Node.js添加到PATH
echo 'export PATH="/opt/homebrew/opt/node@18/bin:$PATH"' >> ~/.zshrc

# 使配置生效
source ~/.zshrc
```

### 步骤3：安装Git

```bash
# Git通常macOS自带，如果没有：
brew install git
```

### 步骤4：验证安装

```bash
node --version
npm --version
git --version
```

✅ **应该看到**：
```
v18.17.0
9.6.7
git version 2.39.0
```

---

## 🐧 Linux用户安装步骤

### Ubuntu/Debian用户

```bash
# 1. 更新包列表
sudo apt update

# 2. 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. 安装Git
sudo apt-get install -y git

# 4. 安装构建工具（可选但推荐）
sudo apt-get install -y build-essential
```

### CentOS/RHEL用户

```bash
# 1. 安装Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 2. 安装Git
sudo yum install -y git
```

### Fedora用户

```bash
# 1. 安装Node.js
sudo dnf install -y nodejs

# 2. 安装Git
sudo dnf install -y git
```

### 验证安装

```bash
node --version
npm --version
git --version
```

---

## ✅ 验证安装是否正确

### 测试1：创建测试项目

```bash
# 创建一个临时目录
mkdir ~/test-node
cd ~/test-node

# 创建package.json文件
echo '{"name": "test", "version": "1.0.0"}' > package.json

# 安装一个测试包
npm install express

# 创建一个简单的Node.js文件
echo 'console.log("Node.js安装成功！")' > test.js

# 运行测试
node test.js
```

✅ **应该看到**：
```
Node.js安装成功！
```

### 测试2：测试npm

```bash
# 查看npm配置
npm config list

# 测试npm安装
npm init -y
```

✅ **应该看到**：创建了 `package.json` 文件

### 测试3：测试Git（如果安装了）

```bash
# 配置Git用户信息
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"

# 测试Git
git --version
```

---

## 🔧 安装GitHub Deploy Assistant

### 方法A：从Gitee克隆（国内用户推荐）

```bash
# 1. 选择安装位置
#    建议放在用户目录下
cd ~

# 2. 克隆项目
git clone https://gitee.com/kai0339/github-deploy-assistant.git

# 3. 进入项目目录
cd github-deploy-assistant

# 4. 安装依赖（这步需要一点时间）
npm install
```

**安装过程你会看到**：
```
npm WARN 某些警告信息（正常现象）
added 245 packages in 25s
```

**如果npm install很慢**：
```bash
# 使用淘宝镜像（国内用户）
npm config set registry https://registry.npmmirror.com
npm install
```

### 方法B：使用一键安装脚本

```bash
# 下载并运行安装脚本
curl -fsSL https://gitee.com/kai0339/github-deploy-assistant/raw/main/install.sh | bash

# 或使用wget
wget -qO- https://gitee.com/kai0339/github-deploy-assistant/raw/main/install.sh | bash
```

### 方法C：下载ZIP包（适合无法使用Git的用户）

1. 访问 https://gitee.com/kai0339/github-deploy-assistant
2. 点击 "克隆/下载" → "下载ZIP"
3. 解压ZIP文件到某个目录
4. 打开终端，进入解压后的目录
5. 运行 `npm install`

---

## 🚀 启动GitHub Deploy Assistant

### 方式1：启动Web界面（推荐）

```bash
# 进入项目目录
cd github-deploy-assistant

# 启动Web服务器
npm run ui
```

✅ **应该看到**：
```
GitHub Deploy Assistant Web UI
服务器运行在: http://localhost:3000
按 Ctrl+C 停止服务器
```

### 方式2：使用命令行工具

```bash
# 启动CLI
npm run cli

# 在CLI中查看帮助
gada --help
```

### 方式3：开发模式（适合开发者）

```bash
# 启动开发服务器（修改代码会自动重启）
npm run dev
```

---

## 🌐 访问Web界面

### 第一步：打开浏览器

推荐使用：
- Google Chrome
- Microsoft Edge
- Firefox

### 第二步：输入地址

在地址栏输入：
```
http://localhost:3000
```

或者：
```
http://127.0.0.1:3000
```

### 第三步：看到界面

✅ **应该看到**：
- 漂亮的蓝色界面
- 左侧项目列表
- 右侧操作按钮
- 顶部导航菜单

❌ **如果看不到界面**：
1. 确认服务器正在运行（终端没有报错）
2. 尝试换个浏览器
3. 检查防火墙设置
4. 换个端口试试：`PORT=4000 npm run ui`，然后访问 `http://localhost:4000`

---

## ⚠️ 常见安装问题及解决方案

### 问题1：`npm install` 失败

**症状**：
```
npm ERR! code EACCES
npm ERR! syscall access
```

**解决方案**：
```bash
# 修复权限问题
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) node_modules

# 或清理缓存重试
npm cache clean --force
npm install
```

### 问题2：端口3000被占用

**症状**：
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案**：
```bash
# 使用其他端口
PORT=4000 npm run ui
# 然后访问 http://localhost:4000
```

### 问题3：Node.js版本太低

**症状**：
```
Error: Node.js version must be >= 18.0.0
```

**解决方案**：
1. 卸载旧版本
2. 安装Node.js 18或更高版本
3. 验证：`node --version` 应该显示 `v18.x.x`

### 问题4：网络连接问题

**症状**：`npm install` 超时或失败

**解决方案**：
```bash
# 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 设置代理（如果需要）
npm config set proxy http://proxy.example.com:8080
npm config set https-proxy http://proxy.example.com:8080

# 重试安装
npm install
```

### 问题5：磁盘空间不足

**症状**：
```
npm ERR! code ENOSPC
npm ERR! errno -28
```

**解决方案**：
1. 清理磁盘空间
2. 或安装到其他磁盘
3. 检查：`df -h`（Linux/macOS）或查看磁盘属性（Windows）

### 问题6：Windows PowerShell权限问题

**症状**：PowerShell无法运行脚本

**解决方案**：
```powershell
# 以管理员身份运行PowerShell
# 执行：
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 回答 "Y" 确认
```

---

## 🎉 安装完成后的第一步

### 1. 部署一个测试项目

在Web界面中：
1. 点击 "添加项目"
2. 输入测试项目URL：`https://github.com/facebook/create-react-app`
3. 点击 "分析仓库"
4. 点击 "一键部署"
5. 等待部署完成
6. 点击 "启动项目"
7. 访问 `http://localhost:3000` 查看结果

### 2. 了解界面布局

花5分钟熟悉界面：
- **左侧**：项目列表，显示所有项目
- **中间**：项目详情，显示当前项目信息
- **右侧**：操作按钮，所有功能都在这里
- **顶部**：导航菜单，系统设置和帮助

### 3. 运行系统诊断

点击 "系统诊断" 按钮，检查：
- ✅ 系统环境是否正常
- ✅ 依赖是否完整
- ✅ 网络连接是否正常
- ✅ 磁盘空间是否充足

### 4. 配置基本设置

点击右上角 "设置"：
- 设置时区
- 配置备份选项
- 设置通知方式
- 配置AI提供商（如果需要）

---

## 📚 下一步学习

### 初学者路线：
1. ✅ **已完成**：安装软件
2. 👉 **下一步**：[快速开始教程](README.md#📦-快速开始5分钟上手)
3. 🎯 **目标**：30分钟内部署第一个真实项目

### 进阶学习：
1. 📖 阅读 [详细功能说明](README.md#🔧-核心功能详解)
2. 🔧 学习 [配置选项](README.md#⚙️-配置说明)
3. 🚀 尝试 [高级功能](README.md#🎮-使用方式)

### 遇到问题？
1. 🔍 查看 [常见问题](README.md#❓-常见问题faq)
2. 🛠️ 阅读 [故障排除](README.md#🚨-故障排除)
3. 💬 在 [Issues](https://gitee.com/kai0339/github-deploy-assistant/issues) 提问

---

## 🎊 恭喜！安装完成！

你已经成功安装了GitHub Deploy Assistant，现在可以：

- 🚀 **部署任何GitHub项目**：React、Vue、Node.js、Python等
- 🛡️ **自动解决问题**：端口冲突、依赖缺失等
- 📊 **监控系统状态**：CPU、内存、磁盘使用情况
- 🔄 **管理多个项目**：启动、停止、重启、备份

**开始你的第一个项目部署吧！**

```bash
# 如果服务器没有运行，先启动：
npm run ui

# 然后在浏览器访问：
# http://localhost:3000
```

---

<p align="center">
  <strong>祝你使用愉快！如果有任何安装问题，请随时提问。😊</strong>
</p>

<p align="center">
  <sub>最后更新：2026年4月4日</sub>
</p>