// PowerShell脚本生成函数
function generateInstallScript(options) {
  return [
    `$serviceName = "${options.serviceName}"`,
    `$displayName = "${options.displayName}"`,
    `$description = "${options.description}"`,
    `$nodePath = "${options.nodePath.replace(/\\\\/g, '\\\\\\\\')}"`,
    `$scriptPath = "${options.scriptPath.replace(/\\\\/g, '\\\\\\\\')}"`,
    '',
    '# 检查服务是否已存在',
    '$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue',
    'if ($existingService) {',
    '  Write-Host "⚠️ 服务已存在，停止并移除..."',
    '  Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue',
    '  Start-Sleep -Seconds 2',
    '  Remove-Service -Name $serviceName -ErrorAction SilentlyContinue',
    '}',
    '',
    '# 创建新服务',
    'New-Service \\',
    '  -Name $serviceName \\',
    '  -BinaryPathName "`"$nodePath`" `"$scriptPath`"" \\',
    '  -DisplayName $displayName \\',
    '  -Description $description \\',
    '  -StartupType Automatic \\',
    '  -ErrorAction Stop',
    '',
    '# 配置服务恢复选项',
    'sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/10000/restart/30000',
    '',
    '# 启动服务',
    'Start-Service -Name $serviceName',
    '',
    'Write-Host "✅ Windows服务安装完成: $serviceName"'
  ].join('\\n');
}
function generateUninstallScript(options) {
  return [
    `$serviceName = "${options.serviceName}"`,
    '',
    'try {',
    '  # 停止服务',
    '  Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue',
    '  Start-Sleep -Seconds 2',
    '',
    '  # 移除服务',
    '  Remove-Service -Name $serviceName -ErrorAction SilentlyContinue',
    '',
    '  Write-Host "✅ 服务卸载完成: $serviceName"',
    '} catch {',
    '  Write-Host "⚠️ 服务可能不存在或已移除"',
    '}'
  ].join('\\n');
}
/**
 * GADA 系统服务管理器
 * 支持多平台：Linux (systemd), macOS (launchd), Windows Service
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

class ServiceManager {
  constructor(options = {}) {
    this.options = {
      serviceName: options.serviceName || 'gada',
      displayName: options.displayName || 'GitHub Deploy Assistant',
      description: options.description || 'GitHub项目自动部署助手，支持多项目类型识别、一键部署、进程守护',
      user: options.user || process.env.USER || process.env.USERNAME,
      workingDir: options.workingDir || process.cwd(),
      nodePath: process.argv[0],
      scriptPath: path.join(__dirname, '../../server/index.js'),
      logDir: path.join(process.cwd(), 'logs'),
      ...options
    };
    
    this.platform = os.platform();
    this.impl = this.createPlatformImpl();
  }
  
  createPlatformImpl() {
    switch (this.platform) {
      case 'linux':
        return new LinuxSystemdService(this.options);
      case 'darwin':
        return new MacOSLaunchdService(this.options);
      case 'win32':
        return new WindowsService(this.options);
      default:
        throw new Error(`不支持的操作系统: ${this.platform}`);
    }
  }
  
  async install() {
    try {
      console.log(`🚀 正在安装 ${this.options.displayName}...\n`);
      return await this.impl.install();
    } catch (error) {
      throw new Error(`安装失败: ${error.message}`);
    }
  }
  
  async uninstall() {
    try {
      console.log(`🗑️ 正在卸载 ${this.options.displayName}...\n`);
      return await this.impl.uninstall();
    } catch (error) {
      throw new Error(`卸载失败: ${error.message}`);
    }
  }
  
  async start() {
    return await this.impl.start();
  }
  
  async stop() {
    return await this.impl.stop();
  }
  
  async restart() {
    return await this.impl.restart();
  }
  
  async status() {
    return await this.impl.status();
  }
  
  async enable() {
    if (this.impl.enable) {
      return await this.impl.enable();
    }
    throw new Error('此平台不支持启用服务');
  }
  
  async disable() {
    if (this.impl.disable) {
      return await this.impl.disable();
    }
    throw new Error('此平台不支持禁用服务');
  }
}

class BaseService {
  constructor(options) {
    this.options = options;
  }
  
  async execCommand(cmd, admin = false) {
    try {
      const finalCmd = admin ? `sudo ${cmd}` : cmd;
      const { stdout, stderr } = await exec(finalCmd);
      
      if (stderr && !stderr.includes('Warning')) {
        throw new Error(stderr);
      }
      
      return stdout.trim();
    } catch (error) {
      throw new Error(`执行命令失败: ${cmd}\n${error.message}`);
    }
  }
  
  async isAdmin() {
    if (os.platform() === 'win32') {
      try {
        const { stdout } = await exec('powershell -Command "(New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"');
        return stdout.trim() === 'True';
      } catch {
        return false;
      }
    } else {
      return process.getuid() === 0;
    }
  }
  
  validateAdmin() {
    if (!this.isAdmin()) {
      throw new Error('需要管理员/root权限运行此命令');
    }
  }
}

class LinuxSystemdService extends BaseService {
  constructor(options) {
    super(options);
    this.serviceFile = `/etc/systemd/system/${this.options.serviceName}.service`;
  }
  
  async install() {
    await this.validateAdmin();
    
    // 创建服务文件
    const template = `
[Unit]
Description=${this.options.description}
After=network.target
Wants=network.target

[Service]
Type=simple
User=${this.options.user}
WorkingDirectory=${this.options.workingDir}
ExecStart=${this.options.nodePath} ${this.options.scriptPath}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${this.options.serviceName}
Environment=NODE_ENV=production
Environment=PORT=3456

# 资源限制
LimitNOFILE=65536
LimitNPROC=65536

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
`;
    
    // 写入临时文件
    const tmpFile = path.join(os.tmpdir(), `gada-${Date.now()}.service`);
    fs.writeFileSync(tmpFile, template);
    
    // 复制到系统目录
    await this.execCommand(`cp ${tmpFile} ${this.serviceFile}`, true);
    await this.execCommand(`chmod 644 ${this.serviceFile}`, true);
    
    // 删除临时文件
    fs.unlinkSync(tmpFile);
    
    // 重新加载systemd
    await this.execCommand('systemctl daemon-reload', true);
    
    // 启用服务
    await this.execCommand(`systemctl enable ${this.options.serviceName}.service`, true);
    
    // 启动服务
    await this.execCommand(`systemctl start ${this.options.serviceName}.service`, true);
    
    return {
      success: true,
      message: `GADA服务已安装并启动 (用户: ${this.options.user})`,
      serviceFile: this.serviceFile,
      platform: 'Linux (systemd)',
      commands: {
        start: `sudo systemctl start ${this.options.serviceName}`,
        stop: `sudo systemctl stop ${this.options.serviceName}`,
        restart: `sudo systemctl restart ${this.options.serviceName}`,
        status: `systemctl status ${this.options.serviceName}`,
        logs: `journalctl -u ${this.options.serviceName} -f`
      }
    };
  }
  
  async uninstall() {
    await this.validateAdmin();
    
    try {
      // 停止服务
      await this.execCommand(`systemctl stop ${this.options.serviceName}.service`, true);
      
      // 禁用服务
      await this.execCommand(`systemctl disable ${this.options.serviceName}.service`, true);
      
      // 删除服务文件
      if (fs.existsSync(this.serviceFile)) {
        await this.execCommand(`rm ${this.serviceFile}`, true);
      }
      
      // 重新加载systemd
      await this.execCommand('systemctl daemon-reload', true);
      
      return {
        success: true,
        message: 'GADA服务已卸载',
        platform: 'Linux (systemd)'
      };
    } catch (error) {
      throw new Error(`卸载失败: ${error.message}`);
    }
  }
  
  async status() {
    try {
      const status = await this.execCommand(`systemctl is-active ${this.options.serviceName}.service`);
      const enabled = await this.execCommand(`systemctl is-enabled ${this.options.serviceName}.service`);
      
      return {
        status: status === 'active' ? '运行中' : '已停止',
        enabled: enabled === 'enabled' ? '已启用' : '已禁用',
        serviceName: this.options.serviceName,
        platform: 'Linux (systemd)'
      };
    } catch (error) {
      return {
        status: '未安装',
        serviceName: this.options.serviceName,
        platform: 'Linux (systemd)'
      };
    }
  }
}

class MacOSLaunchdService extends BaseService {
  constructor(options) {
    super(options);
    this.plistFile = path.join(os.homedir(), 'Library/LaunchAgents', `com.github.${this.options.serviceName}.plist`);
  }
  
  async install() {
    // 创建plist文件
    const template = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.github.${this.options.serviceName}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${this.options.nodePath}</string>
        <string>${this.options.scriptPath}</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>${this.options.workingDir}</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    
    <key>StandardOutPath</key>
    <string>${this.options.logDir}/gada.log</string>
    
    <key>StandardErrorPath</key>
    <string>${this.options.logDir}/gada-error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3456</string>
    </dict>
    
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>`;
    
    // 确保LaunchAgents目录存在
    const launchAgentsDir = path.dirname(this.plistFile);
    if (!fs.existsSync(launchAgentsDir)) {
      fs.mkdirSync(launchAgentsDir, { recursive: true });
    }
    
    // 写入plist文件
    fs.writeFileSync(this.plistFile, template);
    
    // 加载服务
    try {
      await this.execCommand(`launchctl unload ${this.plistFile}`);
    } catch (error) {
      // 忽略卸载失败
    }
    
    await this.execCommand(`launchctl load ${this.plistFile}`);
    await this.execCommand(`launchctl start com.github.${this.options.serviceName}`);
    
    return {
      success: true,
      message: 'GADA服务已安装并启动',
      plistFile: this.plistFile,
      platform: 'macOS (launchd)',
      commands: {
        start: `launchctl start com.github.${this.options.serviceName}`,
        stop: `launchctl stop com.github.${this.options.serviceName}`,
        restart: `launchctl unload ${this.plistFile} && launchctl load ${this.plistFile}`,
        status: `launchctl list | grep com.github.${this.options.serviceName}`
      }
    };
  }
  
  async uninstall() {
    try {
      // 停止服务
      await this.execCommand(`launchctl stop com.github.${this.options.serviceName}`);
      
      // 卸载服务
      await this.execCommand(`launchctl unload ${this.plistFile}`);
      
      // 删除plist文件
      if (fs.existsSync(this.plistFile)) {
        fs.unlinkSync(this.plistFile);
      }
      
      return {
        success: true,
        message: 'GADA服务已卸载',
        platform: 'macOS (launchd)'
      };
    } catch (error) {
      throw new Error(`卸载失败: ${error.message}`);
    }
  }
  
  async status() {
    try {
      const result = await this.execCommand(`launchctl list | grep com.github.${this.options.serviceName}`);
      
      if (result) {
        return {
          status: '运行中',
          serviceName: this.options.serviceName,
          platform: 'macOS (launchd)',
          rawStatus: result
        };
      }
    } catch (error) {
      // 忽略错误
    }
    
    return {
      status: '未安装',
      serviceName: this.options.serviceName,
      platform: 'macOS (launchd)'
    };
  }
}

class WindowsService extends BaseService {
  constructor(options) {
    super(options);
  }
  
  async install() {
    await this.validateAdmin();
    
        const powershellScript = generateInstallScript(this.options);
    
    const scriptFile = path.join(os.tmpdir(), `gada-install-${Date.now()}.ps1`);
    fs.writeFileSync(scriptFile, powershellScript);
    
    try {
      await this.execCommand(`powershell -ExecutionPolicy Bypass -File "${scriptFile}"`);
      
      // 清理临时文件
      fs.unlinkSync(scriptFile);
      
      return {
        success: true,
        message: 'Windows服务安装完成',
        serviceName: this.options.serviceName,
        displayName: this.options.displayName,
        platform: 'Windows',
        commands: {
          start: `Start-Service ${this.options.serviceName}`,
          stop: `Stop-Service ${this.options.serviceName}`,
          restart: `Restart-Service ${this.options.serviceName}`,
          status: `Get-Service ${this.options.serviceName}`
        }
      };
    } catch (error) {
      // 清理临时文件
      if (fs.existsSync(scriptFile)) {
        fs.unlinkSync(scriptFile);
      }
      throw new Error(`安装失败: ${error.message}`);
    }
  }
  
  async uninstall() {
    await this.validateAdmin();
    
        const powershellScript = generateUninstallScript(this.options);
    
    const scriptFile = path.join(os.tmpdir(), `gada-uninstall-${Date.now()}.ps1`);
    fs.writeFileSync(scriptFile, powershellScript);
    
    try {
      await this.execCommand(`powershell -ExecutionPolicy Bypass -File "${scriptFile}"`);
      
      // 清理临时文件
      fs.unlinkSync(scriptFile);
      
      return {
        success: true,
        message: 'Windows服务卸载完成',
        platform: 'Windows'
      };
    } catch (error) {
      if (fs.existsSync(scriptFile)) {
        fs.unlinkSync(scriptFile);
      }
      throw new Error(`卸载失败: ${error.message}`);
    }
  }
  
  async status() {
    try {
      const result = await this.execCommand(`powershell -Command "(Get-Service -Name '${this.options.serviceName}' -ErrorAction SilentlyContinue).Status"`);
      
      const statusMap = {
        'Running': '运行中',
        'Stopped': '已停止',
        'Paused': '已暂停',
        'StartPending': '启动中',
        'StopPending': '停止中',
        'ContinuePending': '继续中',
        'PausePending': '暂停中'
      };
      
      const rawStatus = result.trim();
      const translatedStatus = statusMap[rawStatus] || rawStatus;
      
      if (rawStatus && rawStatus !== '') {
        return {
          status: translatedStatus,
          rawStatus: rawStatus,
          serviceName: this.options.serviceName,
          platform: 'Windows'
        };
      }
    } catch (error) {
      // 忽略错误
    }
    
    return {
      status: '未安装',
      serviceName: this.options.serviceName,
      platform: 'Windows'
    };
  }
}

module.exports = ServiceManager;