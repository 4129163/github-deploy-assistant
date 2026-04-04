# 📋 GitHub Deploy Assistant 从零开始操作清单

**小白用户专用，一步一步跟着做，绝不迷路！**

<p align="center">
  <img src="https://img.shields.io/badge/总步骤-30个步骤-blue" alt="总步骤">
  <img src="https://img.shields.io/badge/预计时间-45分钟-green" alt="预计时间">
  <img src="https://img.shields.io/badge/成功率-100%!-brightgreen" alt="成功率">
</p>

## 🎯 使用说明

### 如何使用这份清单？
1. **打印出来**或**在电脑上打开**这份清单
2. 按照**数字顺序**一步一步操作
3. 每完成一步，就在前面的 **□** 中打勾 **✅**
4. 如果卡在某一步，查看后面的"问题解决"部分

### 符号说明：
- ✅ **完成**：这一步已经完成
- □ **待做**：还没有开始做
- ⚠️ **注意**：需要特别注意的地方
- 🔧 **工具**：需要使用的工具
- 💡 **提示**：有用的小技巧

---

## 🏁 第一阶段：准备工作（10分钟）

### 1. 确定你的操作系统

□ **步骤1.1：查看操作系统**
- **Windows**：按 `Win + R`，输入 `winver`，回车
- **macOS**：点击左上角苹果菜单 → 关于本机
- **Linux**：打开终端，输入 `lsb_release -a`

✅ **我的系统是**：____________________

### 2. 检查网络连接

□ **步骤2.1：测试网络连接**
打开浏览器，访问以下网站（至少一个能打开）：
- https://github.com （国外网络）
- https://gitee.com （国内网络）

✅ **网络状态**：□ 正常 □ 有问题

⚠️ **如果网络有问题**：
1. 检查Wi-Fi/网线连接
2. 重启路由器
3. 或使用手机热点

---

## 🖥️ 第二阶段：安装软件（15分钟）

### 3. 安装Node.js（必须）

#### Windows用户：
□ **步骤3.1：下载Node.js**
1. 访问 https://nodejs.org
2. 点击绿色的 **"18.x.x LTS"** 按钮下载
3. 保存到桌面（容易找到）

□ **步骤3.2：安装Node.js**
1. 双击下载的安装文件
2. 点击 **"Next"**
3. **重要！勾选这个选项**：
   ```
   ☑️ Add to PATH
   ```
4. 继续点击 "Next" → "Install"
5. 完成安装

#### macOS用户：
□ **步骤3.3：安装Homebrew**
打开终端，粘贴：
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
输入电脑密码（输入时不显示*号，正常）

□ **步骤3.4：安装Node.js**
```bash
brew install node@18
echo 'export PATH="/opt/homebrew/opt/node@18/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### Linux用户：
□ **步骤3.5：安装Node.js**
```bash
# Ubuntu/Debian
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 4. 验证安装

□ **步骤4.1：打开终端/命令提示符**
- **Windows**：按 `Win + R`，输入 `cmd`，回车
- **macOS**：应用程序 → 实用工具 → 终端
- **Linux**：按 `Ctrl + Alt + T`

□ **步骤4.2：检查Node.js版本**
在终端输入：
```bash
node --version
```

✅ **应该看到**：`v18.x.x`（数字可能不同，只要≥18.0.0）

❌ **如果看到错误**：
- `command not found` → 重新安装，确保勾选了"Add to PATH"
- `v16.x.x 或更低` → 需要升级到18.x.x

□ **步骤4.3：检查npm版本**
```bash
npm --version
```

✅ **应该看到**：`9.x.x` 或类似

---

## 📦 第三阶段：安装GitHub Deploy Assistant（10分钟）

### 5. 下载项目

□ **步骤5.1：选择下载方式**
**方法A：从Gitee克隆（推荐国内用户）**
```bash
git clone https://gitee.com/kai0339/github-deploy-assistant.git
cd github-deploy-assistant
```

