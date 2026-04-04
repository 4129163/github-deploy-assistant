/**
 * 端口占用修复器
 */

const BaseFixer = require('./BaseFixer');

class PortFixer extends BaseFixer {
  constructor() {
    super();
    this.name = 'PortFixer';
    this.description = '端口占用修复器';
    this.supportedIssueTypes = ['port_occupied'];
  }

  /**
   * 修复端口占用问题
   * @param {Object} issue 问题对象
   * @param {Object} context 修复上下文
   * @returns {Promise<Object>} 修复结果
   */
  async fix(issue, context) {
    const startTime = new Date().toISOString();
    const { port, protocol, processInfo } = issue.data;

    try {
      // 第一步：获取详细的进程信息
      const detailedProcessInfo = await this.getDetailedProcessInfo(port, protocol);
      
      // 第二步：根据用户选择执行修复
      // 这里我们提供多种修复选项，实际实现时需要根据用户选择执行
      const fixOptions = this.generateFixOptions(port, protocol, detailedProcessInfo);
      
      // 第三步：执行修复
      const fixResult = await this.executeFix(fixOptions, context);
      
      // 第四步：验证修复
      const isFixed = await this.verifyFix(issue, context);
      
      return {
        success: isFixed,
        startTime,
        endTime: new Date().toISOString(),
        message: isFixed ? `端口 ${port} 已释放` : `无法释放端口 ${port}`,
        details: {
          port,
          protocol,
          originalProcessInfo: processInfo,
          detailedProcessInfo,
          fixOptions,
          fixResult,
          verificationResult: isFixed
        },
        warnings: fixResult.warnings || [],
        requiresRestart: fixResult.requiresRestart || false,
        requiresConfirmation: true // 端口修复需要用户确认
      };

    } catch (error) {
      return {
        success: false,
        startTime,
        endTime: new Date().toISOString(),
        message: `修复端口 ${port} 失败: ${error.message}`,
        details: { error: error.message },
        requiresConfirmation: false
      };
    }
  }

