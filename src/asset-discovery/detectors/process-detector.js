/**
 * 进程检测器
 * 专门检测运行中的非安装式程序进程
 */

const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class ProcessDetector {
  constructor() {
    this.platform = os.platform();
    this.processCache = null;
  }

  /**
   * 检测运行中的非安装式程序
   */
  async detectNonInstalledPrograms(fingerprints) {
    const results = [];
    
    try {
      // 获取所有进程
      const processes = await this.getAllProcesses();
      
      // 对每个指纹进行匹配
      for (const [programName, fingerprint] of Object.entries(fingerprints)) {
        const detected = await this.matchProcessAgainstFingerprint(
          processes, 
          programName, 
          fingerprint
        );
        
        if (detected) {
          results.push(detected);
        }
      }
      
      return results;
      
    } catch (error) {
      console.warn(`⚠️ 进程检测失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取所有进程（跨平台）
   */
  async getAllProcesses() {
    if (this.processCache) {
      return this.processCache;
    }
    
    let processes = [];
    
    try {
      if (this.platform === 'win32') {
        processes = await this.getWindowsProcesses();
      } else {
        processes = await this.getUnixProcesses();
      }
      
      // 缓存结果
      this.processCache = processes;
      return processes;
      
    } catch (error) {
      console.warn(`无法获取进程列表: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取Windows进程
   */
  async getWindowsProcesses() {
    const command = `wmic process get ProcessId,Name,CommandLine,ExecutablePath /format:csv`;
    const { stdout } = await execPromise(command, { timeout: 10000 });
    
    const processes = [];
    const lines = stdout.split('\r\n').filter(line => line.trim());
    
    // 跳过标题行
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 4) {
        processes.push({
          pid: parseInt(parts[1]) || 0,
          name: parts[2] || '',
          cmd: parts[3] || '',
          path: parts[4] || '',
          user: 'SYSTEM' // Windows默认
        });
      }
    }
    
    return processes;
  }

  /**
   * 获取Unix/Linux/macOS进程
   */
  async getUnixProcesses() {
    // 使用ps命令获取详细进程信息
    const command = `ps aux --no-headers`;
    const { stdout } = await execPromise(command, { timeout: 10000 });
    
    const processes = [];
    const lines = stdout.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        processes.push({
          user: parts[0],
          pid: parseInt(parts[1]) || 0,
          cpu: parseFloat(parts[2]) || 0,
          mem: parseFloat(parts[3]) || 0,
          vsz: parseInt(parts[4]) || 0,
          rss: parseInt(parts[5]) || 0,
          tty: parts[6],
          stat: parts[7],
          start: parts[8],
          time: parts[9],
          cmd: parts.slice(10).join(' '),
          name: parts[10] || ''
        });
      }
    }
    
    return processes;
  }

  /**
   * 匹配进程和指纹
   */
  async matchProcessAgainstFingerprint(processes, programName, fingerprint) {
    let bestMatch = null;
    let highestConfidence = 0;
    
    for (const proc of processes) {
      let confidence = 0;
      const matchDetails = [];
      
      // 1. 进程名匹配（权重：40%）
      if (fingerprint.processNames && proc.name) {
        const nameMatch = fingerprint.processNames.some(name => 
          proc.name.toLowerCase().includes(name.toLowerCase())
        );
        if (nameMatch) {
          confidence += 40;
          matchDetails.push('进程名匹配');
        }
      }
      
      // 2. 命令行匹配（权重：30%）
      if (fingerprint.cmdlinePatterns && proc.cmd) {
        const cmdMatch = fingerprint.cmdlinePatterns.some(pattern =>
          proc.cmd.toLowerCase().includes(pattern.toLowerCase())
        );
        if (cmdMatch) {
          confidence += 30;
          matchDetails.push('命令行匹配');
        }
      }
      
      // 3. 路径匹配（权重：20%）
      if (fingerprint.directoryPatterns && proc.path) {
        const homeDir = os.homedir();
        const pathMatch = fingerprint.directoryPatterns.some(pattern => {
          const dirPath = pattern.replace('~', homeDir);
          return proc.path.toLowerCase().includes(dirPath.toLowerCase());
        });
        if (pathMatch) {
          confidence += 20;
          matchDetails.push('路径匹配');
        }
      }
      
      // 4. 端口匹配（权重：10%）
      if (fingerprint.defaultPorts && proc.pid) {
        const openPorts = await this.getProcessPorts(proc.pid);
        const portMatch = fingerprint.defaultPorts.some(port => 
          openPorts.includes(port)
        );
        if (portMatch) {
          confidence += 10;
          matchDetails.push('端口匹配');
        }
      }
      
      // 记录最佳匹配
      if (confidence > highestConfidence && confidence >= 30) {
        highestConfidence = confidence;
        bestMatch = {
          program: programName,
          confidence: this.getConfidenceLevel(confidence),
          detectedBy: matchDetails,
          details: {
            pid: proc.pid,
            name: proc.name,
            command: this.truncateString(proc.cmd, 100),
            user: proc.user || '未知',
            cpu: proc.cpu || 0,
            memory: proc.mem ? `${proc.mem}%` : '未知',
            ports: fingerprint.defaultPorts || []
          }
        };
      }
    }
    
    return bestMatch;
  }

  /**
   * 获取进程监听的端口
   */
  async getProcessPorts(pid) {
    try {
      let command;
      if (this.platform === 'win32') {
        command = `netstat -ano | findstr : | findstr ${pid}`;
      } else {
        command = `lsof -Pan -p ${pid} -i 2>/dev/null || ss -tulpn 2>/dev/null | grep ${pid}`;
      }
      
      const { stdout } = await execPromise(command, { timeout: 5000 });
      const ports = this.extractPortsFromOutput(stdout);
      return ports;
      
    } catch (error) {
      return [];
    }
  }

  /**
   * 从输出中提取端口号
   */
  extractPortsFromOutput(output) {
    const ports = [];
    const portRegex = /:(\d+)/g;
    let match;
    
    while ((match = portRegex.exec(output)) !== null) {
      const port = parseInt(match[1]);
      if (port > 0 && port <= 65535 && !ports.includes(port)) {
        ports.push(port);
      }
    }
    
    return ports;
  }

  /**
   * 根据分数获取可信度等级
   */
  getConfidenceLevel(score) {
    if (score >= 80) return '高';
    if (score >= 50) return '中';
    return '低';
  }

  /**
   * 截断字符串
   */
  truncateString(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
  }

  /**
   * 获取特定程序的进程信息
   */
  async getProgramProcesses(programName) {
    const processes = await this.getAllProcesses();
    const searchName = programName.toLowerCase();
    
    return processes.filter(proc => 
      (proc.name && proc.name.toLowerCase().includes(searchName)) ||
      (proc.cmd && proc.cmd.toLowerCase().includes(searchName))
    );
  }

  /**
   * 检查进程是否健康运行
   */
  async checkProcessHealth(pid) {
    try {
      let command;
      if (this.platform === 'win32') {
        command = `tasklist /FI "PID eq ${pid}"`;
      } else {
        command = `ps -p ${pid} -o pid,stat,pcpu,pmem,cmd`;
      }
      
      const { stdout } = await execPromise(command, { timeout: 3000 });
      
      if (stdout.includes(pid.toString())) {
        return {
          status: '运行中',
          details: this.parseProcessHealthOutput(stdout)
        };
      } else {
        return {
          status: '未运行',
          details: {}
        };
      }
      
    } catch (error) {
      return {
        status: '检查失败',
        details: { error: error.message }
      };
    }
  }

  /**
   * 解析进程健康检查输出
   */
  parseProcessHealthOutput(output) {
    const lines = output.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return {};
    }
    
    const dataLine = lines[1];
    const parts = dataLine.trim().split(/\s+/);
    
    if (this.platform === 'win32') {
      return {
        name: parts[0] || '',
        pid: parts[1] || '',
        sessionName: parts[2] || '',
        sessionNumber: parts[3] || '',
        memUsage: parts[4] || ''
      };
    } else {
      return {
        pid: parts[0] || '',
        stat: parts[1] || '',
        cpu: parts[2] ? `${parts[2]}%` : '0%',
        memory: parts[3] ? `${parts[3]}%` : '0%',
        command: parts.slice(4).join(' ') || ''
      };
    }
  }

  /**
   * 清理进程缓存
   */
  clearCache() {
    this.processCache = null;
  }
}

module.exports = ProcessDetector;