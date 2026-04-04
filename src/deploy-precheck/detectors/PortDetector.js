/**
 * 端口占用检测器
 */

const BaseDetector = require('./BaseDetector');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class PortDetector extends BaseDetector {
  constructor() {
    super();
    this.name = 'PortDetector';
    this.description = '检测端口占用情况';
    this.priority = 10; // 高优先级
  }

  /**
   * 执行端口检测
   * @param {Object} context 检测上下文
   * @returns {Promise<Array>} 检测结果
   */
  async detect(context) {
    const issues = [];
    const { project } = context;
    
    if (!project || !project.config) {
      return issues;
    }

    // 获取项目需要的端口
    const requiredPorts = this.extractRequiredPorts(project);
    
    for (const portInfo of requiredPorts) {
      const { port, name, protocol = 'tcp' } = portInfo;
      
      try {
        const isOccupied = await this.checkPortOccupied(port, protocol);
        
        if (isOccupied) {
          const processInfo = await this.getPortProcessInfo(port, protocol);
          
          issues.push(this.formatIssue({
            type: 'port_occupied',
            title: `端口 ${port} 被占用`,
            description: `${name || '项目'} 需要使用的端口 ${port} 已被其他进程占用`,
            severity: 'high',
            fixable: true,
            fixType: 'semi-auto',
            fixSteps: [
              {
                type: 'command',
                description: `查找占用端口 ${port} 的进程`,
                command: this.getPortCheckCommand(port, protocol)
              },
              {
                type: 'suggestion',
                description: '可以选择：1. 停止占用进程 2. 修改项目端口配置 3. 使用其他可用端口'
              }
            ],
            data: {
              port,
              protocol,
              portName: name,
              processInfo,
              requiredBy: project.name || project.id
            }
          }));
        }
      } catch (error) {
        console.error(`检测端口 ${port} 时出错:`, error.message);
      }
    }

    return issues;
  }

  /**
   * 从项目配置中提取需要的端口
   * @param {Object} project 项目信息
   * @returns {Array} 端口列表
   */
  extractRequiredPorts(project) {
    const ports = [];
    
    // 从项目配置中提取端口
    if (project.config && project.config.ports) {
      if (Array.isArray(project.config.ports)) {
        project.config.ports.forEach(port => {
          ports.push({
            port: typeof port === 'number' ? port : parseInt(port),
            name: '项目端口'
          });
        });
      } else if (typeof project.config.ports === 'object') {
        Object.entries(project.config.ports).forEach(([name, port]) => {
          ports.push({
            port: parseInt(port),
            name
          });
        });
      }
    }

    // 从部署脚本中提取端口（简单解析）
    if (project.deployScript) {
      const portMatches = project.deployScript.match(/(?:port|PORT)[\s:=]+(\d+)/gi);
      if (portMatches) {
        portMatches.forEach(match => {
          const portMatch = match.match(/\d+/);
          if (portMatch) {
            const port = parseInt(portMatch[0]);
            if (port && !ports.some(p => p.port === port)) {
              ports.push({
                port,
                name: '部署脚本中定义的端口'
              });
            }
          }
        });
      }
    }

    // 默认端口（如果项目类型已知）
    if (project.types) {
      const typePorts = {
        'node': 3000,
        'react': 3000,
        'vue': 3000,
        'next': 3000,
        'python': 8000,
        'flask': 5000,
        'django': 8000,
        'java': 8080,
        'spring': 8080,
        'go': 8080,
        'rust': 8080,
        'docker': 80
      };

      project.types.forEach(type => {
        const defaultPort = typePorts[type.toLowerCase()];
        if (defaultPort && !ports.some(p => p.port === defaultPort)) {
          ports.push({
            port: defaultPort,
            name: `${type} 默认端口`
          });
        }
      });
    }

    return ports;
  }

  /**
   * 检查端口是否被占用
   * @param {number} port 端口号
   * @param {string} protocol 协议
   * @returns {Promise<boolean>}
   */
  async checkPortOccupied(port, protocol = 'tcp') {
    try {
      // 检查TCP端口
      if (protocol === 'tcp' || protocol === 'tcp4' || protocol === 'tcp6') {
        const { stdout } = await execAsync(`netstat -tuln 2>/dev/null || ss -tuln 2>/dev/null`);
        const lines = stdout.split('\n');
        return lines.some(line => line.includes(`:${port}`));
      }
      
      // 检查UDP端口
      if (protocol === 'udp' || protocol === 'udp4' || protocol === 'udp6') {
        const { stdout } = await execAsync(`netstat -uln 2>/dev/null || ss -uln 2>/dev/null`);
        const lines = stdout.split('\n');
        return lines.some(line => line.includes(`:${port}`));
      }
      
      return false;
    } catch (error) {
      // 如果命令执行失败，尝试使用其他方法
      try {
        const net = require('net');
        return new Promise((resolve) => {
          const server = net.createServer();
          server.once('error', () => {
            resolve(true); // 端口被占用
          });
          server.once('listening', () => {
            server.close();
            resolve(false); // 端口可用
          });
          server.listen(port, '127.0.0.1');
        });
      } catch (fallbackError) {
        console.error('检查端口占用失败:', fallbackError.message);
        return false; // 默认认为可用
      }
    }
  }

  /**
   * 获取占用端口的进程信息
   * @param {number} port 端口号
   * @param {string} protocol 协议
   * @returns {Promise<string>} 进程信息
   */
  async getPortProcessInfo(port, protocol = 'tcp') {
    try {
      const { stdout } = await execAsync(`lsof -i :${port} 2>/dev/null || netstat -tulpn 2>/dev/null | grep :${port} || ss -tulpn 2>/dev/null | grep :${port}`);
      return stdout.trim() || '无法获取进程详细信息';
    } catch (error) {
      return '无法获取进程信息';
    }
  }

  /**
   * 获取端口检查命令
   * @param {number} port 端口号
   * @param {string} protocol 协议
   * @returns {string}
   */
  getPortCheckCommand(port, protocol = 'tcp') {
    if (process.platform === 'win32') {
      return `netstat -ano | findstr :${port}`;
    } else {
      return `lsof -i :${port} || netstat -tulpn | grep :${port} || ss -tulpn | grep :${port}`;
    }
  }

  /**
   * 检查是否应该运行此检测器
   * @param {Object} context 检测上下文
   * @returns {boolean}
   */
  shouldRun(context) {
    const { project } = context;
    return project && project.config && (
      project.config.ports || 
      project.deployScript || 
      (project.types && project.types.length > 0)
    );
  }
}

module.exports = PortDetector;