  /**
   * 获取详细的进程信息
   * @param {number} port 端口
   * @param {string} protocol 协议
   * @returns {Promise<Object>} 进程信息
   */
  async getDetailedProcessInfo(port, protocol) {
    try {
      // 根据不同平台获取进程信息
      let command;
      if (process.platform === 'win32') {
        // Windows: 使用 netstat 和 tasklist
        command = `netstat -ano | findstr :${port}`;
        const { stdout } = await this.safeExec(command);
        
        if (!stdout) {
          return { found: false, message: '未找到占用端口的进程' };
        }

        // 解析输出，获取PID
        const lines = stdout.split('\n').filter(line => line.trim());
        const pids = new Set();
        
        lines.forEach(line => {
          const match = line.match(/\s+(\d+)\s*$/);
          if (match) {
            pids.add(match[1]);
          }
        });

        // 获取进程详细信息
        const processDetails = [];
        for (const pid of pids) {
          const tasklistCmd = `tasklist /FI "PID eq ${pid}" /FO CSV`;
          const { stdout: tasklistOutput } = await this.safeExec(tasklistCmd);
          
          if (tasklistOutput && tasklistOutput.includes(pid)) {
            const lines = tasklistOutput.split('\n');
            if (lines.length > 1) {
              const parts = lines[1].split('","').map(p => p.replace(/"/g, ''));
              if (parts.length >= 5) {
                processDetails.push({
                  pid,
                  name: parts[0],
                  session: parts[1],
                  sessionNumber: parts[2],
                  memory: parts[3],
                  status: parts[4]
                });
              }
            }
          }
        }

        return {
          found: true,
          count: processDetails.length,
          processes: processDetails,
          commands: {
            find: command,
            getDetails: 'tasklist /FI "PID eq {PID}"'
          }
        };

      } else {
        // Linux/macOS: 使用 lsof
        command = `lsof -i :${port} -n -P`;
        const { stdout, stderr } = await this.safeExec(command);
        
        if (stderr || !stdout) {
          // 如果 lsof 失败，尝试使用 netstat
          const netstatCmd = `netstat -tulpn 2>/dev/null | grep :${port} || ss -tulpn 2>/dev/null | grep :${port}`;
          const { stdout: netstatOutput } = await this.safeExec(netstatCmd);
          
          if (!netstatOutput) {
            return { found: false, message: '未找到占用端口的进程' };
          }

          return {
            found: true,
            count: netstatOutput.split('\n').filter(l => l.trim()).length,
            rawOutput: netstatOutput,
            command: netstatCmd
          };
        }

        // 解析 lsof 输出
        const lines = stdout.trim().split('\n').slice(1); // 跳过标题行
        const processes = lines.map(line => {
          const parts = line.split(/\s+/).filter(p => p);
          return {
            command: parts[0],
            pid: parts[1],
            user: parts[2],
            fd: parts[3],
            type: parts[4],
            device: parts[5],
            size: parts[6],
            node: parts[7],
            name: parts[8]
          };
        });

        return {
          found: true,
          count: processes.length,
          processes,
          command
        };
      }

    } catch (error) {
      console.error('获取进程信息失败:', error);
      return {
        found: false,
        error: error.message,
        message: '获取进程信息时发生错误'
      };
    }
  }

  /**
   * 生成修复选项
   * @param {number} port 端口
   * @param {string} protocol 协议
   * @param {Object} processInfo 进程信息
   * @returns {Array} 修复选项
   */
  generateFixOptions(port, protocol, processInfo) {
    const options = [];

    // 选项1: 停止占用进程
    if (processInfo.found && processInfo.processes && processInfo.processes.length > 0) {
      options.push({
        id: 'stop_process',
        name: '停止占用进程',
        description: `停止占用端口 ${port} 的进程`,
        type: 'stop',
        commands: this.getStopProcessCommands(processInfo.processes),
        risks: '可能会影响其他正在运行的服务',
        recommended: true // 这是推荐的修复方式
      });
    }

    // 选项2: 修改项目端口
    options.push({
      id: 'change_port',
      name: '修改项目端口',
      description: `将项目配置修改为使用其他端口`,
      type: 'config',
      steps: [
        {
          type: 'suggestion',
          description: '建议使用其他可用端口'
        },
        {
          type: 'config',
          operation: 'update',
          description: '更新项目配置文件中的端口设置'
        }
      ],
      risks: '需要修改项目配置，可能需要重启项目',
      recommended: false
    });

    // 选项3: 使用端口转发
    options.push({
      id: 'port_forward',
      name: '端口转发',
      description: `设置端口转发，将 ${port} 转发到其他端口`,
      type: 'workaround',
      commands: this.getPortForwardCommands(port),
      risks: '临时解决方案，可能影响性能',
      recommended: false
    });

    return options;
  }

  /**
   * 获取停止进程的命令
   * @param {Array} processes 进程列表
   * @returns {Array} 命令列表
   */
  getStopProcessCommands(processes) {
    const commands = [];

    processes.forEach(process => {
      if (process.pid) {
        if (process.platform === 'win32') {
          commands.push({
            platform: 'windows',
            command: `taskkill /F /PID ${process.pid}`,
            description: `停止进程 ${process.name || '未知'} (PID: ${process.pid})`
          });
        } else {
          commands.push({
            platform: 'unix',
            command: `kill -9 ${process.pid}`,
            description: `强制停止进程 ${process.command || '未知'} (PID: ${process.pid})`
          });
        }
      }
    });

    return commands;
  }

  /**
   * 执行修复
   * @param {Array} fixOptions 修复选项
   * @param {Object} context 修复上下文
   * @returns {Promise<Object>} 修复结果
   */
  async executeFix(fixOptions, context) {
    // 这里应该根据用户的选择执行修复
    // 目前实现简单的逻辑：使用推荐的修复选项
    
    const recommendedOption = fixOptions.find(opt => opt.recommended);
    if (!recommendedOption) {
      return { success: false, message: '没有可用的修复选项' };
    }

    try {
      switch (recommendedOption.type) {
        case 'stop':
          // 执行停止进程的命令
          const stopResults = [];
          for (const cmd of recommendedOption.commands) {
            if (cmd.platform === process.platform || 
                (cmd.platform === 'unix' && ['linux', 'darwin'].includes(process.platform))) {
              const result = await this.safeExec(cmd.command);
              stopResults.push(result);
            }
          }
          
          return {
            success: stopResults.some(r => r.success),
            results: stopResults,
            requiresRestart: false,
            warnings: [
              '已停止占用端口的进程',
              '请注意检查是否影响了其他重要服务'
            ]
          };

        default:
          return {
            success: false,
            message: `不支持的修复类型: ${recommendedOption.type}`,
            requiresRestart: false
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        requiresRestart: false
      };
    }
  }

  /**
   * 寻找可用端口
   * @param {number} originalPort 原始端口
   * @returns {Promise<number>} 可用端口
   */
  async findAvailablePort(originalPort) {
    // 简单的端口检测逻辑
    const net = require('net');
    
    // 从原端口开始尝试，最多尝试100个端口
    for (let port = originalPort + 1; port <= originalPort + 100; port++) {
      const isAvailable = await new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => {
          resolve(false); // 端口被占用
        });
        server.once('listening', () => {
          server.close();
          resolve(true); // 端口可用
        });
        try {
          server.listen(port, '127.0.0.1');
        } catch (error) {
          resolve(false);
        }
      });

      if (isAvailable) {
        return port;
      }
    }

    // 如果找不到，返回一个随机端口
    return 30000 + Math.floor(Math.random() * 10000);
  }

