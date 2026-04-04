/**
 * 部署错误捕获中间件
 * 自动捕获部署过程中的错误日志，触发AI诊断
 */

const { logger } = require('../utils/logger');
const { diagnoseDeploymentError, validateFixCommands } = require('../services/ai');
const { DeploymentDiagnosisDB, ProjectDB } = require('../services/database');

/**
 * 部署错误捕获中间件
 * 拦截部署命令的输出，检测错误并触发AI诊断
 */
function createDeployErrorCatcher(io = null) {
  return async function deployErrorCatcher(req, res, next) {
    const originalSend = res.send;
    const originalJson = res.json;
    
    // 只拦截部署相关的API
    const isDeployApi = req.path.includes('/api/deploy') || req.path.includes('/api/remote-deploy');
    if (!isDeployApi) {
      return next();
    }
    
    // 收集响应数据
    let responseData = null;
    let responseStatus = 200;
    
    // 重写 res.json 方法
    res.json = function(data) {
      responseData = data;
      responseStatus = this.statusCode;
      return originalJson.call(this, data);
    };
    
    // 重写 res.send 方法
    res.send = function(data) {
      responseData = data;
      responseStatus = this.statusCode;
      return originalSend.call(this, data);
    };
    
    // 在响应完成后处理
    res.on('finish', async () => {
      try {
        // 只处理失败的部署请求
        if (responseStatus >= 200 && responseStatus < 300) {
          return;
        }
        
        // 提取错误信息
        const errorInfo = extractErrorInfo(req, responseData);
        if (!errorInfo.hasError) {
          return;
        }
        
        logger.info(`检测到部署错误: ${errorInfo.projectName || '未知项目'}, 命令: ${errorInfo.command}`);
        
        // 获取项目信息
        let project = null;
        if (errorInfo.projectId) {
          project = await ProjectDB.getById(errorInfo.projectId).catch(() => null);
        }
        
        // 保存错误记录到数据库
        const diagnosisRecord = await DeploymentDiagnosisDB.create({
          project_id: errorInfo.projectId || null,
          deployment_id: errorInfo.deploymentId || null,
          error_log: errorInfo.errorLog.substring(0, 10000), // 限制长度
          failed_command: errorInfo.command || 'unknown',
          ai_diagnosis: { status: 'PENDING' },
          risk_level: 'MEDIUM',
          status: 'PENDING'
        });
        
        // 触发AI诊断（异步）
        setTimeout(async () => {
          try {
            if (project) {
              await triggerAIDiagnosis(
                diagnosisRecord.id, 
                project, 
                errorInfo.errorLog, 
                errorInfo.command,
                io
              );
            }
          } catch (diagnosisError) {
            logger.error(`AI诊断触发失败: ${diagnosisError.message}`);
          }
        }, 1000); // 延迟1秒执行，避免阻塞响应
        
        // 通过WebSocket通知前端
        if (io && errorInfo.projectId) {
          io.to(`project-${errorInfo.projectId}`).emit('deployment_error', {
            diagnosisId: diagnosisRecord.id,
            projectId: errorInfo.projectId,
            errorSummary: errorInfo.errorLog.substring(0, 200),
            timestamp: new Date().toISOString()
          });
        }
        
      } catch (error) {
        logger.error(`部署错误捕获中间件异常: ${error.message}`, {
          stack: error.stack,
          path: req.path,
          method: req.method
        });
      }
    });
    
    next();
  };
}

/**
 * 提取错误信息
 */
function extractErrorInfo(req, responseData) {
  const result = {
    hasError: false,
    projectId: null,
    deploymentId: null,
    projectName: null,
    command: null,
    errorLog: ''
  };
  
  try {
    // 从请求中提取项目ID
    if (req.params.projectId) {
      result.projectId = parseInt(req.params.projectId, 10);
    }
    
    // 从请求体中提取信息
    if (req.body) {
      if (req.body.project_id) {
        result.projectId = parseInt(req.body.project_id, 10);
      }
      if (req.body.project_name) {
        result.projectName = req.body.project_name;
      }
      if (req.body.command) {
        result.command = req.body.command;
      }
    }
    
    // 从响应数据中提取错误信息
    if (responseData) {
      let errorText = '';
      
      if (typeof responseData === 'string') {
        errorText = responseData;
      } else if (typeof responseData === 'object') {
        if (responseData.error) {
          errorText = typeof responseData.error === 'string' 
            ? responseData.error 
            : JSON.stringify(responseData.error);
        }
        if (responseData.message) {
          errorText += (errorText ? '\n' : '') + responseData.message;
        }
        if (responseData.details) {
          errorText += (errorText ? '\n' : '') + responseData.details;
        }
        
        // 提取部署ID
        if (responseData.deployment_id) {
          result.deploymentId = responseData.deployment_id;
        }
        if (responseData.id) {
          result.deploymentId = responseData.id;
        }
      }
      
      if (errorText) {
        result.errorLog = errorText;
        result.hasError = true;
      }
    }
    
    // 如果没有命令信息，从请求路径推断
    if (!result.command && req.path) {
      if (req.path.includes('/deploy')) {
        result.command = 'deploy';
      } else if (req.path.includes('/install')) {
        result.command = 'install';
      } else if (req.path.includes('/build')) {
        result.command = 'build';
      } else if (req.path.includes('/start')) {
        result.command = 'start';
      }
    }
    
  } catch (error) {
    logger.warn(`提取错误信息失败: ${error.message}`);
  }
  
  return result;
}

