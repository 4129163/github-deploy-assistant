const { execPromise } = require('../../utils/exec-promise');
const tcpPortUsed = require('tcp-port-used');
const BaseFixer = require('../BaseFixer');
const { autoDeploy } = require('../../services/deploy');

class RuntimeFixer extends BaseFixer {
  constructor() {
    super();
    this.name = '运行时问题修复器';
    this.description = '修复进程崩溃、端口占用等运行时问题';
  }

  async fix(problem, project) {
    switch (problem.type) {
      case 'process_crashed':
      case 'service_unresponsive':
        return this.fixProcessCrashed(project);
      case 'port_not_listening':
        return this.fixPortNotListening(project);
      case 'high_cpu_usage':
      case 'high_memory_usage':
        return this.fixHighResourceUsage(project);
      default:
        return false;
    }
  }

  async fixProcessCrashed(project) {
    try {
      // 重启项目
      await autoDeploy(project, { silent: true });
      return true;
    } catch (e) {
      return false;
    }
  }

  async fixPortNotListening(project) {
    try {
      // 先尝试重启
      await autoDeploy(project, { silent: true });
      
      // 检查端口是否正常
      const port = parseInt(project.port);
      const inUse = await tcpPortUsed.check(port, '127.0.0.1');
      if (inUse) {
        return true;
      }

      // 端口还是不行，自动更换可用端口
      const newPort = await this.findAvailablePort(port + 1);
      // 更新项目配置
      const envPath = path.join(project.local_path, '.env');
      let envContent = await fs.readFile(envPath, 'utf8');
      envContent = envContent.replace(/PORT=.*$/m, `PORT=${newPort}`);
      await fs.writeFile(envPath, envContent);
      // 重启项目
      await autoDeploy(project, { silent: true });
      project.port = newPort;
      // 更新数据库
      await ProjectDB.update(project.id, { port: newPort });
      return true;
    } catch (e) {
      return false;
    }
  }

  async fixHighResourceUsage(project) {
    try {
      // 重启项目释放资源
      await execPromise(process.platform === 'win32' ? `taskkill /F /PID ${project.pid}` : `kill -9 ${project.pid}`);
      await autoDeploy(project, { silent: true });
      return true;
    } catch (e) {
      return false;
    }
  }

  async findAvailablePort(startPort) {
    let port = startPort;
    while (port < 65535) {
      try {
        const inUse = await tcpPortUsed.check(port, '127.0.0.1');
        if (!inUse) {
          return port;
        }
        port++;
      } catch (e) {
        port++;
      }
    }
    return 3000;
  }

  getManualFixSteps(problem, project) {
    switch (problem.type) {
      case 'process_crashed':
        return '手动执行启动命令重启项目即可：npm start';
      case 'port_not_listening':
        return '检查端口是否被其他程序占用，更换端口后重启项目';
      case 'high_cpu_usage':
      case 'high_memory_usage':
        return '重启项目释放资源，或者升级服务器配置';
      default:
        return '请参考官方文档排查问题';
    }
  }
}

module.exports = RuntimeFixer;
