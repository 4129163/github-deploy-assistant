# 浏览器扩展安装指南

## 系统要求

### 软件要求
1. **Node.js** 18.0.0 或更高版本
2. **npm** 或 **yarn** 包管理器
3. **Git** 客户端
4. **Chrome 88+** 或 **Firefox 89+** 浏览器

### 硬件要求
- 至少 2GB 空闲内存
- 至少 500MB 可用磁盘空间
- 稳定的网络连接

## 安装步骤

### 步骤1: 安装GADA本地服务

1. **克隆仓库**
   ```bash
   git clone https://gitee.com/kai0339/github-deploy-assistant.git
   cd github-deploy-assistant
   ```

2. **安装依赖**
   ```bash
   npm install
   # 或
   yarn install
   ```

3. **启动本地服务**
   ```bash
   npm start
   # 或
   yarn start
   ```

4. **验证服务运行**
   打开浏览器访问: http://localhost:3000/api/health
   应该看到类似以下响应:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-04-05T08:14:48Z",
     "uptime": 123.45
   }
   ```

### 步骤2: 安装浏览器扩展

#### Chrome 安装方法

**方法A: 开发模式安装（推荐测试）**

1. 打开 Chrome，进入扩展管理页面:
   - 地址栏输入: `chrome://extensions/`
   - 或点击菜单 → 更多工具 → 扩展程序

2. 开启右上角的 **"开发者模式"** 开关

3. 点击 **"加载已解压的扩展程序"** 按钮

4. 选择以下目录:
   ```
   github-deploy-assistant/browser-extension/chrome
   ```

5. 扩展安装完成，您会看到 GADA 图标

**方法B: 打包安装**

1. 打包扩展:
   ```bash
   cd github-deploy-assistant/browser-extension
   zip -r gada-chrome.zip chrome/
   ```

2. 在 Chrome 扩展管理页面，拖放 `gada-chrome.zip` 文件到页面

#### Firefox 安装方法

**方法A: 临时安装（推荐测试）**

1. 打开 Firefox，进入附加组件管理页面:
   - 地址栏输入: `about:addons`
   - 或点击菜单 → 附加组件和主题

2. 点击右上角的齿轮图标，选择 **"调试附加组件"**

3. 点击 **"临时载入附加组件"** 按钮

4. 选择以下文件:
   ```
   github-deploy-assistant/browser-extension/firefox/manifest.json
   ```

5. 扩展安装完成，您会看到 GADA 图标

**方法B: 打包安装**

1. 打包扩展:
   ```bash
   cd github-deploy-assistant/browser-extension/firefox
   zip -r gada-firefox.zip .
   ```

2. 将 `.zip` 文件重命名为 `.xpi`:
   ```bash
   mv gada-firefox.zip gada-firefox.xpi
   ```

3. 在 Firefox 中打开 `about:addons`，拖放 `.xpi` 文件到页面

### 步骤3: 配置扩展

1. **点击扩展图标**，打开弹出窗口

2. **检查服务状态**:
   - 绿色: 服务在线 ✓
   - 红色: 服务离线 ✗

3. **配置设置**（可选）:
   - 点击扩展图标 → 扩展设置
   - 修改服务地址（如果不是默认的 localhost:3000）
   - 配置通知和日志选项

## 使用方法

### 基本使用流程

1. **访问仓库页面**
   - 打开 GitHub (github.com) 或 Gitee (gitee.com)
   - 导航到任意仓库页面

2. **识别扩展按钮**
   - 在仓库标题旁边会显示 **"通过 GADA 一键部署"** 按钮
   - 按钮样式与平台原生界面融合

3. **点击部署**
   - 点击按钮开始部署
   - 扩展会显示连接状态
   - 部署请求发送到本地 GADA 服务

4. **查看结果**
   - 本地 GADA 服务开始处理部署
   - 可以在浏览器中查看部署状态
   - 在 GADA Web 界面中查看详细日志

### 功能演示

#### 示例1: 部署GitHub仓库
1. 访问: https://github.com/expressjs/express
2. 点击仓库标题旁边的 GADA 按钮
3. 确认部署，等待完成