/**
 * 触发AI诊断
 */
async function triggerAIDiagnosis(diagnosisId, project, errorLog, failedCommand, io = null) {
  try {
    logger.info(`开始AI诊断: 诊断ID=${diagnosisId}, 项目=${project.name}`);
    
    // 更新状态为分析中
    await DeploymentDiagnosisDB.updateStatus(diagnosisId, 'ANALYZED');
    
    // 调用AI诊断
    const diagnosisResult = await diagnoseDeploymentError(
      {
        name: project.name,
        repo_url: project.repo_url,
        project_type: project.project_type,
        local_path: project.local_path
      },
      errorLog,
      failedCommand
    );
    
    // 验证修复命令安全性
    const validationResult = validateFixCommands(diagnosisResult.fix_commands || []);
    diagnosisResult.commands_validated = validationResult;
    
    // 如果验证不通过，标记为不可自动修复
    if (!validationResult.all_safe) {
      diagnosisResult.auto_fixable = false;
      diagnosisResult.risk_level = 'HIGH';
      diagnosisResult.suggestion += '\n\n⚠️ 注意：部分修复命令需要人工审核安全性。';
    }
    
    // 保存诊断结果
    await DeploymentDiagnosisDB.updateStatus(diagnosisId, 'ANALYZED', {
      ai_diagnosis: diagnosisResult,
      risk_level: diagnosisResult.risk_level || 'MEDIUM'
    });
    
    logger.info(`AI诊断完成: 诊断ID=${diagnosisId}, 可自动修复=${diagnosisResult.auto_fixable}`);
    
    // 通过WebSocket通知前端
    if (io && project.id) {
      io.to(`project-${project.id}`).emit('ai_diagnosis_ready', {
        diagnosisId,
        projectId: project.id,
        autoFixable: diagnosisResult.auto_fixable,
        riskLevel: diagnosisResult.risk_level,
        analysis: diagnosisResult.analysis,
        suggestion: diagnosisResult.suggestion,
        timestamp: new Date().toISOString()
      });
    }
    
    return diagnosisResult;
    
  } catch (error) {
    logger.error(`AI诊断失败: ${error.message}`);
    
    // 保存错误信息
    await DeploymentDiagnosisDB.updateStatus(diagnosisId, 'FAILED', {
      ai_diagnosis: {
        error: error.message,
        status: 'FAILED'
      },
      risk_level: 'HIGH'
    });
    
    throw error;
  }
}

/**
 * 手动触发诊断（用于测试或外部调用）
 */
async function manualTriggerDiagnosis(projectId, errorLog, command = 'unknown') {
  try {
    const project = await ProjectDB.getById(projectId);
    if (!project) {
      throw new Error(`项目不存在: ${projectId}`);
    }
    
    const diagnosisRecord = await DeploymentDiagnosisDB.create({
      project_id: projectId,
      error_log: errorLog.substring(0, 10000),
      failed_command: command,
      ai_diagnosis: { status: 'PENDING' },
      risk_level: 'MEDIUM',
      status: 'PENDING'
    });
    
    const result = await triggerAIDiagnosis(
      diagnosisRecord.id,
      project,
      errorLog,
      command
    );
    
    return {
      diagnosisId: diagnosisRecord.id,
      ...result
    };
    
  } catch (error) {
    logger.error(`手动触发诊断失败: ${error.message}`);
    throw error;
  }
}

/**
 * 获取项目最近的诊断记录
 */
async function getRecentDiagnoses(projectId, limit = 10) {
  try {
    return await DeploymentDiagnosisDB.getByProjectId(projectId, limit);
  } catch (error) {
    logger.error(`获取诊断记录失败: ${error.message}`);
    throw error;
  }
}

/**
 * 获取诊断详情
 */
async function getDiagnosisDetail(diagnosisId) {
  try {
    return await DeploymentDiagnosisDB.getById(diagnosisId);
  } catch (error) {
    logger.error(`获取诊断详情失败: ${error.message}`);
    throw error;
  }
}

module.exports = {
  createDeployErrorCatcher,
  manualTriggerDiagnosis,
  getRecentDiagnoses,
  getDiagnosisDetail,
  triggerAIDiagnosis
};