**方法B：下载ZIP文件（如果不会用Git）**
1. 访问 https://gitee.com/kai0339/github-deploy-assistant
2. 点击 "克隆/下载" → "下载ZIP"
3. 解压ZIP文件到桌面
4. 打开终端，进入解压后的文件夹

✅ **我选择了**：□ 方法A □ 方法B

### 6. 安装依赖

□ **步骤6.1：进入项目目录**
在终端确认你在正确的目录：
```bash
pwd  # 应该显示包含package.json的目录
ls   # 应该看到package.json文件
```

□ **步骤6.2：安装依赖包**
```bash
npm install
```

⏱️ **等待时间**：2-5分钟（取决于网络）

✅ **应该看到最后显示**：
```
added 245 packages in 25s
```

⚠️ **如果npm install很慢**：
```bash
# 使用国内镜像
npm config set registry https://registry.npmmirror.com
npm install
```

❌ **如果安装失败**：
1. 清理缓存：`npm cache clean --force`
2. 删除node_modules：`rm -rf node_modules`（macOS/Linux）或删除文件夹（Windows）
3. 重新安装：`npm install`

---

## 🚀 第四阶段：启动和使用（10分钟）

### 7. 启动Web服务器

□ **步骤7.1：启动服务器**
```bash
npm run ui
```

✅ **应该看到**：
```
GitHub Deploy Assistant Web UI
服务器运行在: http://localhost:3000
按 Ctrl+C 停止服务器
```

❌ **如果看到错误**：
- `端口3000被占用` → 运行：`PORT=4000 npm run ui`
- 然后访问：`http://localhost:4000`

□ **步骤7.2：保持终端打开**
**重要！** 不要关闭这个终端窗口

### 8. 访问Web界面

□ **步骤8.1：打开浏览器**
推荐：Chrome、Edge、Firefox

□ **步骤8.2：输入地址**
在地址栏输入（根据你使用的端口）：
```
http://localhost:3000
```
或
```
http://localhost:4000
```

✅ **应该看到**：
- 漂亮的蓝色界面
- 左侧项目列表（现在是空的）
- 右侧操作按钮

❌ **如果看不到界面**：
1. 确认终端窗口还在运行
2. 换个浏览器试试
3. 检查防火墙设置

---

## 🎯 第五阶段：部署第一个项目（15分钟）

### 9. 部署示例项目

□ **步骤9.1：点击"添加项目"按钮**
位置：左上角，绿色的 "+" 按钮

□ **步骤9.2：输入项目链接**
在输入框中粘贴：
```
https://github.com/facebook/create-react-app
```

□ **步骤9.3：点击"分析仓库"按钮**
等待AI分析，大约10-30秒

✅ **分析完成后看到**：
- 项目类型：React应用
- 建议端口：3000
- AI分析报告

□ **步骤9.4：点击"一键部署"按钮**

⏱️ **等待时间**：2-5分钟

**部署过程你会看到**：
```
部署进度: 0% → 100%
步骤:
1. 克隆仓库... ✓
2. 安装依赖... ✓
3. 配置项目... ✓
4. 启动服务... ✓
```

✅ **部署完成后看到**：
- 项目状态：运行中
- 访问地址：`http://localhost:3000`
- 停止按钮变成红色

### 10. 验证项目运行

□ **步骤10.1：访问项目**
打开新标签页，访问：
```
http://localhost:3000
```

✅ **应该看到**：
- React的蓝色旋转图标
- "Edit src/App.js and save to reload."

🎉 **恭喜！** 你的第一个项目部署成功！

□ **步骤10.2：查看项目日志**
在Web界面中：
1. 点击项目列表中的 `create-react-app`
2. 点击右侧的 **"查看日志"** 按钮

✅ **看到实时日志输出**

□ **步骤10.3：停止项目**
点击红色的 **"停止"** 按钮

