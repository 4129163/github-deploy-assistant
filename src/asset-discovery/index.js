/**
 * 基于特征和行为的资产发现模块
 * 主要功能：检测非安装式程序、收集设备信息、检测环境健康状态
 * 设计目标：让编程小白也能看懂和使用
 */

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');
const ps = require('ps-node');

// 导入新的模块
const PluginManager = require('./plugins/plugin-manager');
const ProcessDetector = require('./detectors/process-detector');
const DirectoryDetector = require('./detectors/directory-detector');
const PackageDetector = require('./detectors/package-detector');
const DeviceCollector = require('./collectors/device-collector');
const HealthChecker = require('./health/health-checker');

// 如果ps-node不可用，使用替代方案
let hasPsNode = true;
try {
  require('ps-node');
} catch (e) {
  hasPsNode = false;
}

class AssetDiscovery {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      scanDepth: 3,
      includeSystemInfo: true,
      includeProcessScan: true,
      includeDirectoryScan: true,
      includePackageManagerScan: true,
      includeStartupScan: true,
      includeDeviceInfo: true,
      includeHealthCheck: true,
      usePlugins: true,
      pluginDir: null,
      ...options
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      systemInfo: {},
      nonInstalledPrograms: [],
      deviceInfo: {},
      environmentHealth: {},
      issues: [],
      recommendations: [],
      plugins: {
        loaded: false,
        count: 0
      }
    };
    
    // 初始化各个模块
    this.pluginManager = new PluginManager(this.options.pluginDir);
    this.processDetector = new ProcessDetector();
    this.directoryDetector = new DirectoryDetector();
    this.packageDetector = new PackageDetector();
    this.deviceCollector = new DeviceCollector();
    this.healthChecker = new HealthChecker();
    
    // 程序特征库（初始为空，将从插件加载）
    this.programFingerprints = {};
  }

  /**
   * 执行完整的资产发现
   */
  async discover() {
    console.log('🔍 开始资产发现扫描...');
    console.log('📋 扫描内容：');
    console.log('  - 🔌 插件系统初始化');
    console.log('  - 🔍 非安装式程序检测');
    console.log('  - 💻 设备信息收集');
    console.log('  - 🏥 环境健康状态检查');
    console.log('  - 💡 问题诊断与建议');
    console.log('');

    try {
      // 0. 初始化插件系统
      if (this.options.usePlugins) {
        await this.initializePlugins();
      }

      // 1. 收集系统信息
      if (this.options.includeSystemInfo) {
        await this.collectSystemInfo();
      }

      // 2. 检测非安装式程序
      const detectionTasks = [];
      
      if (this.options.includeProcessScan) {
        detectionTasks.push(this.scanProcesses());
      }
      
      if (this.options.includeDirectoryScan) {
        detectionTasks.push(this.scanDirectories());
      }
      
      if (this.options.includePackageManagerScan) {
        detectionTasks.push(this.scanPackageManagers());
      }
      
      if (this.options.includeStartupScan) {
        detectionTasks.push(this.scanStartupItems());
      }

      // 并行执行检测任务
      await Promise.all(detectionTasks);

      // 3. 收集设备信息
      if (this.options.includeDeviceInfo) {
        await this.collectDeviceInfo();
      }

      // 4. 检查环境健康状态
      if (this.options.includeHealthCheck) {
        await this.checkEnvironmentHealth();
      }

      // 5. 生成用户友好的报告
      this.generateUserFriendlyReport();

      return this.results;

    } catch (error) {
      console.error('❌ 资产发现过程中发生错误:', error.message);
      this.results.error = error.message;
      return this.results;
    }
  }

  /**
   * 初始化插件系统
   */
  async initializePlugins() {
    console.log('🔌 初始化插件系统...');
    
    try {
      await this.pluginManager.initialize();
      this.programFingerprints = this.pluginManager.getRules();
      
      this.results.plugins = {
        loaded: true,
        count: Object.keys(this.programFingerprints).length,
        directory: this.pluginManager.pluginDir
      };
      
      console.log(`✅ 插件系统初始化完成，加载 ${this.results.plugins.count} 个规则`);
      
    } catch (error) {
      console.warn('⚠️ 插件系统初始化失败，使用内置规则:', error.message);
      // 使用内置规则作为备选
      this.programFingerprints = this.getBuiltinFingerprints();
      this.results.plugins.error = error.message;
    }
  }

  /**
   * 获取内置指纹库（备选方案）
   */
  getBuiltinFingerprints() {
    return {
      'OpenClaw': {
        processNames: ['openclaw', 'claw', 'claw-agent'],
        cmdlinePatterns: ['--agent', '--serve', '--api'],
        defaultPorts: [3000, 5000, 8000, 8080],
        directoryPatterns: [
          '~/.openclaw',
          '~/.config/openclaw',
          '~/openclaw',
          '/opt/openclaw',
          '/usr/local/openclaw'
        ],
        fileFingerprints: [
          { name: 'config.json', contains: ['openclaw', 'agent'] },
          { name: 'package.json', contains: ['openclaw'] }
        ]
      },
      'AI-Agent': {
        processNames: ['ai-agent', 'agent-service', 'llm-agent'],
        cmdlinePatterns: ['--ai', '--model', '--llm'],
        defaultPorts: [7860, 8888, 9999],
        directoryPatterns: [
          '~/.ai-agents',
          '~/ai-projects',
          '/opt/ai'
        ]
      }
    };
  }

  /**
   * 收集基本系统信息
   */
  async collectSystemInfo() {
    console.log('📊 收集系统信息...');
    
    this.results.systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      uptime: Math.floor(os.uptime() / 3600) + '小时',
      userInfo: os.userInfo(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10 + 'GB',
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10 + 'GB',
      loadAverage: os.loadavg(),
      networkInterfaces: this.getNetworkInfo(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: process.env.LANG || 'zh_CN.UTF-8'
    };

    console.log('✅ 系统信息收集完成');
  }

  /**
   * 获取网络信息（简化版）
   */
  getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const result = {};
    
    for (const [name, iface] of Object.entries(interfaces)) {
      if (!Array.isArray(iface)) continue;
      
      const ipv4 = iface.find(i => i.family === 'IPv4' && !i.internal);
      if (ipv4) {
        result[name] = {
          address: ipv4.address,
          netmask: ipv4.netmask,
          mac: iface.find(i => i.mac && i.mac !== '00:00:00:00:00:00')?.mac
        };
      }
    }
    
    return result;
  }

  /**
   * 扫描进程
   */
  async scanProcesses() {
    console.log('🔬 扫描运行中的进程...');
    
    try {
      // 使用进程检测器
      const detectedPrograms = await this.processDetector.detectNonInstalledPrograms(
        this.programFingerprints
      );
      
      // 添加到结果
      detectedPrograms.forEach(detection => {
        // 避免重复添加
        const exists = this.results.nonInstalledPrograms.some(p => 
          p.program === detection.program && 
          p.details.pid === detection.details.pid
        );
        
        if (!exists) {
          this.results.nonInstalledPrograms.push(detection);
        }
      });
      
      console.log(`✅ 进程扫描完成，发现 ${detectedPrograms.length} 个疑似非安装式程序`);
      
    } catch (error) {
      console.warn('⚠️ 进程扫描失败，可能缺少权限:', error.message);
      this.results.issues.push(`进程扫描失败: ${error.message}`);
    }
  }

  /**
   * 获取进程列表
   */
  async getProcessList() {
    if (hasPsNode) {
      return new Promise((resolve, reject) => {
        ps.lookup({}, (err, result) => {
          if (err) reject(err);
          else resolve(result || []);
        });
      });
    } else {
      // 使用系统命令作为备选方案
      try {
        const output = await this.execCommand('ps aux');
        const processes = output.split('\n')
          .slice(1) // 跳过标题行
          .filter(line => line.trim())
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              user: parts[0],
              pid: parseInt(parts[1]),
              cpu: parseFloat(parts[2]),
              mem: parseFloat(parts[3]),
              command: parts.slice(10).join(' '),
              name: parts[10] || ''
            };
          });
        return processes;
      } catch (error) {
        console.warn('无法获取进程列表:', error.message);
        return [];
      }
    }
  }

  /**
   * 获取进程监听的端口
   */
  async getProcessPorts(pid) {
    try {
      let command;
      if (os.platform() === 'win32') {
        command = `netstat -ano | findstr : | findstr ${pid}`;
      } else {
        command = `lsof -Pan -p ${pid} -i`;
      }
      
      const output = await this.execCommand(command);
      const ports = [];
      
      // 简单提取端口号
      const portRegex = /:(\d+)/g;
      let match;
      while ((match = portRegex.exec(output)) !== null) {
        const port = parseInt(match[1]);
        if (port > 0 && port <= 65535) {
          ports.push(port);
        }
      }
      
      return [...new Set(ports)]; // 去重
    } catch (error) {
      return [];
    }
  }

  /**
   * 扫描目录
   */
  async scanDirectories() {
    console.log('📁 扫描可疑目录...');
    
    try {
      // 使用目录检测器
      const detectedDirectories = await this.directoryDetector.detectNonInstalledPrograms(
        this.programFingerprints,
        this.options.scanDepth
      );
      
      // 添加到结果
      detectedDirectories.forEach(detection => {
        // 避免重复添加
        const exists = this.results.nonInstalledPrograms.some(p => 
          p.program === detection.program && 
          p.details.path === detection.details.path
        );
        
        if (!exists) {
          this.results.nonInstalledPrograms.push(detection);
        }
      });
      
      console.log(`✅ 目录扫描完成，发现 ${detectedDirectories.length} 个可疑目录`);
      
    } catch (error) {
      console.warn('⚠️ 目录扫描失败:', error.message);
      this.results.issues.push(`目录扫描失败: ${error.message}`);
    }
  }

  /**
   * 扫描包管理器
   */
  async scanPackageManagers() {
    console.log('📦 扫描包管理器安装的程序...');
    
    try {
      // 使用包管理器检测器
      const detectedPackages = await this.packageDetector.detectNonInstalledPrograms(
        this.programFingerprints
      );
      
      // 添加到结果
      detectedPackages.forEach(detection => {
        // 避免重复添加
        const exists = this.results.nonInstalledPrograms.some(p => 
          p.program === detection.program && 
          p.detectedBy.join(',') === detection.detectedBy.join(',')
        );
        
        if (!exists) {
          this.results.nonInstalledPrograms.push(detection);
        }
      });
      
      console.log(`✅ 包管理器扫描完成，发现 ${detectedPackages.length} 个包管理器安装的程序`);
      
    } catch (error) {
      console.warn('⚠️ 包管理器扫描失败:', error.message);
      this.results.issues.push(`包管理器扫描失败: ${error.message}`);
    }
  }

  /**
   * 扫描启动项
   */
  async scanStartupItems() {
    console.log('🚀 扫描启动项...');
    
    const platform = os.platform();
    
    try {
      let startupItems = [];
      
      if (platform === 'win32') {
        // Windows启动项
        const tasks = await this.execCommand('schtasks /query /fo LIST');
        const services = await this.execCommand('sc query');
        startupItems = tasks + '\n' + services;
      } else if (platform === 'darwin') {
        // macOS启动项
        const launchAgents = await this.execCommand('launchctl list');
        const plists = await this.execCommand('find ~/Library/LaunchAgents /Library/LaunchAgents /Library/LaunchDaemons -name "*.plist" 2>/dev/null | head -20');
        startupItems = launchAgents + '\n' + plists;
      } else {
        // Linux启动项
        const systemd = await this.execCommand('systemctl list-unit-files --type=service --state=enabled');
        const cron = await this.execCommand('crontab -l 2>/dev/null || echo ""');
        const autostart = await this.execCommand('ls -la ~/.config/autostart/ 2>/dev/null || echo ""');
        startupItems = systemd + '\n' + cron + '\n' + autostart;
      }
      
      for (const [programName, fingerprint] of Object.entries(this.programFingerprints)) {
        const searchNames = [...fingerprint.processNames, programName.toLowerCase()];
        
        for (const name of searchNames) {
          if (startupItems.toLowerCase().includes(name)) {
            const detection = {
              program: programName,
              confidence: '中',
              detectedBy: ['启动项匹配'],
              details: {
                platform: platform,
                startupType: this.getStartupType(platform),
                matchedPattern: name
              }
            };
            
            // 避免重复添加
            const exists = this.results.nonInstalledPrograms.some(p => 
              p.program === programName && 
              p.detectedBy.includes('启动项匹配')
            );
            
            if (!exists) {
              this.results.nonInstalledPrograms.push(detection);
            }
            break;
          }
        }
      }
      
      console.log('✅ 启动项扫描完成');
    } catch (error) {
      console.warn('⚠️ 启动项扫描失败:', error.message);
    }
  }

  /**
   * 获取启动项类型
   */
  getStartupType(platform) {
    const types = {
      'win32': 'Windows计划任务/服务',
      'darwin': 'macOS LaunchAgent/LaunchDaemon',
      'linux': 'systemd服务/cron任务'
    };
    return types[platform] || '未知';
  }

  /**
   * 执行命令的辅助函数
   */
  execCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: options.timeout || 10000 }, (error, stdout, stderr) => {
        if (error && !options.ignoreError) {
          reject(error);
        } else {
          resolve(stdout.toString());
        }
      });
    });
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 收集设备信息
   */
  async collectDeviceInfo() {
    console.log('💻 收集设备详细信息...');
    
    try {
      const deviceInfo = await this.deviceCollector.collectAll();
      this.results.deviceInfo = deviceInfo;
      
      console.log('✅ 设备信息收集完成');
      
    } catch (error) {
      console.error('❌ 设备信息收集失败:', error.message);
      this.results.deviceInfo = {
        error: error.message,
        basic: this.collectBasicDeviceInfo()
      };
    }
  }

  /**
   * 基本设备信息（备选方案）
   */
  collectBasicDeviceInfo() {
    return {
      os: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch()
      },
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model || '未知'
      },
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
        free: Math.round(os.freemem() / 1024 / 1024) + ' MB'
      }
    };
  }

  /**
   * 检查环境健康状态
   */
  async checkEnvironmentHealth() {
    console.log('🏥 检查环境健康状态...');
    
    try {
      const healthResults = await this.healthChecker.checkAll();
      this.results.environmentHealth = healthResults;
      
      console.log('✅ 环境健康检查完成');
      
    } catch (error) {
      console.error('❌ 环境健康检查失败:', error.message);
      this.results.environmentHealth = {
        error: error.message,
        basic: this.checkBasicHealth()
      };
    }
  }

  /**
   * 基本健康检查（备选方案）
   */
  checkBasicHealth() {
    const loadavg = os.loadavg();
    const cpuCount = os.cpus().length;
    const cpuLoad = (loadavg[0] / cpuCount) * 100;
    
    return {
      cpuLoad: cpuLoad.toFixed(1) + '%',
      memoryUsage: Math.round((1 - os.freemem() / os.totalmem()) * 100) + '%',
      uptime: Math.floor(os.uptime() / 3600) + '小时',
      status: cpuLoad > 80 ? '警告' : '正常'
    };
  }

  /**
   * 生成用户友好的报告
   */
  generateUserFriendlyReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 资产发现报告');
    console.log('='.repeat(60));
    
    // 系统信息摘要
    console.log('\n📊 系统信息摘要:');
    console.log(`  • 操作系统: ${this.results.systemInfo.platform} ${this.results.systemInfo.release}`);
    console.log(`  • 主机名: ${this.results.systemInfo.hostname}`);
    console.log(`  • CPU核心: ${this.results.systemInfo.cpus}核`);
    console.log(`  • 内存: ${this.results.systemInfo.totalMemory} (可用 ${this.results.systemInfo.freeMemory})`);
    console.log(`  • 运行时间: ${this.results.systemInfo.uptime}`);
    
    // 发现的非安装式程序
    if (this.results.nonInstalledPrograms.length > 0) {
      console.log('\n🔍 发现的非安装式程序:');
      this.results.nonInstalledPrograms.forEach((prog, index) => {
        console.log(`  ${index + 1}. ${prog.program} (可信度: ${prog.confidence})`);
        console.log(`     检测方式: ${prog.detectedBy.join(', ')}`);
        if (prog.details.pid) {
          console.log(`     进程ID: ${prog.details.pid}, 用户: ${prog.details.user}`);
        }
        if (prog.details.path) {
          console.log(`     路径: ${prog.details.path}`);
        }
      });
    } else {
      console.log('\n✅ 未发现明显的非安装式程序');
    }
    
    // 问题和建议
    if (this.results.issues.length > 0) {
      console.log('\n⚠️ 发现的问题:');
      this.results.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }
    
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 建议:');
      this.results.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 资产发现完成！');
    console.log('='.repeat(60));
  }

  /**
   * 获取JSON格式的详细结果
   */
  getDetailedResults() {
    return this.results;
  }

  /**
   * 保存结果到文件
   */
  async saveResults(filePath = './asset-discovery-report.json') {
    try {
      await fs.writeJson(filePath, this.results, { spaces: 2 });
      console.log(`✅ 报告已保存到: ${path.resolve(filePath)}`);
      return true;
    } catch (error) {
      console.error('❌ 保存报告失败:', error.message);
      return false;
    }
  }
}

module.exports = AssetDiscovery;