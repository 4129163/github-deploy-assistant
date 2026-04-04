/**
 * 增强的部署服务，支持实时日志流和阶段跟踪
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { logger } = require('../utils/logger');
const { DeployLogDB } = require('./database');
const { ALLOW_AUTO_EXEC } = require('../config');
const { 
  validateCommand, 
  validateWorkingDirectory, 
  safeExec, 
  safeSpawn,
  buildSafeArgs 
} = require('../utils/security');

// 导入漏洞扫描模块
const { 
  runNpmAudit, 
  generateVulnerabilityReport,
  sendSecurityAlert 
} = require('./vulnerability-scanner');

// 导入部署日志管理器
const {
  DEPLOY_STAGES,
  STAGE_DESCRIPTIONS,
  initDeployLogStream,
  logDeployStage,
  logDeployProgress,
  completeDeployStage,
  completeDeployStream
} = require('./deploy-logger');

/**
 * 执行命令（带实时日志输出）
 */
async function executeCommandStream(command, cwd, env = {}, options = {}) {
  const {
    streamId = null,
    stage = DEPLOY_STAGES.INSTALL,
    onProgress = null,
    label = '执行命令'
  } = options;
  
  try {
    // 安全检查：验证命令是否安全
    const commandValidation = validateCommand(command);
    if (!commandValidation.safe) {
      const errorMsg = `命令被阻止: ${command} - ${commandValidation.reason}`;
      logger.warn(errorMsg);
      
      if (streamId) {
        logDeployStage(streamId, stage, `安全警告: ${errorMsg}`, {
          level: 'warning',
          command,
          reason: commandValidation.reason
        });
      }
      
      if (onProgress) {
        onProgress({
          type: 'log',
          message: errorMsg,
          level: 'warning'
        }, stage);
      }
      
      return {
        success: false,
        exitCode: -1,
        error: errorMsg,
        outputs: []
      };
    }

    // 安全检查：验证工作目录
    const workspaceRoot = path.resolve(require('../config').WORK_DIR);
    const dirValidation = validateWorkingDirectory(cwd, workspaceRoot);
    if (!dirValidation.safe) {
      const errorMsg = `工作目录验证失败: ${dirValidation.reason}`;
      logger.warn(`阻止路径遍历尝试: ${cwd} - ${dirValidation.reason}`);
      
      if (streamId) {
        logDeployStage(streamId, stage, `安全警告: ${errorMsg}`, {
          level: 'warning',
          cwd,
          reason: dirValidation.reason
        });
      }
      
      if (onProgress) {
        onProgress({
          type: 'log',
          message: errorMsg,
          level: 'warning'
        }, stage);
      }
      
      return {
        success: false,
        exitCode: -1,
        error: errorMsg,
        outputs: []
      };
    }

    const resolvedCwd = dirValidation.normalized;
    logger.info(`Executing: ${command} in ${resolvedCwd}`);

    // 记录命令开始
    if (streamId) {
      logDeployStage(streamId, stage, `${label}: ${command}`, {
        command,
        cwd: resolvedCwd,
        level: 'info'
      });
    }
    
    if (onProgress) {
      onProgress({
        type: 'stage_start',
        message: `${label}开始`,
        command
      }, stage);
    }

    return new Promise((resolve) => {
      const outputs = [];
      const startTime = Date.now();
      
      // 使用 spawn 以获取实时输出
      const child = spawn(command, [], {
        cwd: resolvedCwd,
        env: { ...process.env, ...env },
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdoutData = '';
      let stderrData = '';
      
      // 实时标准输出
      child.stdout.on('data', (data) => {
        const text = data.toString('utf8').trim();
        if (text) {
          stdoutData += text + '\n';
          
          // 逐行处理输出
          const lines = text.split('\n');
          lines.forEach(line => {
            if (line.trim()) {
              outputs.push({ type: 'stdout', data: line, time: Date.now() });
              
              // 实时推送
              if (streamId) {
                logDeployStage(streamId, stage, line, {
                  type: 'stdout',
                  level: 'info'
                });
              }
              
              if (onProgress) {
                onProgress({
                  type: 'log',
                  message: line,
                  level: 'info'
                }, stage);
              }
            }
          });
        }
      });
      
      // 实时错误输出
      child.stderr.on('data', (data) => {
        const text = data.toString('utf8').trim();
        if (text) {
          stderrData += text + '\n';
          
          // 逐行处理错误输出
          const lines = text.split('\n');
          lines.forEach(line => {
            if (line.trim()) {
              outputs.push({ type: 'stderr', data: line, time: Date.now() });
              
              // 实时推送
              if (streamId) {
                logDeployStage(streamId, stage, line, {
                  type: 'stderr',
                  level: 'error'
                });
              }
              
              if (onProgress) {
                onProgress({
                  type: 'log',
                  message: line,
                  level: 'error'
                }, stage);
              }
            }
          });
        }
      });
      
      child.on('close', (exitCode) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const success = exitCode === 0;
        
        const result = {
          success,
          exitCode,
          duration,
          startTime,
          endTime,
          outputs,
          stdout: stdoutData,
          stderr: stderrData,
          command,
          cwd: resolvedCwd
        };
        
        // 记录命令完成
        if (streamId) {
          logDeployStage(streamId, stage, `${label}完成 (${duration}ms, ${success ? '成功' : '失败'})`, {
            success,
            duration,
            exitCode,
            level: success ? 'success' : 'error'
          });
        }
        
        if (onProgress) {
          onProgress({
            type: 'stage_complete',
            message: `${label}${success ? '成功' : '失败'}`,
            success,
            duration,
            exitCode
          }, stage);
        }
        
        if (!success) {
          result.error = `命令执行失败，退出码: ${exitCode}`;
          
          if (stderrData) {
            result.error += `\n错误输出:\n${stderrData}`;
          }
          
          logger.error(`${label}失败:`, result.error);
        } else {
          logger.info(`${label}成功 (${duration}ms)`);
        }
        
        resolve(result);
      });
      
      child.on('error', (error) => {
        const errorMsg = `命令执行错误: ${error.message}`;
        logger.error(errorMsg);
        
        if (streamId) {
          logDeployStage(streamId, stage, `错误: ${errorMsg}`, {
            level: 'error',
            error: error.message
          });
        }
        
        if (onProgress) {
          onProgress({
            type: 'log',
            message: errorMsg,
            level: 'error'
          }, stage);
        }
        
        resolve({
          success: false,
          exitCode: -1,
          error: error.message,
          outputs: []
        });
      });
      
      // 设置超时（默认10分钟）
      const timeout = options.timeout || 600000;
      setTimeout(() => {
        if (child.exitCode === null) {
          child.kill('SIGKILL');
          
          const errorMsg = `${label}超时 (${timeout}ms)`;
          logger.error(errorMsg);
          
          if (streamId) {
            logDeployStage(streamId, stage, `超时: ${errorMsg}`, {
              level: 'error',
              timeout
            });
          }
          
          if (onProgress) {
            onProgress({
              type: 'stage_complete',
              message: `${label}超时`,
              success: false,
              timeout
            }, stage);
          }
          
          resolve({
            success: false,
            exitCode: -1,
            error: errorMsg,
            outputs
          });
        }
      }, timeout);
    });
  } catch (error) {
    logger.error(`${label}执行错误: ${error.message}`);
    
    if (streamId) {
      logDeployStage(streamId, stage, `执行错误: ${error.message}`, {
        level: 'error',
        error: error.message,
        stack: error.stack
      });
    }
    
    return {
      success: false,
      exitCode: -1,
      error: error.message,
      outputs: []
    };
  }
}

/**
 * 增强的自动部署函数
 */
async function autoDeployStream(project, options = {}) {
  const {
    onProgress = null,
    streamId = null,
    startStage = DEPLOY_STAGES.INIT
  } = options;
  
  const { local_path, project_type, name } = project;
  const types = project_type ? project_type.split(',') : [];
  
  // 初始化进度跟踪
  let stage = startStage;
  let totalProgress = 0;
  const stageWeights = {
    [DEPLOY_STAGES.INIT]: 5,
    [DEPLOY_STAGES.CLONE]: 30,
    [DEPLOY_STAGES.INSTALL]: 40,
    [DEPLOY_STAGES.BUILD]: 15,
    [DEPLOY_STAGES.START]: 10
  };
  
  const progress = (message, data = {}, currentStage = null) => {
    const stageToUse = currentStage || stage;
    
    if (streamId) {
      logDeployStage(streamId, stageToUse, message, {
        ...data,
        stage: stageToUse
      });
    }
    
    if (onProgress) {
      onProgress({
        type: 'log',
        message,
        ...data
      }, stageToUse);
    }
  };
  
  const setStage = (newStage, message = null) => {
    const oldStage = stage;
    stage = newStage;
    
    if (message) {
      progress(message, { transition: `${oldStage} -> ${newStage}` }, newStage);
    }
    
    // 更新进度
    const progressValue = Object.keys(stageWeights)
      .filter(s => s !== stage)
      .reduce((sum, s) => sum + (stageWeights[s] || 0), 0);
    
    totalProgress = progressValue;
    
    if (streamId) {
      logDeployProgress(streamId, totalProgress, 100);
    }
    
    if (onProgress) {
      onProgress({
        type: 'progress',
        value: totalProgress,
        total: 100
      }, stage);
    }
  };
  
  const results = {
    success: true,
    stages: {},
    errors: [],
    outputs: []
  };

  try {
    // 阶段 1: 初始化
    setStage(DEPLOY_STAGES.INIT, '开始部署流程...');
    
    if (!local_path) {
      throw new Error('项目本地路径未配置');
    }
    
    // 确保目录存在
    await fs.ensureDir(local_path);
    
    // 阶段 2: 克隆（如果需要）
    if (types.includes('git')) {
      setStage(DEPLOY_STAGES.CLONE, '克隆仓库...');
      
      // 模拟克隆过程
      progress('正在克隆 Git 仓库...', { step: 'clone_start' });
      
      const cloneResult = await executeCommandStream(
        `git clone --depth 1 ${project.git_url || 'https://github.com/example/repo.git'} "${local_path}"`,
        path.dirname(local_path),
        {},
        { streamId, stage: DEPLOY_STAGES.CLONE, label: '克隆仓库' }
      );
      
      if (!cloneResult.success) {
        results.success = false;
        results.errors.push('克隆仓库失败');
        throw new Error('克隆失败');
      }
      
      completeDeployStage(streamId, DEPLOY_STAGES.CLONE, true);
    }
    
    // 阶段 3: 安装依赖
    setStage(DEPLOY_STAGES.INSTALL, '安装项目依赖...');
    
    if (types.includes('nodejs')) {
      progress('检测包管理器...', { step: 'package_manager_detect' });
      
      const hasYarn = await fs.pathExists(path.join(local_path, 'yarn.lock'));
      const hasPnpm = await fs.pathExists(path.join(local_path, 'pnpm-lock.yaml'));
      
      const installCmd = hasPnpm ? 'pnpm install --ignore-scripts' : 
                        hasYarn ? 'yarn install --ignore-scripts' : 
                        'npm install --ignore-scripts';
      
      progress(`使用命令: ${installCmd}`, { step: 'install_start' });
      
      const installResult = await executeCommandStream(
        installCmd,
        local_path,
        {},
        { streamId, stage: DEPLOY_STAGES.INSTALL, label: '安装依赖', timeout: 300000 }
      );
      
      if (!installResult.success) {
        results.success = false;
        results.errors.push('依赖安装失败');
        progress('依赖安装失败，尝试清理缓存后重试...', { level: 'warning' });
        
        // 尝试清理缓存后重试
        await executeCommandStream(
          'npm cache clean --force',
          local_path,
          {},
          { streamId, stage: DEPLOY_STAGES.INSTALL, label: '清理缓存' }
        );
        
        const retryResult = await executeCommandStream(
          installCmd,
          local_path,
          {},
          { streamId, stage: DEPLOY_STAGES.INSTALL, label: '重试安装依赖' }
        );
        
        if (!retryResult.success) {
          throw new Error('依赖安装重试失败');
        }
      }
      
      completeDeployStage(streamId, DEPLOY_STAGES.INSTALL, true);
    }
    
    // 阶段 4: 构建
    setStage(DEPLOY_STAGES.BUILD, '构建项目...');
    
    if (types.includes('build') || types.includes('nodejs')) {
      progress('检测构建脚本...', { step: 'build_detect' });
      
      const buildScripts = [];
      try {
        const pkg = await fs.readJson(path.join(local_path, 'package.json'));
        if (pkg.scripts && pkg.scripts.build) {
          buildScripts.push('npm run build');
        }
      } catch (e) {
        // 没有 package.json 或读取失败
      }
      
      if (buildScripts.length > 0) {
        for (const buildCmd of buildScripts) {
          progress(`执行构建: ${buildCmd}`, { step: 'build_execute' });
          
          const buildResult = await executeCommandStream(
            buildCmd,
            local_path,
            {},
            { streamId, stage: DEPLOY_STAGES.BUILD, label: '构建项目', timeout: 180000 }
          );
          
          if (!buildResult.success) {
            results.success = false;
            results.errors.push('构建失败');
            progress('构建失败，但可能不是致命错误，继续尝试启动...', { level: 'warning' });
          }
        }
      } else {
        progress('没有检测到构建脚本，跳过构建阶段', { level: 'info' });
      }
      
      completeDeployStage(streamId, DEPLOY_STAGES.BUILD, true);
    }
    
    // 阶段 5: 启动
    setStage(DEPLOY_STAGES.START, '启动服务...');
    
    const startResult = await executeCommandStream(
      'npm start',
      local_path,
      {},
      { streamId, stage: DEPLOY_STAGES.START, label: '启动服务', timeout: 120000 }
    );
    
    if (!startResult.success) {
      results.success = false;
      results.errors.push('启动失败');
      
      // 尝试备用启动方式
      progress('标准启动方式失败，尝试备用方案...', { level: 'warning' });
      
      const alternativeResult = await executeCommandStream(
        'node server.js',
        local_path,
        {},
        { streamId, stage: DEPLOY_STAGES.START, label: '备用启动' }
      );
      
      if (!alternativeResult.success) {
        throw new Error('所有启动方式均失败');
      }
    }
    
    completeDeployStage(streamId, DEPLOY_STAGES.START, true);
    
    // 阶段 6: 完成
    setStage(DEPLOY_STAGES.COMPLETE, '部署流程完成');
    
  } catch (error) {
    logger.error('Deploy stream error:', error);
    
    results.success = false;
    results.errors.push(error.message);
    
    if (streamId) {
      logDeployStage(streamId, DEPLOY_STAGES.ERROR, `部署错误: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  return results;
}

/**
 * 开始部署流程（公开接口）
 */
async function startDeployStream(projectId, project, options = {}) {
  try {
    // 初始化部署日志流
    const streamId = initDeployLogStream(projectId, project.name);
    
    // 开始部署
    const result = await autoDeployStream(project, {
      ...options,
      streamId
    });
    
    // 完成部署流
    completeDeployStream(streamId, result.success, 
      result.success ? '项目部署成功' : '项目部署失败');
    
    return {
      success: result.success,
      streamId,
      errors: result.errors,
      stages: result.stages
    };
  } catch (error) {
    logger.error('Start deploy stream error:', error);
    
    return {
      success: false,
      streamId: null,
      errors: [error.message],
      stages: {}
    };
  }
}

module.exports = {
  autoDeployStream,
  startDeployStream,
  executeCommandStream,
  DEPLOY_STAGES
};