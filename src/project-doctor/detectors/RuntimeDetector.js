const axios = require('axios');
const tcpPortUsed = require('tcp-port-used');
const { execPromise } = require('../../utils/exec-promise');
const BaseDetector = require('../BaseDetector');

class RuntimeDetector extends BaseDetector {
  constructor() {
    super();
    this.name = '运行状态检测器';
    this.description = '检测项目进程、端口访问等运行状态';
  }

  async detect(project) {
    const issues = [];

    // 1. 检测进程是否在运行
    if (project.pid) {
      try {
        // 检查进程是否存在
        if (process.platform === 'win32') {
          await execPromise(`tasklist /FI "PID eq ${project.pid}"`);
        } else {
          await execPromise(`ps -p ${project.pid}`);
        }
      } catch (e) {
        issues.push({
          type: 'process_crashed',
          severity: 'critical',
          name: '进程意外退出',
          description: `项目进程(PID: ${project.pid})已经停止运行`,
          fixable: true
        });
      }
    }

    // 2. 检测端口是否可访问
    if (project.port) {
      try {
        const inUse = await tcpPortUsed.check(parseInt(project.port), '127.0.0.1');
        if (!inUse) {
          issues.push({
            type: 'port_not_listening',
            severity: 'high',
            name: '端口未监听',
            description: `项目配置的端口${project.port}没有服务在监听`,
            fixable: true
          });
        } else {
          // 尝试访问服务
          try {
            await axios.get(`http://127.0.0.1:${project.port}`, { timeout: 3000 });
          } catch (e) {
            issues.push({
              type: 'service_unresponsive',
              severity: 'high',
              name: '服务无响应',
              description: `端口${project.port}已监听，但服务无法正常访问`,
              fixable: true
            });
          }
        }
      } catch (e) {}
    }

    // 3. 检测资源占用是否过高
    if (project.pid) {
      try {
        let cpuUsage, memUsage;
        if (process.platform === 'win32') {
          const res = await execPromise(`wmic process where processid=${project.pid} get workingsetsize,percentprocessortime /format:csv`);
          const lines = res.stdout.trim().split('\\n');
          if (lines.length > 1) {
            const [_, cpu, mem] = lines[1].split(',');
            cpuUsage = parseInt(cpu);
            memUsage = parseInt(mem) / 1024 / 1024; // 转成MB
          }
        } else {
          const res = await execPromise(`ps -p ${project.pid} -o %cpu,rss`);
          const lines = res.stdout.trim().split('\\n');
          if (lines.length > 1) {
            const [cpu, rss] = lines[1].trim().split(/\s+/);
            cpuUsage = parseFloat(cpu);
            memUsage = parseInt(rss) / 1024; // 转成MB
          }
        }

        if (cpuUsage > 90) {
          issues.push({
            type: 'high_cpu_usage',
            severity: 'medium',
            name: 'CPU占用过高',
            description: `项目CPU占用达到${cpuUsage.toFixed(1)}%，可能影响响应速度`,
            fixable: true
          });
        }
        if (memUsage > 1024) { // 超过1GB
          issues.push({
            type: 'high_memory_usage',
            severity: 'medium',
            name: '内存占用过高',
            description: `项目内存占用达到${memUsage.toFixed(1)}MB，占用资源过多`,
            fixable: true
          });
        }
      } catch (e) {}
    }

    return issues;
  }
}

module.exports = RuntimeDetector;
