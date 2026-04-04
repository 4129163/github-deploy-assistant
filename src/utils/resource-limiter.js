/**
 * 进程资源限制工具
 * 支持CPU和内存资源限制，防止单个项目耗尽系统资源
 */

const os = require('os');
const { spawn } = require('child_process');

// 延迟获取logger以避免循环依赖
let logger = null;
function getLogger() {
  if (!logger) {
    logger = require('./logger').logger;
  }
  return logger;
}

/**
 * 资源限制配置
 */
class ResourceLimits {
  constructor(cpuLimit = null, memoryLimitMB = null) {
    this.cpuLimit = cpuLimit; // CPU核心数（如0.5表示半个核心，1表示一个核心）
    this.memoryLimitMB = memoryLimitMB; // 内存限制（MB）
  }

  /**
   * 检查是否需要应用资源限制
   */
  hasLimits() {
    return this.cpuLimit !== null || this.memoryLimitMB !== null;
  }

  /**
   * 获取CPU限制的字符串表示
   * @returns {string|null} 返回如"0.5"或"1.0"的字符串
   */
  getCPULimitString() {
    if (this.cpuLimit === null) return null;
    return this.cpuLimit.toString();
  }

  /**
   * 获取内存限制的字节数
   * @returns {number|null} 内存限制字节数
   */
  getMemoryLimitBytes() {
    if (this.memoryLimitMB === null) return null;
    return this.memoryLimitMB * 1024 * 1024;
  }

  /**
   * 验证限制是否有效
   * @returns {Array<string>} 错误信息数组
   */
  validate() {
    const errors = [];
    
    if (this.cpuLimit !== null) {
      if (typeof this.cpuLimit !== 'number' || this.cpuLimit <= 0) {
        errors.push('CPU限制必须为正数');
      }
      const cpuCount = os.cpus().length;
      if (this.cpuLimit > cpuCount) {
        errors.push(`CPU限制(${this.cpuLimit})超过系统核心数(${cpuCount})`);
      }
    }
    
    if (this.memoryLimitMB !== null) {
      if (!Number.isInteger(this.memoryLimitMB) || this.memoryLimitMB <= 0) {
        errors.push('内存限制必须为正整数(MB)');
      }
      const totalMemMB = Math.floor(os.totalmem() / (1024 * 1024));
      if (this.memoryLimitMB > totalMemMB) {
        errors.push(`内存限制(${this.memoryLimitMB}MB)超过系统总内存(${totalMemMB}MB)`);
      }
    }
    
    return errors;
  }

  /**
   * 获取限制的友好描述
   */
  toString() {
    const parts = [];
    if (this.cpuLimit !== null) parts.push(`CPU: ${this.cpuLimit}核心`);
    if (this.memoryLimitMB !== null) parts.push(`内存: ${this.memoryLimitMB}MB`);
    return parts.length > 0 ? parts.join('，') : '无限制';
  }
}

/**
 * 根据平台和限制配置生成进程启动参数
 * @param {ResourceLimits} limits 资源限制配置
 * @param {string} platform 平台名称
 * @returns {Array<string>} 进程启动参数
 */
function getProcessArgsWithLimits(limits, platform = process.platform) {
  const args = [];
  
  if (!limits.hasLimits()) {
    return args;
  }

  // 验证限制
  const errors = limits.validate();
  if (errors.length > 0) {
    getLogger().warn(`资源限制验证失败: ${errors.join('; ')}`);
    return args;
  }

  // 根据平台应用不同的限制策略
  switch (platform) {
    case 'linux': {
      // 使用 cgroups 进行限制（如果可用）
      if (limits.cpuLimit !== null) {
        // 使用 cpuset.cpus 或 cpu.shares
        // 这里使用简单的 taskset 来限制CPU
        args.unshift('taskset', '-c', `0-${Math.max(0, Math.floor(limits.cpuLimit) - 1)}`);
      }
      if (limits.memoryLimitMB !== null) {
        // 使用 ulimit 设置内存限制
        const memoryLimitBytes = limits.getMemoryLimitBytes();
        // 注意：ulimit -v 设置虚拟内存限制
        args.unshift('bash', '-c', `ulimit -v ${memoryLimitBytes} && exec`);
      }
      break;
    }
    
    case 'darwin': { // macOS
      if (limits.memoryLimitMB !== null) {
        const memoryLimitBytes = limits.getMemoryLimitBytes();
        // macOS 可以使用 ulimit -m 设置内存限制
        args.unshift('bash', '-c', `ulimit -m ${memoryLimitBytes} && exec`);
      }
      // macOS 的CPU限制较复杂，这里暂时不实现
      break;
    }
    
    case 'win32': {
      // Windows 使用 Job Objects API，这里通过 PowerShell 简化实现
      if (limits.cpuLimit !== null || limits.memoryLimitMB !== null) {
        const psScript = [];
        if (limits.cpuLimit !== null) {
          const cpuCount = Math.floor(limits.cpuLimit);
          psScript.push(`$Process.ProcessorAffinity = ${(1 << cpuCount) - 1}`);
        }
        if (limits.memoryLimitMB !== null) {
          psScript.push(`$Process.MaxWorkingSet = [IntPtr]::new(${limits.getMemoryLimitBytes()})`);
        }
        args.unshift('powershell', '-Command', 
          `$Process = Start-Process -PassThru -NoNewWindow -FilePath {0} -ArgumentList {1}; ${psScript.join(';')}`);
      }
      break;
    }
    
    default:
      getLogger().warn(`不支持资源限制的平台: ${platform}`);
  }
  
  return args;
}