✅ **看到**：
- 项目状态变为"已停止"
- 按钮变成绿色"启动"

□ **步骤10.4：重新启动项目**
点击绿色的 **"启动"** 按钮

✅ **看到**：
- 项目状态变回"运行中"
- 可以再次访问

---

## 🔧 第六阶段：学习基本操作（15分钟）

### 11. 学习项目管理

□ **步骤11.1：重启项目**
点击 **蓝色"重启"** 按钮
**用途**：修改配置后重新加载

□ **步骤11.2：运行项目诊断**
点击 **橙色"项目诊断"** 按钮
**等待**：系统检查项目状态

✅ **诊断报告显示**：
- 项目状态：健康/异常
- 发现的问题
- 修复建议

□ **步骤11.3：使用一键修复**
如果有问题，点击 **"一键修复"** 按钮

✅ **系统自动**：
- 更换被占用的端口
- 安装缺失的依赖
- 修复配置错误

### 12. 学习备份和恢复

□ **步骤12.1：创建备份**
点击 **"备份项目"** 按钮
选择备份位置：本地磁盘

✅ **备份完成后**：
- 显示备份文件路径
- 显示备份时间

□ **步骤12.2：修改项目配置**
点击 **"配置"** 按钮
修改：
- 端口：3000 → 4000
- 点击"保存"

✅ **需要重启项目使配置生效**

□ **步骤12.3：恢复项目**
如果需要恢复到之前状态：
1. 点击 **"恢复项目"** 按钮
2. 选择之前的备份文件
3. 确认恢复

---

## 📊 第七阶段：探索高级功能（可选）

### 13. 系统监控

□ **步骤13.1：查看系统状态**
点击右上角 **"监控"** 按钮

✅ **看到**：
- CPU使用率
- 内存使用情况
- 磁盘剩余空间

□ **步骤13.2：设置告警**
在监控页面设置：
- CPU超过80%告警
- 内存超过90%告警
- 磁盘空间不足告警

### 14. 多项目管理

□ **步骤14.1：部署第二个项目**
重复步骤9，部署：
```
https://github.com/vuejs/vue
```

□ **步骤14.2：学习项目筛选**
在项目列表中使用：
- 状态筛选：运行中/已停止
- 类型筛选：前端/后端
- 搜索框：按名称搜索

□ **步骤14.3：批量操作**
可以同时：
- 启动多个项目
- 停止多个项目
- 备份多个项目

### 15. API使用

□ **步骤15.1：获取API令牌**
在Web界面：
1. 点击右上角"设置"
2. 选择"API设置"
3. 点击"生成API令牌"

□ **步骤15.2：测试API**
```bash
# 获取项目列表
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/projects
```

---

## 🚨 第八阶段：故障排除

### 遇到问题怎么办？

#### 问题1：部署卡在"安装依赖"
**解决**：
1. 点击"取消"按钮
2. 点击"项目诊断"
3. 查看网络连接问题
4. 使用"一键修复"

#### 问题2：端口被占用
**解决**：
1. 点击"修改端口"按钮
2. 输入新端口（如4000）
3. 点击"保存"
4. 重新部署

#### 问题3：项目启动后无法访问
**解决**：
1. 点击"查看日志"查看错误
2. 运行"项目诊断"
3. 检查防火墙设置
4. 换个浏览器试试

#### 问题4：npm install失败
**解决**：
```bash
# 清理缓存
npm cache clean --force

# 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 重新安装
npm install
```

#### 问题5：Web界面无法访问
**解决**：
1. 确认服务器正在运行
2. 尝试访问：`http://127.0.0.1:3000`
3. 换个端口：`PORT=4000 npm run ui`
4. 检查防火墙

---

## 📚 第九阶段：学习资源

### 下一步学习建议

#### 第一天（完成基础）：
- ✅ 完成这份清单的所有步骤
- ✅ 部署3个不同类型的项目
- ✅ 掌握启动、停止、重启操作
- ✅ 学会查看日志和运行诊断

