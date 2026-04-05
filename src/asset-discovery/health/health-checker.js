/**
 * 环境健康状态检测器
 * 检查系统环境是否健康，发现问题并提供建议
 * 设计目标：让编程小白也能看懂的健康检查结果
 */

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class HealthChecker {
  constructor() {
    this.platform = os.platform();
    this.homeDir = os.homedir();
    this.results = {
      score: 100, // 健康分数（0-100）
      level: '优秀', // 健康等级
      checks: {},
      issues: [],
      recommendations: [],
      warnings: [],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 执行完整的健康检查
   */
  async checkAll() {
    console.log('🏥 正在检查系统健康状态...');
    console.log('📋 检查项目:');
    console.log('  • ✅ 系统资源使用情况');
    console.log('  • ✅ 网络连接状态');
    console.log('  • ✅ 磁盘空间和健康状况');
    console.log('  • ✅ 软件环境完整性');
    console.log('  • ✅ 安全配置检查');
    console.log('  • ✅ 性能优化建议');
    console.log('');
    
    try {
      // 并行执行各项检查
      const [
        resourceHealth,
        networkHealth,
        diskHealth,
        softwareHealth,
        securityHealth,
        performanceHealth
      ] = await Promise.all([
        this.checkResources(),
        this.checkNetwork(),
        this.checkDisk(),
        this.checkSoftware(),
        this.checkSecurity(),
        this.checkPerformance()
      ]);
      
      // 合并检查结果
      this.results.checks = {
        resources: resourceHealth,
        network: networkHealth,
        disk: diskHealth,
        software: softwareHealth,
        security: securityHealth,
        performance: performanceHealth
      };
      
      // 计算总体健康分数
      this.calculateOverallHealth();
      
      // 生成用户友好的报告
      this.generateUserFriendlyReport();
      
      return this.results;
      
    } catch (error) {
      console.error('❌ 健康检查失败:', error.message);
      this.results.error = error.message;
      this.results.score = 0;
      this.results.level = '检查失败';
      return this.results;
    }
  }

  /**
   * 检查系统资源
   */
  async checkResources() {
    const check = {
      name: '系统资源',
      status: '正常',
      details: {},
      issues: [],
      score: 100
    };
    
    try {
      // CPU负载检查
      const loadavg = os.loadavg();
      const cpuCount = os.cpus().length;
      const currentLoad = (loadavg[0] / cpuCount) * 100;
      
      check.details.cpu = {
        cores: cpuCount,
        load1min: loadavg[0].toFixed(2),
        load5min: loadavg[1].toFixed(2),
        load15min: loadavg[2].toFixed(2),
        currentLoad: currentLoad.toFixed(1) + '%',
        loadPerCore: (loadavg[0] / cpuCount).toFixed(2)
      };
      
      if (currentLoad > 90) {
        check.score -= 30;
        check.issues.push('CPU负载过高（超过90%）');
        check.details.cpu.status = '危险';
      } else if (currentLoad > 70) {
        check.score -= 15;
        check.issues.push('CPU负载较高（超过70%）');
        check.details.cpu.status = '警告';
      } else {
        check.details.cpu.status = '正常';
      }
      
      // 内存检查
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsage = (usedMem / totalMem) * 100;
      
      check.details.memory = {
        total: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10 + ' GB',
        free: Math.round(freeMem / 1024 / 1024 / 1024 * 10) / 10 + ' GB',
        used: Math.round(usedMem / 1024 / 1024 / 1024 * 10) / 10 + ' GB',
        usage: memoryUsage.toFixed(1) + '%',
        available: Math.round(freeMem / totalMem * 100) + '%'
      };
      
      if (memoryUsage > 90) {
        check.score -= 30;
        check.issues.push('内存使用率过高（超过90%）');
        check.details.memory.status = '危险';
        check.recommendations = ['关闭不需要的程序释放内存'];
      } else if (memoryUsage > 80) {
        check.score -= 20;
        check.issues.push('内存使用率较高（超过80%）');
        check.details.memory.status = '警告';
        check.recommendations = ['建议清理内存或关闭部分程序'];
      } else if (freeMem < 1024 * 1024 * 1024) { // 小于1GB
        check.score -= 15;
        check.issues.push('可用内存不足（小于1GB）');
        check.details.memory.status = '警告';
      } else {
        check.details.memory.status = '正常';
      }
      
      // 交换空间检查（Linux/macOS）
      if (this.platform !== 'win32') {
        try {
          const swapInfo = await execPromise('free -h | grep Swap').catch(() => ({ stdout: '' }));
          if (swapInfo.stdout) {
            const parts = swapInfo.stdout.split(/\s+/).filter(p => p);
            if (parts.length >= 4) {
              check.details.swap = {
                total: parts[1],
                used: parts[2],
                free: parts[3],
                usage: parts[2] !== '0B' ? '使用中' : '未使用'
              };
              
              if (parts[2] !== '0B' && parts[2] !== '0') {
                check.score -= 10;
                check.issues.push('系统正在使用交换空间，可能内存不足');
              }
            }
          }
        } catch (error) {
          // 忽略交换空间检查错误
        }
      }
      
      // 更新状态
      if (check.score < 70) {
        check.status = '异常';
      } else if (check.score < 85) {
        check.status = '警告';
      }
      
      return check;
      
    } catch (error) {
      check.status = '检查失败';
      check.error = error.message;
      check.score = 0;
      return check;
    }
  }

  /**
   * 检查网络连接
   */
  async checkNetwork() {
    const check = {
      name: '网络连接',
      status: '正常',
      details: {},
      issues: [],
      score: 100
    };
    
    try {
      // 本地网络接口检查
      const interfaces = os.networkInterfaces();
      const activeInterfaces = [];
      
      for (const [name, ifaceList] of Object.entries(interfaces)) {
        if (!Array.isArray(ifaceList)) continue;
        
        const ipv4 = ifaceList.find(i => i.family === 'IPv4' && !i.internal);
        if (ipv4) {
          activeInterfaces.push({
            name,
            address: ipv4.address,
            status: '活动'
          });
        }
      }
      
      check.details.interfaces = activeInterfaces;
      check.details.interfaceCount = activeInterfaces.length;
      
      if (activeInterfaces.length === 0) {
        check.score -= 40;
        check.issues.push('未检测到活动的网络接口');
        check.status = '异常';
      }
      
      // DNS检查
      try {
        let dnsServers = [];
        if (this.platform === 'win32') {
          const dnsOutput = await execPromise('ipconfig /all | findstr "DNS Servers"').catch(() => ({ stdout: '' }));
          const matches = dnsOutput.stdout.match(/\d+\.\d+\.\d+\.\d+/g);
          if (matches) dnsServers = [...new Set(matches)];
        } else {
          const dnsOutput = await execPromise('cat /etc/resolv.conf 2>/dev/null | grep nameserver').catch(() => ({ stdout: '' }));
          const matches = dnsOutput.stdout.match(/\d+\.\d+\.\d+\.\d+/g);
          if (matches) dnsServers = matches;
        }
        
        check.details.dns = {
          servers: dnsServers,
          count: dnsServers.length
        };
        
        if (dnsServers.length === 0) {
          check.score -= 20;
          check.issues.push('未配置DNS服务器');
        }
      } catch (error) {
        check.details.dns = { error: '检查失败' };
      }
      
      // 互联网连通性检查
      try {
        const pingTarget = '8.8.8.8'; // Google DNS
        let pingCommand;
        
        if (this.platform === 'win32') {
          pingCommand = `ping -n 1 -w 1000 ${pingTarget}`;
        } else {
          pingCommand = `ping -c 1 -W 1 ${pingTarget}`;
        }
        
        await execPromise(pingCommand, { timeout: 3000 });
        check.details.internet = '已连接';
        
        // 检查网页访问
        try {
          await execPromise('curl -s --connect-timeout 3 https://www.baidu.com > /dev/null', { timeout: 5000 });
          check.details.webAccess = '正常';
        } catch (error) {
          check.details.webAccess = '受限';
          check.score -= 10;
          check.issues.push('网页访问可能受限');
        }
        
      } catch (error) {
        check.details.internet = '未连接';
        check.score -= 30;
        check.issues.push('无法连接到互联网');
        check.status = '异常';
      }
      
      // 端口检查（检查常见服务端口）
      try {
        let portCheckCommand;
        if (this.platform === 'win32') {
          portCheckCommand = 'netstat -an | findstr :80 | findstr LISTENING';
        } else {
          portCheckCommand = 'netstat -tuln 2>/dev/null | grep :80 || ss -tuln 2>/dev/null | grep :80';
        }
        
        const portOutput = await execPromise(portCheckCommand).catch(() => ({ stdout: '' }));
        check.details.httpPort = portOutput.stdout.includes(':80') ? '已占用' : '空闲';
      } catch (error) {
        check.details.portCheck = '检查失败';
      }
      
      // 更新状态
      if (check.score < 70) {
        check.status = '异常';
      } else if (check.score < 85) {
        check.status = '警告';
      }
      
      return check;
      
    } catch (error) {
      check.status = '检查失败';
      check.error = error.message;
      check.score = 0;
      return check;
    }
  }

  /**
   * 检查磁盘状态
   */
  async checkDisk() {
    const check = {
      name: '磁盘状态',
      status: '正常',
      details: {},
      issues: [],
      score: 100
    };
    
    try {
      let diskInfo;
      
      if (this.platform === 'win32') {
        // Windows磁盘信息
        const wmic = await execPromise('wmic logicaldisk get size,freespace,caption,filesystem /format:csv');
        diskInfo = this.parseWindowsDiskInfo(wmic.stdout);
      } else {
        // Unix/Linux/macOS磁盘信息
        const df = await execPromise('df -h');
        diskInfo = this.parseUnixDiskInfo(df.stdout);
      }
      
      check.details.disks = diskInfo.disks;
      check.details.summary = diskInfo.summary;
      
      // 检查磁盘问题
      for (const disk of diskInfo.disks) {
        if (disk.usage && disk.usage.includes('%')) {
          const usage = parseInt(disk.usage);
          
          if (usage > 95) {
            check.score -= 40;
            check.issues.push(`磁盘 ${disk.drive || disk.mount} 使用率超过95%（${disk.usage}）`);
            check.status = '危险';
            check.recommendations = [`立即清理 ${disk.drive || disk.mount} 磁盘空间`];
          } else if (usage > 90) {
            check.score -= 25;
            check.issues.push(`磁盘 ${disk.drive || disk.mount} 使用率超过90%（${disk.usage}）`);
            check.status = '警告';
            check.recommendations = [`建议清理 ${disk.drive || disk.mount} 磁盘空间`];
          } else if (usage > 80) {
            check.score -= 10;
            check.issues.push(`磁盘 ${disk.drive || disk.mount} 使用率较高（${disk.usage}）`);
            if (check.status === '正常') check.status = '注意';
          }
        }
      }
      
      // 检查磁盘健康（Linux only）
      if (this.platform === 'linux' && diskInfo.disks.length > 0) {
        try {
          const smartctl = await execPromise('which smartctl').catch(() => ({ stdout: '' }));
          if (smartctl.stdout.trim()) {
            check.details.smartAvailable = true;
            // 可以添加SMART检查
          }
        } catch (error) {
          // 忽略
        }
      }
      
      // 检查临时文件
      try {
        const tmpDir = os.tmpdir();
        const tmpStats = await fs.stat(tmpDir).catch(() => null);
        if (tmpStats) {
          check.details.tempDir = {
            path: tmpDir,
            exists: true,
            writable: await this.isWritable(tmpDir)
          };
          
          if (!check.details.tempDir.writable) {
            check.score -= 15;
            check.issues.push('临时目录不可写，可能影响程序运行');
          }
        }
      } catch (error) {
        check.details.tempDir = { error: error.message };
      }
      
      // 更新状态
      if (check.score < 70) {
        check.status = '异常';
      } else if (check.score < 85) {
        check.status = '警告';
      }
      
      return check;
      
    } catch (error) {
      check.status = '检查失败';
      check.error = error.message;
      check.score = 0;
      return check;
    }
  }

  /**
   * 解析Windows磁盘信息
   */
  parseWindowsDiskInfo(output) {
    const disks = [];
    const lines = output.split('\r\n').filter(line => line.trim());
    
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 5) {
        const size = parseInt(parts[2]) || 0;
        const free = parseInt(parts[3]) || 0;
        const used = size - free;
        const usage = size > 0 ? Math.round((used / size) * 100) : 0;
        
        disks.push({
          drive: parts[1],
          filesystem: parts[4] || '未知',
          total: this.formatBytes(size),
          free: this.formatBytes(free),
          used: this.formatBytes(used),
          usage: usage + '%'
        });
      }
    }
    
    return {
      disks,
      summary: `${disks.length}个磁盘`
    };
  }

  /**
   * 解析Unix磁盘信息
   */
  parseUnixDiskInfo(output) {
    const disks = [];
    const lines = output.split('\n').filter(line => line.trim());
    
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/).filter(p => p);
      if (parts.length >= 6 && !parts[0].includes('tmpfs') && !parts[0].includes('udev')) {
        disks.push({
          filesystem: parts[0],
          total: parts[1],
          used: parts[2],
          free: parts[3],
          usage: parts[4],
          mount: parts[5]
        });
      }
    }
    
    return {
      disks,
      summary: `${disks.length}个挂载点`
    };
  }

  /**
   * 检查目录是否可写
   */
  async isWritable(dirPath) {
    try {
      const testFile = path.join(dirPath, `.test-write-${Date.now()}`);
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      return true;
    } catch (error) {
      return false;
    }
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
   * 检查软件环境
   */
  async checkSoftware() {
    const check = {
      name: '软件环境',
      status: '正常',
      details: {},
      issues: [],
      score: 100
    };
    
    try {
      // 检查Node.js版本
      const nodeVersion = process.version;
      const nodeMajor = parseInt(nodeVersion.replace('v', '').split('.')[0]);
      
      check.details.nodejs = {
        version: nodeVersion,
        major: nodeMajor,
        status: nodeMajor >= 16 ? '正常' : '过时'
      };
      
      if (nodeMajor < 16) {
        check.score -= 20;
        check.issues.push(`Node.js版本过旧（${nodeVersion}），建议升级到v16+`);
        check.recommendations = ['升级Node.js到最新LTS版本'];
      }
      
      // 检查npm/yarn
      try {
        const npmVersion = await execPromise('npm --version').catch(() => ({ stdout: '未安装' }));
        check.details.npm = npmVersion.stdout.trim();
      } catch (error) {
        check.details.npm = '未安装';
      }
      
      // 检查Python
      try {
        const pythonVersion = await execPromise('python3 --version 2>/dev/null || python --version').catch(() => ({ stdout: '' }));
        check.details.python = pythonVersion.stdout.trim() || '未安装';
      } catch (error) {
        check.details.python = '未安装';
      }
      
      // 检查Git
      try {
        const gitVersion = await execPromise('git --version').catch(() => ({ stdout: '未安装' }));
        check.details.git = gitVersion.stdout.trim();
        
        if (check.details.git === '未安装') {
          check.score -= 10;
          check.issues.push('Git未安装，影响版本控制功能');
        }
      } catch (error) {
        check.details.git = '未安装';
      }
      
      // 检查Docker
      try {
        const dockerVersion = await execPromise('docker --version').catch(() => ({ stdout: '未安装' }));
        check.details.docker = dockerVersion.stdout.trim();
      } catch (error) {
        check.details.docker = '未安装';
      }
      
      // 检查PATH环境变量
      const pathEntries = process.env.PATH?.split(path.delimiter) || [];
      check.details.path = {
        entries: pathEntries.length,
        hasDuplicates: new Set(pathEntries).size !== pathEntries.length
      };
      
      if (check.details.path.hasDuplicates) {
        check.score -= 5;
        check.issues.push('PATH环境变量存在重复项');
      }
      
      // 更新状态
      if (check.score < 85) {
        check.status = '警告';
      }
      
      return check;
      
    } catch (error) {
      check.status = '检查失败';
      check.error = error.message;
      check.score = 50;
      return check;
    }
  }

  /**
   * 检查安全配置
   */
  async checkSecurity() {
    const check = {
      name: '安全配置',
      status: '正常',
      details: {},
      issues: [],
      score: 100
    };
    
    try {
      // 检查用户权限
      const userInfo = os.userInfo();
      check.details.user = {
        username: userInfo.username,
        uid: userInfo.uid,
        home: userInfo.homedir
      };
      
      // 检查文件权限（仅Unix）
      if (this.platform !== 'win32') {
        try {
          // 检查home目录权限
          const homeStat = await fs.stat(userInfo.homedir);
          const homeMode = homeStat.mode.toString(8);
          check.details.homePermissions = homeMode.slice(-3);
          
          if (parseInt(check.details.homePermissions) > 755) {
            check.score -= 15;
            check.issues.push('Home目录权限过宽，可能存在安全风险');
          }
        } catch (error) {
          // 忽略权限检查错误
        }
      }
      
      // 检查防火墙（简单检查）
      try {
        if (this.platform === 'win32') {
          const firewall = await execPromise('netsh advfirewall show allprofiles state').catch(() => ({ stdout: '' }));
          check.details.firewall = firewall.stdout.includes('ON') ? '已启用' : '未启用';
        } else if (this.platform === 'darwin') {
          const firewall = await execPromise('defaults read /Library/Preferences/com.apple.alf globalstate').catch(() => ({ stdout: '' }));
          check.details.firewall = firewall.stdout.trim() === '1' ? '已启用' : '未启用';
        } else {
          const firewall = await execPromise('sudo ufw status 2>/dev/null | head -1').catch(() => ({ stdout: '' }));
          check.details.firewall = firewall.stdout.includes('active') ? '已启用' : '未启用';
        }
        
        if (check.details.firewall === '未启用') {
          check.score -= 20;
          check.issues.push('防火墙未启用，建议开启以提高安全性');
        }
      } catch (error) {
        check.details.firewall = '检查失败';
      }
      
      // 检查系统更新（简单提示）
      check.details.updates = '建议定期检查系统更新';
      
      // 更新状态
      if (check.score < 80) {
        check.status = '警告';
      }
      
      return check;
      
    } catch (error) {
      check.status = '检查失败';
      check.error = error.message;
      check.score = 50;
      return check;
    }
  }

  /**
   * 检查性能优化
   */
  async checkPerformance() {
    const check = {
      name: '性能优化',
      status: '正常',
      details: {},
      issues: [],
      recommendations: [],
      score: 100
    };
    
    try {
      // 检查系统启动时间（Unix）
      if (this.platform !== 'win32') {
        try {
          const uptime = os.uptime();
          const days = Math.floor(uptime / 86400);
          
          check.details.uptimeDays = days;
          check.details.uptime = this.formatUptime(uptime);
          
          if (days > 30) {
            check.score -= 15;
            check.issues.push(`系统已运行${days}天未重启，建议定期重启`);
            check.recommendations.push('考虑在合适时间重启系统');
          }
        } catch (error) {
          // 忽略
        }
      }
      
      // 检查浏览器缓存（简单提示）
      check.details.browserCache = '建议定期清理浏览器缓存';
      
      // 检查临时文件
      try {
        const tmpDir = os.tmpdir();
        const tmpFiles = await fs.readdir(tmpDir).catch(() => []);
        check.details.tempFiles = tmpFiles.length;
        
        if (tmpFiles.length > 1000) {
          check.score -= 10;
          check.issues.push(`临时目录文件过多（${tmpFiles.length}个），可能影响性能`);
          check.recommendations.push('清理临时文件');
        }
      } catch (error) {
        check.details.tempFiles = '检查失败';
      }
      
      // 通用优化建议
      check.recommendations.push(
        '定期重启电脑保持系统流畅',
        '清理不需要的浏览器扩展',
        '禁用不必要的开机启动项',
        '使用SSD硬盘提升系统响应速度'
      );
      
      // 更新状态
      if (check.score < 90) {
        check.status = '注意';
      }
      
      return check;
      
    } catch (error) {
      check.status = '检查失败';
      check.error = error.message;
      check.score = 70;
      return check;
    }
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
   * 计算总体健康分数
   */
  calculateOverallHealth() {
    const checks = this.results.checks;
    let totalScore = 0;
    let checkCount = 0;
    
    for (const [name, check] of Object.entries(checks)) {
      if (check.score !== undefined) {
        totalScore += check.score;
        checkCount++;
      }
      
      // 收集所有问题和建议
      if (check.issues && check.issues.length > 0) {
        this.results.issues.push(...check.issues.map(issue => `${name}: ${issue}`));
      }
      
      if (check.recommendations && check.recommendations.length > 0) {
        this.results.recommendations.push(...check.recommendations.map(rec => `${name}: ${rec}`));
      }
      
      if (check.status === '警告' || check.status === '异常') {
        this.results.warnings.push(`${name}: ${check.status}`);
      }
    }
    
    // 计算平均分
    if (checkCount > 0) {
      this.results.score = Math.round(totalScore / checkCount);
    }
    
    // 确定健康等级
    if (this.results.score >= 90) {
      this.results.level = '优秀';
    } else if (this.results.score >= 80) {
      this.results.level = '良好';
    } else if (this.results.score >= 70) {
      this.results.level = '一般';
    } else if (this.results.score >= 60) {
      this.results.level = '需关注';
    } else {
      this.results.level = '需立即处理';
    }
    
    // 去重
    this.results.issues = [...new Set(this.results.issues)];
    this.results.recommendations = [...new Set(this.results.recommendations)];
    this.results.warnings = [...new Set(this.results.warnings)];
  }

  /**
   * 生成用户友好的报告
   */
  generateUserFriendlyReport() {
    console.log('\n' + '⭐'.repeat(25));
    console.log('🏆 系统健康检查报告');
    console.log('⭐'.repeat(25));
    
    console.log(`\n📊 总体健康评分: ${this.results.score}/100`);
    console.log(`🏅 健康等级: ${this.results.level}`);
    console.log(`🕒 检查时间: ${new Date(this.results.timestamp).toLocaleString('zh-CN')}`);
    
    // 各项目检查结果
    console.log('\n🔍 各项检查结果:');
    for (const [name, check] of Object.entries(this.results.checks)) {
      const emoji = check.score >= 90 ? '✅' : check.score >= 80 ? '⚠️' : '❌';
      console.log(`  ${emoji} ${name}: ${check.status} (${check.score}分)`);
    }
    
    // 发现的问题
    if (this.results.issues.length > 0) {
      console.log('\n🚨 发现的问题:');
      this.results.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    } else {
      console.log('\n✅ 很棒！没有发现严重问题');
    }
    
    // 建议
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 优化建议:');
      this.results.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
      
      if (this.results.recommendations.length > 5) {
        console.log(`  ... 还有${this.results.recommendations.length - 5}条建议`);
      }
    }
    
    // 给新手的简单建议
    console.log('\n📚 给新手朋友的提示:');
    console.log('  1. 🌟 分数80分以上表示系统健康');
    console.log('  2. 🔧 发现问题可以按建议尝试解决');
    console.log('  3. 🆘 不确定的问题可以请教懂的朋友');
    console.log('  4. 📅 建议每月检查一次系统健康');
    
    console.log('\n' + '🎯'.repeat(25));
    console.log('✅ 健康检查完成！保持系统健康，工作更顺畅！');
    console.log('🎯'.repeat(25));
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
  async saveReport(filePath = './health-check-report.json') {
    try {
      await fs.writeJson(filePath, this.results, { spaces: 2 });
      console.log(`✅ 健康检查报告已保存到: ${path.resolve(filePath)}`);
      return true;
    } catch (error) {
      console.error('❌ 保存报告失败:', error.message);
      return false;
    }
  }
}

module.exports = HealthChecker;