/**
 * 创建带资源限制的子进程
 * @param {string} command 要执行的命令
 * @param {Array<string>} args 命令参数
 * @param {Object} options spawn选项
 * @param {ResourceLimits} limits 资源限制
 * @returns {ChildProcess} 子进程对象
 */
function spawnWithLimits(command, args, options, limits) {
  if (!limits.hasLimits()) {
    return spawn(command, args, options);
  }

  const platform = process.platform;
  const limitArgs = getProcessArgsWithLimits(limits, platform);
  
  if (limitArgs.length === 0) {
    getLogger().info(`平台 ${platform} 不支持资源限制，使用普通spawn`);
    return spawn(command, args, options);
  }

  // 重新构造命令和参数
  let finalCommand = limitArgs[0];
  let finalArgs = [...limitArgs.slice(1)];
  
  // 根据平台调整参数格式
  if (platform === 'linux' && limitArgs.includes('bash')) {
    // bash -c "ulimit ... && exec cmd args"
    const cmdString = `${command} ${args.map(arg => `'${arg.replace(/'/g, "'\"'\"'")}'`).join(' ')}`;
    const bashCmd = limitArgs[limitArgs.length - 1] + ' ' + cmdString;
    finalArgs[finalArgs.length - 1] = bashCmd;
  } else if (platform === 'win32' && limitArgs.includes('powershell')) {
    // 处理 PowerShell 脚本中的占位符
    const psArgs = finalArgs.join(' ');
    const escapedCommand = command.replace(/\\/g, '\\\\');
    const escapedArgs = args.map(arg => arg.replace(/"/g, '""')).join(' ');
    finalArgs = ['-Command', psArgs.replace('{0}', `"${escapedCommand}"`).replace('{1}', `"${escapedArgs}"`)];
  } else {
    // 其他情况直接拼接
    finalArgs.push(command, ...args);
  }

  getLogger().info(`启动带资源限制的进程: ${finalCommand} ${finalArgs.join(' ')}`);
  getLogger().info(`资源限制: ${limits.toString()}`);
  
  return spawn(finalCommand, finalArgs, options);
}

/**
 * 从项目配置中解析资源限制
 * @param {Object} project 项目对象
 * @returns {ResourceLimits} 资源限制配置
 */
function parseLimitsFromProject(project) {
  // 优先从 config 字段解析
  let cpuLimit = null;
  let memoryLimitMB = null;
  
  if (project.config) {
    const config = typeof project.config === 'string' ? JSON.parse(project.config) : project.config;
    if (config.resource_limits) {
      cpuLimit = config.resource_limits.cpu_limit || null;
      memoryLimitMB = config.resource_limits.memory_limit_mb || null;
    }
  }
  
  // 然后检查数据库直接字段（用于向后兼容）
  if (project.cpu_limit !== undefined && project.cpu_limit !== null) {
    cpuLimit = project.cpu_limit;
  }
  if (project.memory_limit_mb !== undefined && project.memory_limit_mb !== null) {
    memoryLimitMB = project.memory_limit_mb;
  }
  
  return new ResourceLimits(cpuLimit, memoryLimitMB);
}

module.exports = {
  ResourceLimits,
  spawnWithLimits,
  parseLimitsFromProject,
  getProcessArgsWithLimits
};