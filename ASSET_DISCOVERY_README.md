# 🚀 资产发现功能 - 基于特征和行为的智能检测

## 📋 功能概述

为GitHub部署助手新增的资产发现功能，能够智能检测系统中的非安装式程序、收集设备信息、检查环境健康状态。特别设计让编程小白也能轻松使用和理解。

## ✨ 核心功能

### 1. 🔍 非安装式程序检测
自动检测未通过传统安装方式部署的智能程序，如：
- **OpenClaw/龙虾类程序**: 开源智能体框架
- **AI-Agent程序**: 人工智能助手
- **Web爬虫**: 数据采集程序
- **监控代理**: 系统监控工具
- **自动化脚本**: 定时任务脚本

**检测方式**:
  - 🖥️ 进程扫描: 匹配进程名、命令行参数
  - 📁 目录扫描: 检查特定目录结构
  - 📦 包管理器: 检查pip/npm/docker等安装
  - 🚀 启动项: 检查开机自启服务

### 2. 💻 设备信息收集
全面收集系统硬件和软件信息：

**硬件信息**:
  - CPU: 型号、核心数、负载
  - 内存: 总量、使用率、可用空间
  - 磁盘: 分区、使用率、文件系统
  - 网络: IP地址、接口、连接状态

**软件环境**:
  - 操作系统: 类型、版本、架构
  - 编程语言: Node.js、Python、Java等版本
  - 开发工具: Git、Docker、包管理器
  - 运行时: 环境变量、PATH配置

### 3. 🏥 环境健康状态检查
智能诊断系统健康状况：

**检查项目**:
  - ✅ 系统资源: CPU负载、内存使用
  - ✅ 网络连接: 连通性、DNS配置
  - ✅ 磁盘状态: 空间使用、健康度
  - ✅ 软件环境: 版本兼容性、依赖完整性
  - ✅ 安全配置: 权限设置、防火墙状态
  - ✅ 性能优化: 启动时间、临时文件

**输出结果**:
  - 📊 健康评分: 0-100分直观显示
  - 🏅 健康等级: 优秀/良好/一般/需关注
  - 💡 优化建议: 具体可操作的改进建议

### 4. 🔌 插件式扩展设计
面向未来的可扩展架构：

**核心特性**:
  - 📋 规则管理: JSON/YAML格式的检测规则
  - 🎨 插件系统: 支持自定义检测插件
  - 🔄 动态更新: 无需重启更新检测规则
  - 📤 导入导出: 规则备份和共享

**用户友好**:
  - 🤖 交互式CLI: 命令行工具简单易用
  - 📖 详细文档: 每个功能都有说明
  - 🎯 智能提示: 针对问题给出解决方案
  - 👶 小白友好: 避免技术术语，用通俗语言

## 🚀 快速开始

### 安装与使用

```bash
# 1. 运行资产发现扫描
node src/asset-discovery/cli.js scan

# 2. 检查系统健康状态
node src/asset-discovery/cli.js health

# 3. 查看运行中的程序
node src/asset-discovery/cli.js list

# 4. 管理检测规则
node src/asset-discovery/plugins/rule-manager.js init
```

### 常用命令示例

```bash
# 完整扫描并保存报告
node src/asset-discovery/cli.js scan --json report.json

# 快速扫描（只检查关键项目）
node src/asset-discovery/cli.js scan --quick

# 详细扫描（显示所有信息）
node src/asset-discovery/cli.js scan --verbose

# 只检查设备信息
node src/asset-discovery/cli.js scan --no-process --no-package

# 管理规则
node src/asset-discovery/plugins/rule-manager.js list
node src/asset-discovery/plugins/rule-manager.js add
node src/asset-discovery/plugins/rule-manager.js search "AI"
```

## 📁 目录结构

```
src/asset-discovery/
├── index.js                 # 主模块
├── cli.js                   # 命令行工具
├── detectors/               # 检测器模块
│   ├── process-detector.js  # 进程检测
│   ├── directory-detector.js # 目录检测
│   └── package-detector.js  # 包管理器检测
├── collectors/              # 收集器模块
│   └── device-collector.js  # 设备信息收集
├── health/                  # 健康检查
│   └── health-checker.js    # 健康状态检测
├── plugins/                 # 插件系统
│   ├── plugin-manager.js    # 插件管理器
│   └── rule-manager.js      # 规则管理器CLI
└── rules/                   # 检测规则
    ├── builtin-rules.json   # 内置规则
    └── user-rules.json      # 用户规则
```

## 🔧 技术实现

### 跨平台兼容
- **Windows**: 使用WMI、PowerShell命令
- **macOS**: 使用system_profiler、launchctl
- **Linux**: 使用/proc文件系统、systemd

### 智能检测算法
1. **多维度匹配**: 进程名+命令行+端口+目录
2. **置信度评分**: 根据匹配程度给出可信度
3. **去重合并**: 避免同一程序多次报告
4. **错误处理**: 权限不足时优雅降级

