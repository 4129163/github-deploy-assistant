# GADA Windows Service Installation Guide

## 概述

GitHub Deploy Assistant (GADA) 提供了Windows服务安装脚本，可以将GADA作为Windows服务运行，实现开机自启动和后台运行。

## 系统要求

- Windows 7/8/10/11 或 Windows Server 2008 R2+
- Node.js 18.0.0 或更高版本
- PowerShell 5.0 或更高版本
- 管理员权限

## 安装方法

### 方法1：使用批处理文件（推荐）

1. 以管理员身份运行命令提示符（CMD）
2. 切换到GADA项目目录
3. 运行以下命令：

```batch
install-windows-service.bat
```

### 方法2：使用PowerShell脚本

1. 以管理员身份运行PowerShell
2. 切换到GADA项目目录
3. 运行以下命令：

```powershell
.\install-windows-service.ps1
```

## 命令选项

### 基本命令

```batch
# 安装服务（默认）
install-windows-service.bat

# 卸载服务
install-windows-service.bat uninstall

# 启动服务
install-windows-service.bat start

# 停止服务
install-windows-service.bat stop

# 重启服务
install-windows-service.bat restart

# 查看服务状态
install-windows-service.bat status
```

### 高级选项

```batch
# 指定服务名称
install-windows-service.bat -name "MyGADA"

# 指定显示名称
install-windows-service.bat -display "My GitHub Deploy Assistant"

# 组合使用
install-windows-service.bat -name "MyGADA" -display "My GADA Service" install
```

### PowerShell脚本完整选项

```powershell
# 显示帮助
.\install-windows-service.ps1 -Help

# 自定义所有参数
.\install-windows-service.ps1 -ServiceName "GADA" -DisplayName "GitHub Deploy Assistant" -Description "Intelligent project deployment service" -InstallPath "C:\gada" -Start
```

## 服务配置

### 服务属性
- **服务名称**: GADA（可自定义）
- **显示名称**: GitHub Deploy Assistant
- **描述**: GitHub Deploy Assistant - Intelligent project deployment and management service
- **启动类型**: 自动（延迟启动）
- **登录身份**: LocalSystem

### 恢复选项
服务配置了自动恢复机制：
- 第一次失败：5秒后重启
- 第二次失败：10秒后重启
- 第三次失败：15秒后重启
- 重置失败计数：24小时后

### 端口配置
- 默认端口：3456
- 可通过环境变量 `PORT` 修改

## 安装后的步骤

1. **验证安装**
   ```powershell
   Get-Service GADA
   ```

2. **访问Web界面**
   - 打开浏览器访问：http://localhost:3456

3. **查看日志**
   - 事件查看器 -> Windows日志 -> 应用程序
   - 筛选事件源：GADA

4. **配置防火墙（如果需要）**
   ```powershell
   New-NetFirewallRule -DisplayName "GADA Web Interface" -Direction Inbound -Protocol TCP -LocalPort 3456 -Action Allow
   ```

## 故障排除

### 常见问题

1. **"Node.js not found" 错误**
   - 确保Node.js已安装并添加到PATH
   - 或手动指定Node.js路径

2. **权限不足错误**
   - 以管理员身份运行脚本
   - 检查用户权限

3. **端口被占用**
   - 修改 `PORT` 环境变量
   - 停止占用端口的其他服务

4. **服务无法启动**
   - 检查事件查看器中的错误信息
   - 验证Node.js版本（需要18+）
   - 检查项目依赖是否完整

### 手动卸载

如果自动卸载失败，可以手动卸载：

```powershell
# 停止服务
Stop-Service GADA -Force

# 删除服务
sc.exe delete GADA
```

### 调试模式

要启用调试模式，编辑服务脚本：

```javascript
// 在gada-service.js中添加
env: [
    {
        name: 'NODE_ENV',
        value: 'development'  // 改为development
    },
    {
        name: 'DEBUG',
        value: 'gada:*'  // 启用调试
    }
]
```

## 更新服务

要更新GADA版本：

1. 停止服务
   ```batch
   install-windows-service.bat stop
   ```

2. 更新代码
   ```batch
   git pull
   npm install
   ```

3. 重启服务
   ```batch
   install-windows-service.bat restart
   ```

## 安全注意事项

1. **服务账户**: 默认使用LocalSystem账户，具有较高权限
2. **网络访问**: 服务绑定到所有网络接口（0.0.0.0）
3. **配置文件**: 敏感信息存储在用户目录下的 `gada-workspace` 中
4. **防火墙**: 建议配置防火墙规则限制访问

## 性能优化

### 内存限制
服务默认配置了4GB内存限制，如需调整：

```javascript
// 在gada-service.js中修改
nodeOptions: [
    '--harmony',
    '--max_old_space_size=8192'  // 改为8GB
]
```

### 启动参数
可以添加额外的Node.js启动参数：

```javascript
nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096',
    '--max-http-header-size=16384',  // 增大HTTP头大小
    '--enable-source-maps'           // 启用源映射
]
```

## 支持与反馈

如果遇到问题：
1. 查看Windows事件查看器日志
2. 检查服务状态：`Get-Service GADA`
3. 查看服务详细状态：`sc.exe queryex GADA`
4. 在GitHub仓库提交issue

## 许可证

本脚本遵循MIT许可证。使用本脚本即表示您同意自行承担风险。