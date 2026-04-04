/**
 * 安全工具模块 - 防止命令注入和路径穿越
 */

const path = require('path');
const { exec, execFile, spawn } = require('child_process');
const { promisify } = require('util');

/**
 * 命令白名单正则表达式
 * 只允许安全的系统命令和部署相关命令
 */
const COMMAND_WHITELIST = [
  // 系统信息命令
  /^node\s+--version$/,
  /^npm\s+--version$/,
  /^git\s+--version$/,
  /^python3?\s+--version$/,
  /^docker\s+--version$/,
  /^uname\s+-a$/,
  /^df\s+-k\s+\/$/,
  /^du\s+-(sb|sh|sk)\s+/,
  /^ps\s+aux$/,
  /^top\s+-bn1$/,
  /^free\s+-m$/,
  
  // 部署相关命令（带参数限制）
  /^npm\s+(install|ci|start|run\s+\w+|update|audit)\s*/,
  /^yarn\s+(install|start|run\s+\w+|upgrade)$/,
  /^pnpm\s+(install|start|run\s+\w+|update)$/,
  /^pip3?\s+install\s+/,
  /^python3?\s+/,
  /^docker\s+(build|run|stop|ps|images|pull|compose)\s+/,
  /^docker-compose\s+/,
  /^git\s+(clone|pull|checkout|branch|status|log|diff)\s+/,
  /^go\s+(build|run|test|mod)\s+/,
  /^cargo\s+(build|run|test|update)\s+/,
  /^mvn\s+(clean|compile|package|install|test)\s+/,
  /^gradle\s+(clean|build|test|run)\s+/,
  /^bun\s+(install|run|build|dev)\s+/,
  /^mkdir\s+-p\s+/,
  /^cd\s+/,
  /^echo\s+/,
  /^test\s+-d\s+/,
  /^nohup\s+/,
  
  // 带路径的命令（需要路径验证）
  /^.*\s+["'].*["']$/,
];

/**
 * 危险命令黑名单（绝对禁止）
 */
const COMMAND_BLACKLIST = [
  /rm\s+-(rf|fr)/i,
  /chmod\s+777/i,
  /chown\s+root/i,
  /dd\s+/i,
  /mkfs\s+/i,
  /fdisk\s+/i,
  /wget\s+.*\s+-O/i,
  /curl\s+.*\s+-o/i,
  /sh\s+-c/i,
  /bash\s+-c/i,
  /\|\s*(sh|bash|zsh)/,
  /\$\s*\(/,
  /`.*`/,
  /\$\{.*\}/,
  /;\s*$/,
  /&&\s*$/,
  /\|\|\s*$/,
  />\s*\/dev\/null/,
  /2>&1/,
  /eval\s+/i,
  /exec\s+/i,
  /system\s+/i,
  /popen\s+/i,
  /spawn\s+/i,
  /child_process/i,
];

/**
 * 验证命令是否安全
 * @param {string} command - 要验证的命令
 * @returns {Object} {safe: boolean, reason: string}
 */
function validateCommand(command) {
  const trimmed = command.trim();
  
  // 空命令检查
  if (!trimmed) {
    return { safe: false, reason: '命令不能为空' };
  }
  
  // 黑名单检查
  for (const pattern of COMMAND_BLACKLIST) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `命令包含危险模式: ${pattern.toString()}` };
    }
  }
  
  // 白名单检查
  for (const pattern of COMMAND_WHITELIST) {
    if (pattern.test(trimmed)) {
      return { safe: true, reason: '命令在白名单内' };
    }
  }
  
  // 检查是否有未授权的特殊字符
  const dangerousChars = [';', '&', '|', '`', '$', '(', ')', '{', '}', '>', '<'];
  for (const char of dangerousChars) {
    if (trimmed.includes(char) && !trimmed.match(/["'][^"']*["']/)) {
      // 如果不在引号内，可能危险
      return { safe: false, reason: `命令包含未转义的特殊字符: ${char}` };
    }
  }
  
  return { safe: false, reason: '命令不在白名单内' };
}

/**
 * 验证工作目录路径是否安全
 * @param {string} cwd - 工作目录路径
 * @param {string} baseDir - 基准目录（通常是工作空间根目录）
 * @returns {Object} {safe: boolean, normalized: string, reason: string}
 */
function validateWorkingDirectory(cwd, baseDir) {
  try {
    const resolvedCwd = path.resolve(cwd);
    const resolvedBaseDir = path.resolve(baseDir);
    
    // 检查路径是否在基准目录内
    if (!resolvedCwd.startsWith(resolvedBaseDir)) {
      return { 
        safe: false, 
        normalized: resolvedCwd,
        reason: `路径超出允许范围: ${resolvedCwd} (基准目录: ${resolvedBaseDir})`
      };
    }
    
    // 检查路径中是否包含目录遍历攻击
    // 先规范化路径，然后检查是否在基准目录内
    const normalizedPath = path.normalize(resolvedCwd);
    if (!normalizedPath.startsWith(resolvedBaseDir)) {
      return { 
        safe: false, 
        normalized: normalizedPath,
        reason: '规范化后路径超出允许范围'
      };
    }
    
    return { 
      safe: true, 
      normalized: resolvedCwd,
      reason: '路径安全检查通过'
    };
  } catch (error) {
    return { 
      safe: false, 
      normalized: cwd,
      reason: `路径解析失败: ${error.message}`
    };
  }
}