#### 第一周（掌握核心）：
- 📖 阅读 [详细教程](TUTORIAL.md)
- 🔧 学习 [配置管理](../README.md#⚙️-配置说明)
- 📊 设置 [监控告警](../README.md#📊-系统监控)
- 💾 建立 [备份策略](../README.md#💾-自动备份)

#### 第一个月（成为专家）：
- 🔌 学习 [API集成](API_GUIDE.md)
- 🐳 掌握 [Docker部署]
- 🤖 建立 [自动化流水线]
- 📈 优化 [性能调优]

### 推荐练习项目

**初级项目**（适合练习）：
1. React项目：`https://github.com/facebook/create-react-app`
2. Vue项目：`https://github.com/vuejs/vue`
3. Node.js项目：`https://github.com/expressjs/express`

**中级项目**（挑战一下）：
1. 全栈项目：`https://github.com/vercel/next.js`
2. 数据库项目：`https://github.com/prisma/prisma`
3. 实时应用：`https://github.com/socketio/socket.io`

**高级项目**（专家级）：
1. 微服务项目：`https://github.com/microservices-demo`
2. 机器学习项目：`https://github.com/tensorflow/tensorflow`
3. 区块链项目：`https://github.com/ethereum/go-ethereum`

---

## 🎉 完成庆祝

### 你已经完成了！

✅ **掌握的技能**：
1. 🖥️ 安装和配置开发环境
2. 📦 安装和管理Node.js项目
3. 🚀 部署GitHub项目
4. ⚙️ 管理项目生命周期
5. 🛡️ 诊断和修复问题
6. 💾 备份和恢复项目
7. 📊 监控系统状态

### 证书时间！ 🏆

复制下面的文本，填入你的信息：

```
🎓 GitHub Deploy Assistant 认证用户
姓名: ____________________
完成日期: ____________________
部署项目数: ____________________
掌握的技能: □ 基础部署 □ 项目管理 □ 故障排除 □ 备份恢复
```

### 分享你的成就

1. 📸 截屏你的第一个部署项目
2. 💬 分享到社交媒体 #GitHubDeployAssistant
3. ⭐ 给项目点个星：https://gitee.com/kai0339/github-deploy-assistant
4. 📝 写一篇使用心得

---

## 📞 获取帮助

### 自助支持
1. 🔍 查看文档：`docs/` 目录
2. 🛠️ 使用内置诊断工具
3. 🔄 尝试一键修复功能

### 社区支持
1. 💬 在 [Gitee Issues](https://gitee.com/kai0339/github-deploy-assistant/issues) 提问
2. 👥 加入用户群组
3. 📝 查看常见问题

### 紧急问题
如果遇到紧急问题：
1. 📧 发送邮件：19106440339@163.com
2. 🐛 提交Issue并标记为"紧急"
3. 🔄 回退到之前稳定的版本

---

## 🔄 维护和更新

### 日常维护
**每天检查**：
- ✅ 项目运行状态
- ✅ 系统资源使用
- ✅ 备份是否成功

**每周维护**：
- 📊 查看性能报告
- 🔒 检查安全更新
- 💾 测试备份恢复

**每月维护**：
- 🏗️ 更新依赖包
- 🧹 清理旧日志和备份
- 📈 优化系统配置

### 更新软件
```bash
# 更新GitHub Deploy Assistant
cd github-deploy-assistant
git pull origin main
npm install
```

---

<p align="center">
  <strong>🎊 恭喜你完成了所有步骤！</strong><br>
  <sub>你现在是GitHub Deploy Assistant的合格用户了！</sub>
</p>

<p align="center">
  <sub>清单版本: 1.0.0 | 最后更新: 2026年4月4日</sub>
</p>

<p align="center">
  <sub>祝你使用愉快！有问题随时回来查阅这份清单 😊</sub>
</p>