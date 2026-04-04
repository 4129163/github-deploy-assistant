/**
 * 预检修复器基类
 * 所有修复器都应继承此类
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class BaseFixer {
  constructor() {
    this.name = 'BaseFixer';
    this.description = '基础修复器';
    this.supportedIssueTypes = []; // 支持的问题类型
  }

  /**
   * 执行修复
   * @param {Object} issue 问题对象
   * @param {Object} context 修复上下文
   * @returns {Promise<Object>} 修复结果
   */
  async fix(issue, context) {
    throw new Error('子类必须实现 fix 方法');
  }

  /**
   * 检查是否支持修复此问题
   * @param {Object} issue 问题对象
   * @returns {boolean}
   */
  canFix(issue) {
    return this.supportedIssueTypes.includes(issue.type);
  }

  /**
   * 验证修复结果
   * @param {Object} issue 问题对象
   * @param {Object} context 修复上下文
   * @returns {Promise<boolean>} 是否修复成功
   */
  async verifyFix(issue, context) {
    // 默认验证方法：重新检测问题是否存在
    // 子类可以重写此方法
    return true;
  }

  /**
   * 生成修复报告
   * @param {Object} issue 问题对象
   * @param {Object} result 修复结果
   * @param {Object} context 修复上下文
   * @returns {Object} 修复报告
   */
  generateFixReport(issue, result, context) {
    return {
      fixer: this.name,
      issueId: issue.id,
      issueType: issue.type,
      startTime: result.startTime,
      endTime: result.endTime,
      success: result.success,
      message: result.message,
      details: result.details,
      warnings: result.warnings || [],
      requiresRestart: result.requiresRestart || false,
      requiresConfirmation: result.requiresConfirmation || false
    };
  }

  /**
   * 安全执行命令
   * @param {string} command 命令
   * @param {Object} options 执行选项
   * @returns {Promise<Object>} 执行结果
   */
  async safeExec(command, options = {}) {
    const defaultOptions = {
      timeout: 30000, // 30秒超时
      cwd: process.cwd(),
      env: process.env,
      ...options
    };

    try {
      const { stdout, stderr } = await execAsync(command, defaultOptions);
      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        command
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout?.toString()?.trim() || '',
        stderr: error.stderr?.toString()?.trim() || '',
        command
      };
    }
  }

  /**
   * 执行修复步骤
   * @param {Array} steps 修复步骤
   * @param {Object} context 修复上下文
   * @returns {Promise<Array>} 步骤执行结果
   */
  async executeSteps(steps, context) {
    const results = [];
    
    for (const [index, step] of steps.entries()) {
      const stepResult = {
        step: index + 1,
        description: step.description,
        type: step.type || 'action',
        startTime: new Date().toISOString(),
        success: false
      };

      try {
        switch (step.type) {
          case 'command':
            stepResult.command = step.command;
            const execResult = await this.safeExec(step.command, step.options);
            stepResult.success = execResult.success;
            stepResult.result = execResult;
            break;

          case 'file':
            stepResult.fileOperation = step.operation;
            stepResult.filePath = step.path;
            const fileResult = await this.handleFileOperation(step);
            stepResult.success = fileResult.success;
            stepResult.result = fileResult;
            break;

          case 'config':
            stepResult.configOperation = step.operation;
            const configResult = await this.handleConfigOperation(step, context);
            stepResult.success = configResult.success;
            stepResult.result = configResult;
            break;

          case 'suggestion':
            stepResult.success = true; // 建议步骤总是成功
            stepResult.suggestion = step.description;
            break;

          default:
            stepResult.success = await this.handleCustomStep(step, context);
            break;
        }
      } catch (error) {
        stepResult.success = false;
        stepResult.error = error.message;
      }

      stepResult.endTime = new Date().toISOString();
      results.push(stepResult);

      // 如果步骤失败且不是建议步骤，停止执行
      if (!stepResult.success && step.type !== 'suggestion') {
        break;
      }
    }

    return results;
  }

  /**
   * 处理文件操作
   * @param {Object} step 步骤配置
   * @returns {Promise<Object>} 操作结果
   */
  async handleFileOperation(step) {
    const fs = require('fs-extra');
    const path = require('path');

    try {
      switch (step.operation) {
        case 'create':
          await fs.ensureDir(path.dirname(step.path));
          await fs.writeFile(step.path, step.content || '', step.options);
          return { success: true, message: `文件创建成功: ${step.path}` };

        case 'update':
          await fs.writeFile(step.path, step.content, step.options);
          return { success: true, message: `文件更新成功: ${step.path}` };

        case 'append':
          await fs.appendFile(step.path, step.content, step.options);
          return { success: true, message: `文件追加成功: ${step.path}` };

        case 'delete':
          await fs.remove(step.path);
          return { success: true, message: `文件删除成功: ${step.path}` };

        case 'copy':
          await fs.copy(step.source, step.destination, step.options);
          return { success: true, message: `文件复制成功: ${step.source} -> ${step.destination}` };

        case 'move':
          await fs.move(step.source, step.destination, step.options);
          return { success: true, message: `文件移动成功: ${step.source} -> ${step.destination}` };

        default:
          return { success: false, error: `不支持的文件操作: ${step.operation}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理配置操作
   * @param {Object} step 步骤配置
   * @param {Object} context 修复上下文
   * @returns {Promise<Object>} 操作结果
   */
  async handleConfigOperation(step, context) {
    // 这里可以集成项目配置管理
    // 目前返回成功，子类可以重写此方法
    return { success: true, message: '配置操作已执行' };
  }

  /**
   * 处理自定义步骤
   * @param {Object} step 步骤配置
   * @param {Object} context 修复上下文
   * @returns {Promise<boolean>} 是否成功
   */
  async handleCustomStep(step, context) {
    // 子类可以重写此方法
    return true;
  }

  /**
   * 创建回滚信息
   * @param {Object} issue 问题对象
   * @param {Object} context 修复上下文
   * @returns {Promise<Object>} 回滚信息
   */
  async createRollbackInfo(issue, context) {
    // 子类可以重写此方法以支持回滚
    return {
      canRollback: false,
      rollbackSteps: []
    };
  }

  /**
   * 执行回滚
   * @param {Object} rollbackInfo 回滚信息
   * @returns {Promise<Object>} 回滚结果
   */
  async rollback(rollbackInfo) {
    if (!rollbackInfo.canRollback || !rollbackInfo.rollbackSteps.length) {
      return { success: false, message: '不支持回滚' };
    }

    return await this.executeSteps(rollbackInfo.rollbackSteps, {});
  }

  /**
   * 获取平台特定的命令
   * @param {Object} commands 命令映射 { linux, macos, windows, default }
   * @returns {string} 平台特定的命令
   */
  getPlatformCommand(commands) {
    const platform = process.platform;
    
    if (platform === 'linux' && commands.linux) {
      return commands.linux;
    } else if (platform === 'darwin' && commands.macos) {
      return commands.macos;
    } else if (platform === 'win32' && commands.windows) {
      return commands.windows;
    } else if (commands.default) {
      return commands.default;
    } else {
      throw new Error(`没有找到适合平台 ${platform} 的命令`);
    }
  }

  /**
   * 检查是否需要用户确认
   * @param {Object} issue 问题对象
   * @returns {boolean}
   */
  requiresUserConfirmation(issue) {
    // 默认情况下，高风险操作需要用户确认
    const highRiskTypes = [
      'port_occupied', // 可能需要停止进程
      'disk_space_insufficient', // 可能需要删除文件
      'dependency_missing' // 需要安装软件
    ];
    
    return highRiskTypes.includes(issue.type) || issue.severity === 'critical';
  }

  /**
   * 获取用户友好的修复描述
   * @param {Object} issue 问题对象
   * @returns {string}
   */
  getFriendlyFixDescription(issue) {
    const descriptions = {
      'port_occupied': '解决端口占用问题',
      'disk_space_insufficient': '释放磁盘空间',
      'dependency_missing': '安装缺失的依赖',
      'dependency_version_low': '升级依赖版本',
      'disk_space_low': '优化磁盘空间',
      'detector_failed': '修复检测器问题'
    };

    return descriptions[issue.type] || `修复 ${issue.type} 问题`;
  }
}

module.exports = BaseFixer;