  /**
   * 获取端口转发命令
   * @param {number} port 原始端口
   * @returns {Array} 命令列表
   */
  getPortForwardCommands(port) {
    const availablePort = 30000 + Math.floor(Math.random() * 10000);
    
    if (process.platform === 'win32') {
      return [
        {
          platform: 'windows',
          command: `netsh interface portproxy add v4tov4 listenport=${port} listenaddress=127.0.0.1 connectport=${availablePort} connectaddress=127.0.0.1`,
          description: `将端口 ${port} 转发到 ${availablePort}`
        }
      ];
    } else {
      return [
        {
          platform: 'unix',
          command: `iptables -t nat -A PREROUTING -p tcp --dport ${port} -j REDIRECT --to-port ${availablePort}`,
          description: `将端口 ${port} 转发到 ${availablePort} (需要root权限)`
        }
      ];
    }
  }

  /**
   * 验证修复结果
   * @param {Object} issue 问题对象
   * @param {Object} context 修复上下文
   * @returns {Promise<boolean>} 是否修复成功
   */
  async verifyFix(issue, context) {
    const { port, protocol } = issue.data;
    
    try {
      // 重新检查端口是否还被占用
      const net = require('net');
      return await new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => {
          resolve(false); // 端口仍然被占用
        });
        server.once('listening', () => {
          server.close();
          resolve(true); // 端口已释放
        });
        server.listen(port, '127.0.0.1');
      });
    } catch (error) {
      console.error('验证端口修复失败:', error);
      return false;
    }
  }

  /**
   * 创建回滚信息
   * @param {Object} issue 问题对象
   * @param {Object} context 修复上下文
   * @returns {Promise<Object>} 回滚信息
   */
  async createRollbackInfo(issue, context) {
    // 端口修复通常是不可逆的（停止进程）
    // 但我们可以记录被停止的进程信息，以便用户手动恢复
    return {
      canRollback: false,
      rollbackSteps: [],
      manualRecoverySteps: [
        {
          description: '如果误停止了重要进程，请手动重新启动相关服务',
          commands: [
            '检查系统日志了解被停止的进程',
            '根据需要重启相应的服务'
          ]
        }
      ],
      originalData: issue.data
    };
  }
}

module.exports = PortFixer;