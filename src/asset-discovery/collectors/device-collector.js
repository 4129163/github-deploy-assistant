/**
 * 设备信息收集器
 * 收集系统硬件、软件、网络等全面设备信息
 * 设计目标：让编程小白也能看懂的系统信息
 */

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class DeviceCollector {
  constructor() {
    this.platform = os.platform();
    this.homeDir = os.homedir();
    this.results = {};
  }

  /**
   * 收集完整的设备信息
   */
  async collectAll() {
    console.log('💻 正在收集设备信息...');
    
    try {
      // 并行收集各种信息
      const [
        basicInfo,
        hardwareInfo,
        softwareInfo,
        networkInfo,
        userInfo,
        storageInfo
      ] = await Promise.all([
        this.collectBasicInfo(),
        this.collectHardwareInfo(),
        this.collectSoftwareInfo(),
        this.collectNetworkInfo(),
        this.collectUserInfo(),
        this.collectStorageInfo()
      ]);
      
      // 合并结果
      this.results = {
        ...basicInfo,
        hardware: hardwareInfo,
        software: softwareInfo,
        network: networkInfo,
        user: userInfo,
        storage: storageInfo,
        collectionTime: new Date().toISOString(),
        collectionDuration: '实时'
      };
      
      // 生成用户友好的摘要
      this.generateUserFriendlySummary();
      
      return this.results;
      
    } catch (error) {
      console.error('❌ 设备信息收集失败:', error.message);
      return {
        error: error.message,
        basicInfo: this.collectBasicInfoFallback()
      };
    }
  }

  /**
   * 收集基本系统信息
   */
  async collectBasicInfo() {
    return {
      // 操作系统信息
      os: {
        platform: this.platform,
        platformName: this.getPlatformName(this.platform),
        release: os.release(),
        version: os.version() || '未知',
        arch: os.arch(),
        type: os.type(),
        hostname: os.hostname(),
        machine: os.machine?.() || '未知'
      },
      
      // 系统运行状态
      runtime: {
        uptime: Math.floor(os.uptime()), // 秒
        uptimeHuman: this.formatUptime(os.uptime()),
        loadAverage: os.loadavg(),
        loadAverageHuman: this.formatLoadAverage(os.loadavg()),
        freeMemory: Math.round(os.freemem() / 1024 / 1024), // MB
        totalMemory: Math.round(os.totalmem() / 1024 / 1024), // MB
        memoryUsage: Math.round((1 - os.freemem() / os.totalmem()) * 100) + '%'
      },
      
      // 环境信息
      environment: {
        nodeVersion: process.version,
        nodeArch: process.arch,
        nodePlatform: process.platform,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: process.env.LANG || process.env.LANGUAGE || 'zh_CN.UTF-8',
        encoding: process.stdout.encoding || 'UTF-8',
        cwd: process.cwd(),
        homeDir: this.homeDir,
        tempDir: os.tmpdir()
      }
    };
  }

  /**
   * 收集硬件信息
   */
  async collectHardwareInfo() {
    const cpus = os.cpus();
    
    const hardware = {
      cpu: {
        count: cpus.length,
        model: cpus[0]?.model || '未知',
        speed: cpus[0]?.speed ? cpus[0].speed + ' MHz' : '未知',
        architecture: os.arch(),
        coresPerCPU: this.getCoresPerCPU(cpus)
      },
      
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10 + ' GB',
        free: Math.round(os.freemem() / 1024 / 1024 / 1024 * 10) / 10 + ' GB',
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024 * 10) / 10 + ' GB',
        usage: Math.round((1 - os.freemem() / os.totalmem()) * 100) + '%'
      }
    };
    
    // 尝试获取更多硬件信息
    try {
      if (this.platform === 'darwin') {
        // macOS
        const sysctl = await execPromise('sysctl -n hw.model hw.memsize hw.ncpu');
        const lines = sysctl.stdout.split('\n');
        hardware.cpu.model = lines[0] || hardware.cpu.model;
        hardware.memory.total = lines[1] ? Math.round(parseInt(lines[1]) / 1024 / 1024 / 1024 * 10) / 10 + ' GB' : hardware.memory.total;
      } else if (this.platform === 'linux') {
        // Linux
        const cpuInfo = await execPromise('cat /proc/cpuinfo | grep "model name" | head -1').catch(() => ({ stdout: '' }));
        const memInfo = await execPromise('cat /proc/meminfo | grep MemTotal').catch(() => ({ stdout: '' }));
        
        if (cpuInfo.stdout) {
          const modelMatch = cpuInfo.stdout.match(/model name\s*:\s*(.+)/);
          if (modelMatch) hardware.cpu.model = modelMatch[1].trim();
        }
        
        if (memInfo.stdout) {
          const memMatch = memInfo.stdout.match(/MemTotal:\s*(\d+)\s*kB/);
          if (memMatch) {
            const totalKB = parseInt(memMatch[1]);
            hardware.memory.total = Math.round(totalKB / 1024 / 1024 * 10) / 10 + ' GB';
          }
        }
      } else if (this.platform === 'win32') {
        // Windows
        const wmic = await execPromise('wmic cpu get name /value').catch(() => ({ stdout: '' }));
        const mem = await execPromise('wmic memorychip get capacity /value').catch(() => ({ stdout: '' }));
        
        if (wmic.stdout) {
          const nameMatch = wmic.stdout.match(/Name=(.+)/);
          if (nameMatch) hardware.cpu.model = nameMatch[1].trim();
        }
      }
    } catch (error) {
      console.warn('⚠️ 无法获取详细硬件信息:', error.message);
    }
    
    return hardware;
  }

  /**
   * 收集软件信息
   */
  async collectSoftwareInfo() {
    const software = {
      // 已安装的语言环境
      languages: {},
      
      // 包管理器
      packageManagers: {},
      
      // 开发工具
      devTools: {},
      
      // 运行时环境
      runtimes: {}
    };
    
    // 检查常见编程语言
    const languageChecks = [
      { name: 'Node.js', commands: ['node --version'] },
      { name: 'Python', commands: ['python --version', 'python3 --version'] },
      { name: 'Java', commands: ['java -version'] },
      { name: 'Go', commands: ['go version'] },
      { name: 'Rust', commands: ['rustc --version'] },
      { name: 'PHP', commands: ['php --version'] },
      { name: 'Ruby', commands: ['ruby --version'] },
      { name: 'Perl', commands: ['perl --version'] }
    ];
    
    for (const lang of languageChecks) {
      for (const cmd of lang.commands) {
        try {
          const { stdout } = await execPromise(cmd, { timeout: 3000 });
          software.languages[lang.name] = stdout.split('\n')[0].trim();
          break; // 找到一个就停止
        } catch (error) {
          // 继续尝试下一个命令
        }
      }
      if (!software.languages[lang.name]) {
        software.languages[lang.name] = '未安装';
      }
    }
    
    // 检查包管理器
    const pmChecks = [
      { name: 'npm', cmd: 'npm --version' },
      { name: 'yarn', cmd: 'yarn --version' },
      { name: 'pip', cmd: 'pip --version' },
      { name: 'brew', cmd: 'brew --version' },
      { name: 'apt', cmd: 'apt --version' },
      { name: 'yum', cmd: 'yum --version' },
      { name: 'docker', cmd: 'docker --version' },
      { name: 'kubectl', cmd: 'kubectl version --client' }
    ];
    
    for (const pm of pmChecks) {
      try {
        const { stdout } = await execPromise(pm.cmd, { timeout: 3000 });
        software.packageManagers[pm.name] = stdout.split('\n')[0].trim();
      } catch (error) {
        software.packageManagers[pm.name] = '未安装';
      }
    }
    
    // 检查开发工具
    const devChecks = [
      { name: 'Git', cmd: 'git --version' },
      { name: 'VSCode', cmd: 'code --version', windows: 'Code.exe' },
      { name: 'Vim', cmd: 'vim --version' },
      { name: 'SSH', cmd: 'ssh -V' },
      { name: 'Curl', cmd: 'curl --version' },
      { name: 'Wget', cmd: 'wget --version' }
    ];
    
    for (const tool of devChecks) {
      try {
        const { stdout } = await execPromise(tool.cmd, { timeout: 3000 });
        software.devTools[tool.name] = stdout.split('\n')[0].trim();
      } catch (error) {
        software.devTools[tool.name] = '未安装';
      }
    }
    
    // 检查PATH环境变量
    try {
      const pathEntries = process.env.PATH?.split(path.delimiter) || [];
      software.environment = {
        pathEntries: pathEntries.length,
        samplePaths: pathEntries.slice(0, 5)
      };
    } catch (error) {
      software.environment = { error: '无法读取PATH' };
    }
    
    return software;
  }

  /**
   * 收集网络信息
   */
  async collectNetworkInfo() {
    const interfaces = os.networkInterfaces();
    const network = {
      interfaces: {},
      dns: [],
      gateway: '未知',
      internet: '未知'
    };
    
    // 网络接口信息
    for (const [name, ifaceList] of Object.entries(interfaces)) {
      if (!Array.isArray(ifaceList)) continue;
      
      const ipv4 = ifaceList.find(i => i.family === 'IPv4' && !i.internal);
      const ipv6 = ifaceList.find(i => i.family === 'IPv6' && !i.internal);
      const mac = ifaceList.find(i => i.mac && i.mac !== '00:00:00:00:00:00');
      
      if (ipv4 || ipv6) {
        network.interfaces[name] = {
          ipv4: ipv4 ? {
            address: ipv4.address,
            netmask: ipv4.netmask,
            cidr: ipv4.cidr
          } : null,
          ipv6: ipv6 ? {
            address: ipv6.address,
            netmask: ipv6.netmask,
            cidr: ipv6.cidr
          } : null,
          mac: mac?.mac || '未知',
          internal: ifaceList.some(i => i.internal)
        };
      }
    }
    
    // DNS服务器
    try {
      if (this.platform === 'win32') {
        const dnsOutput = await execPromise('ipconfig /all | findstr "DNS Servers"').catch(() => ({ stdout: '' }));
        const dnsMatches = dnsOutput.stdout.match(/\d+\.\d+\.\d+\.\d+/g);
        if (dnsMatches) network.dns = [...new Set(dnsMatches)];
      } else {
        const dnsOutput = await execPromise('cat /etc/resolv.conf | grep nameserver').catch(() => ({ stdout: '' }));
        const dnsMatches = dnsOutput.stdout.match(/\d+\.\d+\.\d+\.\d+/g);
        if (dnsMatches) network.dns = dnsMatches;
      }
    } catch (error) {
      // 忽略DNS检查错误
    }
    
    // 默认网关
    try {
      if (this.platform === 'win32') {
        const route = await execPromise('route print 0.0.0.0').catch(() => ({ stdout: '' }));
        const gatewayMatch = route.stdout.match(/0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)/);
        if (gatewayMatch) network.gateway = gatewayMatch[1];
      } else {
        const route = await execPromise('ip route | grep default').catch(() => ({ stdout: '' }));
        const gatewayMatch = route.stdout.match(/default via (\d+\.\d+\.\d+\.\d+)/);
        if (gatewayMatch) network.gateway = gatewayMatch[1];
      }
    } catch (error) {
      // 忽略网关检查错误
    }
    
    // 网络连通性检查
    try {
      const pingTarget = this.platform === 'win32' ? '8.8.8.8' : '8.8.8.8';
      const ping = await execPromise(`ping -n 1 ${pingTarget}`, { timeout: 5000 }).catch(() => null);
      network.internet = ping ? '已连接' : '未连接';
    } catch (error) {
      network.internet = '检查失败';
    }
    
    return network;
  }

  /**
   * 收集用户信息
   */
  async collectUserInfo() {
    const user = os.userInfo();
    
    const userInfo = {
      username: user.username,
      uid: user.uid,
      gid: user.gid,
      home: user.homedir,
      shell: user.shell || '未知'
    };
    
    // 检查sudo权限
    try {
      if (this.platform === 'win32') {
        const netSession = await execPromise('net session >nul 2>&1 && echo 有管理员权限 || echo 无管理员权限');
        userInfo.isAdmin = netSession.stdout.includes('有管理员权限');
      } else {
        const sudoCheck = await execPromise('sudo -n true 2>&1 && echo 有sudo权限 || echo 无sudo权限');
        userInfo.hasSudo = sudoCheck.stdout.includes('有sudo权限');
      }
    } catch (error) {
      userInfo.permissionCheck = '检查失败';
    }
    
    // 检查最近登录
    try {
      if (this.platform !== 'win32') {
        const lastLogin = await execPromise('last -1').catch(() => ({ stdout: '' }));
        userInfo.lastLogin = lastLogin.stdout.split('\n')[0] || '未知';
      }
    } catch (error) {
      // 忽略登录检查错误
    }
    
    return userInfo;
  }

  /**
   * 收集存储信息
   */
  async collectStorageInfo() {
    const storage = {
      disks: [],
      total: '未知',
      free: '未知',
      usage: '未知'
    };
    
    try {
      if (this.platform === 'win32') {
        // Windows磁盘信息
        const wmic = await execPromise('wmic logicaldisk get size,freespace,caption');
        const lines = wmic.stdout.split('\r\n').filter(line => line.trim());
        
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(/\s+/).filter(p => p);
          if (parts.length >= 3) {
            const size = parseInt(parts[1]) || 0;
            const free = parseInt(parts[2]) || 0;
            const used = size - free;
            
            storage.disks.push({
              drive: parts[0],
              total: this.formatBytes(size),
              free: this.formatBytes(free),
              used: this.formatBytes(used),
              usage: size > 0 ? Math.round((used / size) * 100) + '%' : '0%'
            });
          }
        }
      } else {
        // Unix/Linux/macOS磁盘信息
        const df = await execPromise('df -h');
        const lines = df.stdout.split('\n').filter(line => line.trim());
        
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(/\s+/).filter(p => p);
          if (parts.length >= 6 && !parts[0].includes('tmpfs') && !parts[0].includes('udev')) {
            storage.disks.push({
              filesystem: parts[0],
              total: parts[1],
              used: parts[2],
              free: parts[3],
              usage: parts[4],
              mount: parts[5]
            });
          }
        }
      }
      
      // 计算总计
      if (storage.disks.length > 0) {
        const totals = storage.disks.reduce((acc, disk) => {
          // 简单统计，忽略不同单位的转换
          return acc;
        }, { total: 0, used: 0, free: 0 });
        
        storage.summary = `${storage.disks.length}个磁盘/分区`;
      }
      
    } catch (error) {
      console.warn('⚠️ 磁盘信息收集失败:', error.message);
      storage.error = error.message;
    }
    
    return storage;
  }

  /**
   * 获取平台名称（用户友好）
   */
  getPlatformName(platform) {
    const names = {
      'win32': 'Windows',
      'darwin': 'macOS',
      'linux': 'Linux',
      'aix': 'AIX',
      'freebsd': 'FreeBSD',
      'openbsd': 'OpenBSD',
      'sunos': 'SunOS',
      'android': 'Android'
    };
    return names[platform] || platform;
  }

  /**
   * 格式化运行时间
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (mins > 0) parts.push(`${mins}分钟`);
    
    return parts.length > 0 ? parts.join(' ') : '不到1分钟';
  }

  /**
   * 格式化负载平均值
   */
  formatLoadAverage(loadavg) {
    return loadavg.map(load => load.toFixed(2)).join(', ');
  }

  /**
   * 获取每个CPU的核心数
   */
  getCoresPerCPU(cpus) {
    if (!cpus || cpus.length === 0) return '未知';
    
    // 简单假设所有CPU核心数相同
    const cpuModel = cpus[0].model;
    const sameModelCPUs = cpus.filter(cpu => cpu.model === cpuModel);
    return sameModelCPUs.length > 0 ? Math.floor(cpus.length / sameModelCPUs.length) : '未知';
  }

  /**
   * 格式化字节大小
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 基本系统信息（备用方案）
   */
  collectBasicInfoFallback() {
    return {
      os: {
        platform: this.platform,
        hostname: os.hostname(),
        arch: os.arch()
      },
      runtime: {
        uptime: Math.floor(os.uptime()),
        freeMemory: Math.round(os.freemem() / 1024 / 1024) + ' MB'
      }
    };
  }

  /**
   * 生成用户友好的摘要
   */
  generateUserFriendlySummary() {
    console.log('\n📱 您的设备信息摘要:');
    console.log('='.repeat(40));
    
    if (this.results.os) {
      console.log(`💻 电脑类型: ${this.results.os.platformName} (${this.results.os.arch})`);
      console.log(`🏷️ 系统版本: ${this.results.os.release}`);
      console.log(`🖥️ 主机名称: ${this.results.os.hostname}`);
    }
    
    if (this.results.runtime) {
      console.log(`⏰ 运行时间: ${this.results.runtime.uptimeHuman}`);
      console.log(`🧠 内存使用: ${this.results.runtime.memoryUsage} (${this.results.runtime.freeMemory}MB 可用)`);
    }
    
    if (this.results.hardware?.cpu) {
      console.log(`⚡ 处理器: ${this.results.hardware.cpu.model}`);
      console.log(`🔢 CPU核心: ${this.results.hardware.cpu.count}个`);
    }
    
    if (this.results.network?.internet) {
      console.log(`🌐 网络状态: ${this.results.network.internet}`);
      const iface = Object.values(this.results.network.interfaces || {})[0];
      if (iface?.ipv4?.address) {
        console.log(`📡 IP地址: ${iface.ipv4.address}`);
      }
    }
    
    if (this.results.software?.languages) {
      const langs = Object.entries(this.results.software.languages)
        .filter(([_, v]) => v !== '未安装')
        .map(([k, v]) => k)
        .slice(0, 3);
      if (langs.length > 0) {
        console.log(`💾 已安装: ${langs.join(', ')}...`);
      }
    }
    
    console.log('='.repeat(40));
  }

  /**
   * 获取详细报告
   */
  getDetailedReport() {
    return this.results;
  }

  /**
   * 保存报告到文件
   */
  async saveReport(filePath = './device-info-report.json') {
    try {
      await fs.writeJson(filePath, this.results, { spaces: 2 });
      console.log(`✅ 设备信息报告已保存到: ${path.resolve(filePath)}`);
      return true;
    } catch (error) {
      console.error('❌ 保存报告失败:', error.message);
      return false;
    }
  }
}

module.exports = DeviceCollector;