/**
 * 安全的命令执行函数（使用 exec）
 * @param {string} command - 要执行的命令
 * @param {Object} options - exec选项
 * @returns {Promise<Object>} 执行结果
 */
async function safeExec(command, options = {}) {
  const validation = validateCommand(command);
  if (!validation.safe) {
    throw new Error(`命令验证失败: ${validation.reason}`);
  }
  
  // 验证工作目录
  if (options.cwd) {
    const baseDir = options.baseDir || process.cwd();
    const dirValidation = validateWorkingDirectory(options.cwd, baseDir);
    if (!dirValidation.safe) {
      throw new Error(`工作目录验证失败: ${dirValidation.reason}`);
    }
    options.cwd = dirValidation.normalized;
  }
  
  const execAsync = promisify(exec);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      ...options,
      timeout: options.timeout || 30000, // 默认30秒超时
      maxBuffer: options.maxBuffer || 10 * 1024 * 1024, // 10MB
      encoding: 'utf8',
    });
    
    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  } catch (error) {
    return {
      success: false,
      stdout: error.stdout ? error.stdout.trim() : '',
      stderr: error.stderr ? error.stderr.trim() : error.message,
      exitCode: error.code || -1,
      error: error.message,
    };
  }
}

/**
 * 安全的命令执行函数（使用 spawn，适合长时间运行）
 * @param {string} command - 要执行的命令
 * @param {Array} args - 参数数组
 * @param {Object} options - spawn选项
 * @returns {Promise<Object>} 执行结果
 */
function safeSpawn(command, args = [], options = {}) {
  // 构建完整命令用于验证
  const fullCommand = `${command} ${args.join(' ')}`.trim();
  const validation = validateCommand(fullCommand);
  if (!validation.safe) {
    throw new Error(`命令验证失败: ${validation.reason}`);
  }
  
  // 验证工作目录
  if (options.cwd) {
    const baseDir = options.baseDir || process.cwd();
    const dirValidation = validateWorkingDirectory(options.cwd, baseDir);
    if (!dirValidation.safe) {
      throw new Error(`工作目录验证失败: ${dirValidation.reason}`);
    }
    options.cwd = dirValidation.normalized;
  }
  
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
      });
    });
    
    child.on('error', (error) => {
      reject({
        success: false,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: -1,
        error: error.message,
      });
    });
    
    // 设置超时
    if (options.timeout) {
      setTimeout(() => {
        child.kill('SIGTERM');
        reject({
          success: false,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: -1,
          error: `命令执行超时 (${options.timeout}ms)`,
        });
      }, options.timeout);
    }
  });
}

/**
 * 安全的远程命令验证
 * @param {string} command - 远程命令
 * @returns {Object} {safe: boolean, reason: string}
 */
function validateRemoteCommand(command) {
  // 远程命令有更严格的白名单
  const REMOTE_COMMAND_WHITELIST = [
    /^mkdir\s+-p\s+/,
    /^cd\s+/,
    /^test\s+-d\s+/,
    /^git\s+(clone|pull|checkout|status)\s+/,
    /^npm\s+(install|ci|start|run\s+\w+)$/,
    /^yarn\s+(install|start|run\s+\w+)$/,
    /^pnpm\s+(install|start|run\s+\w+)$/,
    /^python3?\s+-m\s+venv\s+/,
    /^\.\/venv\/bin\/pip\s+install\s+/,
    /^nohup\s+/,
    /^docker\s+(build|run|stop|ps)\s+/,
    /^pm2\s+(start|stop|restart|list)\s+/,
    /^uname\s+-a$/,
    /^echo\s+/,
  ];
  
  const trimmed = command.trim();
  
  // 黑名单检查（远程更严格）
  for (const pattern of COMMAND_BLACKLIST) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `远程命令包含危险模式: ${pattern.toString()}` };
    }
  }
  
  // 白名单检查
  for (const pattern of REMOTE_COMMAND_WHITELIST) {
    if (pattern.test(trimmed)) {
      return { safe: true, reason: '远程命令在白名单内' };
    }
  }
  
  return { safe: false, reason: '远程命令不在白名单内' };
}

/**
 * 转义命令参数（防止命令注入）
 * @param {string} arg - 要转义的参数
 * @returns {string} 转义后的参数
 */
function escapeShellArg(arg) {
  if (typeof arg !== 'string') {
    arg = String(arg);
  }
  
  // 如果参数已经用引号包裹，直接返回
  if ((arg.startsWith("'") && arg.endsWith("'")) || 
      (arg.startsWith('"') && arg.endsWith('"'))) {
    return arg;
  }
  
  // 否则用单引号包裹
  return `'${arg.replace(/'/g, "'\"'\"'")}'`;
}

/**
 * 构建安全的命令参数数组（使用 execFile）
 * @param {string} command - 命令
 * @param {Array} args - 参数数组
 * @returns {Array} 安全的参数数组
 */
function buildSafeArgs(command, args = []) {
  // 验证命令本身
  const validation = validateCommand(command);
  if (!validation.safe) {
    throw new Error(`命令验证失败: ${validation.reason}`);
  }
  
  // 转义所有参数
  return args.map(arg => escapeShellArg(arg));
}

module.exports = {
  validateCommand,
  validateWorkingDirectory,
  validateRemoteCommand,
  safeExec,
  safeSpawn,
  escapeShellArg,
  buildSafeArgs,
  COMMAND_WHITELIST,
  COMMAND_BLACKLIST,
};