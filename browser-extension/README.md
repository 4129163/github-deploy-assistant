# GADA 浏览器扩展

GitHub Deploy Assistant (GADA) 的浏览器扩展，可在 GitHub/Gitee 仓库页面添加一键部署按钮。

## 功能特性

- 🚀 **一键部署**：在仓库页面点击按钮即可部署到本地
- 🔌 **自动连接**：自动检测并连接本地 GADA 服务
- 🎯 **智能识别**：自动识别 GitHub/Gitee 仓库页面
- 🎨 **原生集成**：按钮样式与平台原生界面完美融合
- 📱 **响应式设计**：适配各种屏幕尺寸
- 🌙 **暗色模式**：支持系统暗色模式
- 🔧 **可配置**：提供丰富的设置选项

## 支持平台

### 浏览器
- ✅ Google Chrome (88+)
- ✅ Mozilla Firefox (89+)
- ⏳ Microsoft Edge (Chromium版)
- ⏳ Safari (计划中)

### 代码托管平台
- ✅ GitHub.com
- ✅ Gitee.com
- ⏳ GitLab.com (计划中)
- ⏳ Bitbucket (计划中)

## 安装方法

### 从源码安装

#### Chrome 安装步骤：
1. 克隆或下载本仓库
2. 打开 Chrome，进入扩展管理页面 (`chrome://extensions/`)
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `browser-extension/chrome` 目录
6. 扩展安装完成

#### Firefox 安装步骤：
1. 克隆或下载本仓库
2. 打开 Firefox，进入扩展管理页面 (`about:addons`)
3. 点击右上角的设置图标，选择"调试附加组件"
4. 点击"临时载入附加组件"
5. 选择 `browser-extension/firefox/manifest.json` 文件
6. 扩展安装完成

### 从商店安装（计划中）
- Chrome Web Store: 待发布
- Firefox Add-ons: 待发布
- Edge Add-ons: 待发布

## 使用方法

### 基本使用
1. 确保本地已安装并运行 GADA 服务（默认端口 3000）
2. 访问任意 GitHub 或 Gitee 仓库页面
3. 在页面顶部会看到"通过 GADA 一键部署"按钮
4. 点击按钮即可开始部署

### 扩展图标
- **绿色**：本地服务在线，可以部署
- **红色**：本地服务离线，需要启动服务
- **黄色**：正在检测服务状态

### 弹出窗口
点击扩展图标可以打开弹出窗口，功能包括：
- 查看当前仓库信息
- 检查服务状态
- 手动触发部署
- 快速设置

## 配置选项

### 本地服务地址
默认：`http://localhost:3000`
如果您的 GADA 服务运行在其他地址或端口，需要相应修改。

### 连接设置
- **自动检测服务**：定期检查本地服务状态
- **显示通知**：部署过程中显示桌面通知
- **启用日志**：启用详细日志记录（开发用）

### 高级设置
- **最大重试次数**：连接失败时的重试次数
- **连接超时**：请求超时时间（毫秒）
- **API 端点**：自定义 API 端点路径

## 开发指南

### 项目结构
```
browser-extension/
├── chrome/              # Chrome扩展专用
│   ├── manifest.json   # 扩展清单
│   └── icons/          # 图标文件
├── firefox/            # Firefox扩展专用
│   ├── manifest.json   # 扩展清单
│   └── icons/          # 图标文件
├── shared/             # 共享代码
│   ├── scripts/        # JavaScript代码
│   │   ├── content.js  # 内容脚本（页面注入）
│   │   ├── background.js # 背景脚本
│   │   └── utils.js    # 工具函数
│   ├── styles/         # 样式文件
│   │   └── inject.css  # 注入页面的样式
│   ├── popup.html      # 弹出窗口
│   ├── options.html    # 设置页面
│   └── locales/        # 多语言文件
├── ARCHITECTURE.md     # 架构设计文档
├── README.md          # 使用说明
└── package.json       # 项目配置
```

### 构建脚本
```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 构建生产版本
npm run build

# 打包扩展
npm run package

# 代码检查
npm run lint

# 运行测试
npm run test
```

### API 接口

#### 本地服务端点
扩展与本地 GADA 服务通过以下端点通信：

1. **健康检查**：`GET /api/health`
2. **部署请求**：`POST /api/browser/deploy`
3. **状态查询**：`GET /api/deployments/{id}`

#### 部署请求格式
```json
{
  "repositoryUrl": "https://github.com/username/repo",
  "action": "deploy",
  "timestamp": "2024-01-01T12:00:00Z",
  "source": "browser-extension",
  "repositoryInfo": {
    "platform": "github",
    "owner": "username",
    "repo": "repo",
    "fullName": "username/repo"
  }
}
```

### 添加新平台支持

1. 在 `content.js` 中修改 `isRepositoryPage()` 方法
2. 在 `findInjectionPoint()` 中添加新的平台选择器
3. 更新 `manifest.json` 中的 `matches` 字段
4. 添加平台特定的样式适配

## 故障排除

### 常见问题

#### 1. 按钮不显示
- 检查是否在 GitHub/Gitee 仓库页面
- 检查扩展是否已启用
- 查看浏览器控制台是否有错误

#### 2. 连接本地服务失败
- 确保 GADA 服务正在运行：`npm start`
- 检查服务地址是否正确
- 检查防火墙设置，确保端口 3000 可访问

#### 3. 部署失败
- 检查网络连接
- 查看 GADA 服务日志
- 确保有足够的系统权限

#### 4. 样式不正常
- 清除浏览器缓存
- 重新加载扩展
- 检查是否有其他扩展冲突

### 调试方法

#### Chrome 调试：
1. 右键点击扩展图标，选择"检查弹出内容"
2. 在扩展管理页面点击"服务人员"链接
3. 使用 Chrome DevTools 查看控制台

#### Firefox 调试：
1. 打开扩展调试页面 (`about:debugging#/runtime/this-firefox`)
2. 找到 GADA 扩展，点击"检查"
3. 使用浏览器工具箱进行调试

### 日志查看
- 扩展日志：浏览器控制台
- 本地服务日志：GADA 服务控制台
- 网络请求：浏览器网络面板

## 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发规范
- 使用 ES6+ 语法
- 遵循现有的代码风格
- 添加必要的注释
- 更新相关文档
- 编写测试用例

### 提交信息格式
```
类型(范围): 描述

详细说明（可选）

相关issue: #123
```

类型包括：feat, fix, docs, style, refactor, test, chore

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 联系与支持

- 项目主页：https://gitee.com/kai0339/github-deploy-assistant
- 问题反馈：https://gitee.com/kai0339/github-deploy-assistant/issues
- 作者邮箱：19106440339@163.com
- 作者 Gitee：@kai0339

## 更新日志

### v1.0.0 (2026-04-05)
- 🎉 初始版本发布
- ✨ 支持 Chrome 和 Firefox
- 🚀 GitHub/Gitee 一键部署
- 🔧 完整的设置页面
- 📱 响应式设计
- 🌙 暗色模式支持
- 📖 详细文档

### 计划功能
- [ ] 支持更多代码托管平台
- [ ] 浏览器商店发布
- [ ] 部署历史记录
- [ ] 批量部署功能
- [ ] 团队协作支持
- [ ] 离线模式
- [ ] 性能优化
- [ ] 单元测试覆盖