### 性能优化
- 🚀 并行执行: 多个检测任务同时进行
- ⏱️ 超时控制: 防止长时间卡住
- 💾 缓存机制: 避免重复检查
- 📉 资源监控: 控制内存和CPU使用

## 🎯 设计理念

### 用户友好原则
1. **零技术门槛**: 不需要懂编程也能使用
2. **直观输出**: 用表情符号和颜色区分状态
3. ** actionable建议**: 每个问题都给出解决方案
4. **渐进式披露**: 先给摘要，再提供详细信息

### 安全可靠
1. **只读操作**: 不会修改系统配置
2. **权限最小化**: 不需要root/admin权限
3. **数据本地化**: 所有信息只保存在本地
4. **透明处理**: 明确告知正在做什么

### 可维护性
1. **模块化设计**: 每个功能独立可测试
2. **配置驱动**: 通过配置文件调整行为
3. **完整日志**: 详细的运行日志
4. **错误恢复**: 单个功能失败不影响整体

## 📊 输出示例

### 扫描报告
```
🚀 GitHub部署助手 - 资产发现工具
==================================================
🤖 正在扫描您的系统...

📊 您的设备信息摘要:
💻 电脑类型: Windows (x64)
🏷️ 系统版本: Windows 10 Pro
🖥️ 主机名称: DESKTOP-ABC123
⏰ 运行时间: 3天5小时
🧠 内存使用: 65% (8.2GB 可用)
⚡ 处理器: Intel i7-10700K
🔢 CPU核心: 8个
🌐 网络状态: 已连接
📡 IP地址: 192.168.1.100

🔍 发现的非安装式程序:
1. 🚨 OpenClaw (可信度: 高)
   检测方式: 进程名匹配、目录匹配
   进程ID: 1234, 用户: admin
   路径: C:\Users\admin\.openclaw

💡 健康建议:
1. 内存使用率较高，建议关闭不需要的程序
2. OpenClaw程序正在运行，确认是否需要
```

### JSON格式报告
```json
{
  "timestamp": "2026-04-05T13:45:00.000Z",
  "systemInfo": {
    "platform": "win32",
    "hostname": "DESKTOP-ABC123",
    "cpus": 8,
    "memory": "32GB"
  },
  "nonInstalledPrograms": [
    {
      "program": "OpenClaw",
      "confidence": "高",
      "detectedBy": ["进程名匹配", "目录匹配"]
    }
  ],
  "environmentHealth": {
    "score": 85,
    "level": "良好",
    "issues": ["内存使用率较高"],
    "recommendations": ["清理内存"]
  }
}
```

## 🔮 未来扩展

### 计划功能
1. **云端同步**: 规则库在线更新
2. **可视化界面**: Web版管理界面
3. **自动化修复**: 一键解决常见问题
4. **集成监控**: 长期趋势分析
5. **安全扫描**: 漏洞和配置检查

### 社区贡献
1. **规则贡献**: 用户提交检测规则
2. **插件市场**: 第三方功能扩展
3. **翻译支持**: 多语言界面
4. **模板库**: 常用配置模板

## 📝 使用场景

### 开发者
- 🔍 检查开发环境完整性
- 🏥 诊断部署问题
- 📊 监控系统资源使用
- 🔧 自动化环境配置

### 运维人员
- 👁️ 发现未授权程序
- 📈 系统健康监控
- 🔒 安全配置检查
- 📋 资产清单管理

### 普通用户
- 🤔 了解电脑里有什么程序
- 🏥 检查电脑健康状态
- 💡 获取优化建议
- 🆘 故障排查助手

## 🤝 贡献指南

### 添加新规则
1. 创建规则文件 `new-rule.json`:
```json
{
  "name": "NewProgram",
  "description": "程序描述",
  "processNames": ["program-name"],
  "directoryPatterns": ["~/.newprogram"]
}
```

2. 使用规则管理器导入:
```bash
node src/asset-discovery/plugins/rule-manager.js import new-rule.json
```

### 开发插件
1. 参考现有检测器实现
2. 遵循模块化接口设计
3. 添加完整的错误处理
4. 编写测试用例

## 🆘 常见问题

### Q: 扫描需要管理员权限吗？
**A**: 大部分功能不需要，但某些系统信息可能需要。工具会在权限不足时优雅降级。

### Q: 会修改我的系统吗？
**A**: 不会。这是只读工具，只收集信息不进行修改。

### Q: 支持哪些操作系统？
**A**: 支持Windows、macOS、Linux主流发行版。

### Q: 如何更新检测规则？
**A**: 使用规则管理器的导入功能，或等待自动更新。

### Q: 扫描结果保存在哪里？
**A**: 默认在当前目录，可使用 `--json` 参数指定路径。

## 📞 支持与反馈

- 📧 邮箱: 19106440339@163.com
- 🐱 Gitee: https://gitee.com/kai0339/github-deploy-assistant
- 📖 文档: 本项目README.md

---

**🎯 设计目标**: 让每个用户都能轻松管理自己的数字资产，无论技术背景如何。

**💝 开发理念**: 技术应该服务于人，而不是让人服务于技术。