#### 示例2: 部署Gitee仓库
1. 访问: https://gitee.com/openharmony/docs
2. 点击仓库标题旁边的 GADA 按钮
3. 确认部署，等待完成

### 高级功能

#### 1. 批量部署
- 可以同时打开多个仓库标签页
- 每个页面都有独立的部署按钮
- 支持并行部署多个项目

#### 2. 部署历史
- 在扩展设置中查看部署历史
- 查看每个部署的状态和结果
- 重新部署历史项目

#### 3. 自定义配置
- 修改默认部署参数
- 配置环境变量
- 设置部署目标路径

## 故障排除

### 常见问题

#### 问题1: 扩展按钮不显示
**可能原因:**
1. 不在支持的仓库页面
2. 扩展未正确安装
3. 页面加载问题

**解决方案:**
1. 确认访问的是 GitHub/Gitee 仓库页面
2. 检查扩展管理页面，确保扩展已启用
3. 刷新页面 (F5)
4. 检查浏览器控制台错误

#### 问题2: 连接本地服务失败
**可能原因:**
1. GADA 服务未启动
2. 端口被占用
3. 防火墙阻止

**解决方案:**
1. 启动 GADA 服务: `npm start`
2. 检查端口: `netstat -an | grep 3000`
3. 修改服务地址:
   - 点击扩展图标 → 扩展设置
   - 修改服务地址为实际运行地址

#### 问题3: 部署失败
**可能原因:**
1. 网络问题
2. 仓库权限问题
3. 本地环境问题

**解决方案:**
1. 检查网络连接
2. 确认仓库是公开的
3. 查看 GADA 服务日志
4. 检查本地环境依赖

### 调试方法

#### Chrome 调试
```bash
# 1. 打开扩展管理页面
chrome://extensions/

# 2. 点击扩展的"服务人员"链接

# 3. 使用开发者工具调试
#    - 控制台: 查看日志
#    - 网络: 查看请求
#    - 应用: 查看存储
```

#### Firefox 调试
```bash
# 1. 打开附加组件调试页面
about:debugging#/runtime/this-firefox

# 2. 找到 GADA 扩展，点击"检查"

# 3. 使用浏览器工具箱调试
```

#### 查看日志
```bash
# GADA 服务日志
npm start  # 查看控制台输出

# 浏览器扩展日志
# 在浏览器开发者工具的控制台中查看
```

## 更新和升级

### 更新浏览器扩展
1. 下载最新版本的扩展文件
2. 在扩展管理页面移除旧版本
3. 安装新版本

### 更新本地服务
```bash
# 进入项目目录
cd github-deploy-assistant

# 拉取最新代码
git pull

# 更新依赖
npm install

# 重启服务
npm restart
```

## 安全注意事项

### 权限说明
浏览器扩展需要以下权限:
- **activeTab**: 访问当前标签页内容
- **storage**: 保存扩展设置
- **localhost访问**: 连接本地 GADA 服务
- **GitHub/Gitee访问**: 识别仓库页面

### 数据安全
- 扩展不收集用户数据
- 所有数据存储在本地
- 部署信息仅发送到本地服务
- 不记录敏感信息

### 网络安全
- 只允许本地连接
- 使用 CORS 保护 API
- 验证所有输入数据
- 防止跨站脚本攻击

## 技术支持

### 获取帮助
- **文档**: 查看项目 README.md
- **问题**: 访问 Gitee Issues
- **讨论**: 加入项目讨论区

### 报告问题
遇到问题时，请提供:
1. 浏览器版本
2. 扩展版本
3. 错误信息
4. 重现步骤
5. 控制台日志

### 贡献代码
欢迎贡献代码和改进:
1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证
本浏览器扩展遵循 MIT 许可证。详见 [LICENSE](../LICENSE) 文件。

---

**注意**: 本扩展是 GADA 项目的一部分，需要与本地 GADA 服务配合使用。确保本地服务正常运行后再使用扩展功能。