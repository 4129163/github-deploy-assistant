/**
 * 审计日志集成模块
 * 将审计日志功能集成到所有敏感操作中
 */

const { auditLogEnhanced, AUDIT_ACTION_TYPES, wrapCliCommand } = require('../services/audit-log-enhanced');
const { logger } = require('../utils/logger');

/**
 * 包装项目删除操作
 */
function wrapProjectDelete(originalDeleteFunction) {
  return async function(projectId, options = {}) {
    const startTime = Date.now();
    let success = false;
    let resultDetails = {};
    
    try {
      // 获取项目信息（用于审计日志）
      const { ProjectDB } = require('../services/database');
      const project = await ProjectDB.getById(projectId);
      
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      
      // 执行原始删除操作
      const deleteResult = await originalDeleteFunction(projectId, options);
      success = true;
      resultDetails = {
        project_id: projectId,
        project_name: project.name,
        project_path: project.local_path,
        keep_backups: options.keepBackups || false,
        keep_data: options.keepData || false,
        result: deleteResult
      };
      
      return deleteResult;
      
    } catch (error) {
      resultDetails = {
        project_id: projectId,
        error: error.message,
        stack: error.stack
      };
      throw error;
      
    } finally {
      const duration = Date.now() - startTime;
      
      // 记录审计日志
      await auditLogEnhanced(AUDIT_ACTION_TYPES.PROJECT_DELETE, {
        ...resultDetails,
        success,
        duration_ms: duration,
        operation: 'project_delete',
        options
      }).catch(err => {
        logger.warn('Failed to record audit log for project delete:', err.message);
      });
    }
  };
}

/**
 * 包装配置更新操作
 */
function wrapConfigUpdate(originalUpdateFunction) {
  return async function(configKey, configValue, options = {}) {
    const startTime = Date.now();
    let success = false;
    let resultDetails = {};
    
    try {
      // 执行原始更新操作
      const updateResult = await originalUpdateFunction(configKey, configValue, options);
      success = true;
      resultDetails = {
        config_key: configKey,
        config_value: typeof configValue === 'string' ? configValue : '[object]',
        old_value: options.oldValue || 'unknown',
        result: updateResult
      };
      
      return updateResult;
      
    } catch (error) {
      resultDetails = {
        config_key: configKey,
        error: error.message
      };
      throw error;
      
    } finally {
      const duration = Date.now() - startTime;
      
      // 记录审计日志
      const actionType = configKey.includes('secret') || configKey.includes('password') || configKey.includes('token')
        ? AUDIT_ACTION_TYPES.CONFIG_UPDATE
        : AUDIT_ACTION_TYPES.CONFIG_UPDATE;
      
      await auditLogEnhanced(actionType, {
        ...resultDetails,
        success,
        duration_ms: duration,
        operation: 'config_update',
        is_sensitive: configKey.includes('secret') || configKey.includes('password') || configKey.includes('token')
      }).catch(err => {
        logger.warn('Failed to record audit log for config update:', err.message);
      });
    }
  };
}

/**
 * 包装远程部署操作
 */
function wrapRemoteDeploy(originalDeployFunction) {
  return async function(projectId, deployOptions = {}) {
    const startTime = Date.now();
    let success = false;
    let resultDetails = {};
    
    try {
      // 获取项目信息
      const { ProjectDB } = require('../services/database');
      const project = await ProjectDB.getById(projectId);
      
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }
      
      // 执行原始部署操作
      const deployResult = await originalDeployFunction(projectId, deployOptions);
      success = true;
      resultDetails = {
        project_id: projectId,
        project_name: project.name,
        target_environment: deployOptions.environment || 'production',
        deployment_type: deployOptions.type || 'manual',
        branch: deployOptions.branch || project.branch || 'main',
        commit_hash: deployOptions.commit || 'latest',
        result: deployResult
      };
      
      return deployResult;
      
    } catch (error) {
      resultDetails = {
        project_id: projectId,
        error: error.message,
        stack: error.stack
      };
      throw error;
      
    } finally {
      const duration = Date.now() - startTime;
      
      // 记录审计日志
      await auditLogEnhanced(AUDIT_ACTION_TYPES.REMOTE_DEPLOY, {
        ...resultDetails,
        success,
        duration_ms: duration,
        operation: 'remote_deploy',
        options: {
          ...deployOptions,
          // 隐藏敏感信息
          credentials: deployOptions.credentials ? '[REDACTED]' : undefined,
          api_key: deployOptions.api_key ? '[REDACTED]' : undefined
        }
      }).catch(err => {
        logger.warn('Failed to record audit log for remote deploy:', err.message);
      });
    }
  };
}

/**
 * 包装系统备份操作
 */
function wrapSystemBackup(originalBackupFunction) {
  return async function(backupOptions = {}) {
    const startTime = Date.now();
    let success = false;
    let resultDetails = {};
    
    try {
      // 执行原始备份操作
      const backupResult = await originalBackupFunction(backupOptions);
      success = true;
      resultDetails = {
        backup_type: backupOptions.type || 'full',
        backup_scope: backupOptions.scope || 'all',
        backup_path: backupResult.path || 'unknown',
        backup_size: backupResult.size || 0,
        file_count: backupResult.fileCount || 0,
        result: backupResult
      };
      
      return backupResult;
      
    } catch (error) {
      resultDetails = {
        error: error.message
      };
      throw error;
      
    } finally {
      const duration = Date.now() - startTime;
      
      // 记录审计日志
      await auditLogEnhanced(AUDIT_ACTION_TYPES.SYSTEM_BACKUP, {
        ...resultDetails,
        success,
        duration_ms: duration,
        operation: 'system_backup',
        options: backupOptions
      }).catch(err => {
        logger.warn('Failed to record audit log for system backup:', err.message);
      });
    }
  };
}

/**
 * 包装系统恢复操作
 */
function wrapSystemRestore(originalRestoreFunction) {
  return async function(backupId, restoreOptions = {}) {
    const startTime = Date.now();
    let success = false;
    let resultDetails = {};
    
    try {
      // 执行原始恢复操作
      const restoreResult = await originalRestoreFunction(backupId, restoreOptions);
      success = true;
      resultDetails = {
        backup_id: backupId,
        restore_scope: restoreOptions.scope || 'all',
        restore_path: restoreResult.path || 'unknown',
        restored_files: restoreResult.fileCount || 0,
        result: restoreResult
      };
      
      return restoreResult;
      
    } catch (error) {
      resultDetails = {
        backup_id: backupId,
        error: error.message
      };
      throw error;
      
    } finally {
      const duration = Date.now() - startTime;
      
      // 记录审计日志
      await auditLogEnhanced(AUDIT_ACTION_TYPES.SYSTEM_RESTORE, {
        ...resultDetails,
        success,
        duration_ms: duration,
        operation: 'system_restore',
        options: restoreOptions
      }).catch(err => {
        logger.warn('Failed to record audit log for system restore:', err.message);
      });
    }
  };
}

/**
 * 包装服务安装操作
 */
function wrapServiceInstall(originalInstallFunction) {
  return async function(serviceOptions = {}) {
    const startTime = Date.now();
    let success = false;
    let resultDetails = {};
    
    try {
      // 执行原始安装操作
      const installResult = await originalInstallFunction(serviceOptions);
      success = true;
      resultDetails = {
        service_type: serviceOptions.type || 'systemd',
        service_name: serviceOptions.name || 'gada-service',
        install_path: installResult.path || 'unknown',
        result: installResult
      };
      
      return installResult;
      
    } catch (error) {
      resultDetails = {
        error: error.message
      };
      throw error;
      
    } finally {
      const duration = Date.now() - startTime;
      
      // 记录审计日志
      await auditLogEnhanced(AUDIT_ACTION_TYPES.SERVICE_INSTALL, {
        ...resultDetails,
        success,
        duration_ms: duration,
        operation: 'service_install',
        options: serviceOptions
      }).catch(err => {
        logger.warn('Failed to record audit log for service install:', err.message);
      });
    }
  };
}

/**
 * 包装服务卸载操作
 */
function wrapServiceUninstall(originalUninstallFunction) {
  return async function(serviceOptions = {}) {
    const startTime = Date.now();
    let success = false;
    let resultDetails = {};
    
    try {
      // 执行原始卸载操作
      const uninstallResult = await originalUninstallFunction(serviceOptions);
      success = true;
      resultDetails = {
        service_type: serviceOptions.type || 'systemd',
        service_name: serviceOptions.name || 'gada-service',
        result: uninstallResult
      };
      
      return uninstallResult;
      
    } catch (error) {
      resultDetails = {
        error: error.message
      };
      throw error;
      
    } finally {
      const duration = Date.now() - startTime;
      
      // 记录审计日志
      await auditLogEnhanced(AUDIT_ACTION_TYPES.SERVICE_UNINSTALL, {
        ...resultDetails,
        success,
        duration_ms: duration,
        operation: 'service_uninstall',
        options: serviceOptions
      }).catch(err => {
        logger.warn('Failed to record audit log for service uninstall:', err.message);
      });
    }
  };
}

/**
 * 包装数据导出操作
 */
function wrapDataExport(originalExportFunction) {
  return async function(exportOptions = {}) {
    const startTime = Date.now();
    let success = false;
    let resultDetails = {};
    
    try {
      // 执行原始导出操作
      const exportResult = await originalExportFunction(exportOptions);
      success = true;
      resultDetails = {
        export_type: exportOptions.type || 'all',
        export_format: exportOptions.format || 'json',
        export_path: exportResult.path || 'unknown',
        data_size: exportResult.size || 0,
        record_count: exportResult.count || 0,
        result: exportResult
      };
      
      return exportResult;
      
    } catch (error) {
      resultDetails = {
        error: error.message
      };
      throw error;
      
    } finally {
      const duration = Date.now() - startTime;
      
      // 记录审计日志
      await auditLogEnhanced(AUDIT_ACTION_TYPES.DATA_EXPORT, {
        ...resultDetails,
        success,
        duration_ms: duration,
        operation: 'data_export',
        options: exportOptions
      }).catch(err => {
        logger.warn('Failed to record audit log for data export:', err.message);
      });
    }
  };
}

/**
 * 包装数据删除操作
 */
function wrapDataDelete(originalDeleteFunction) {
  return async function(deleteOptions = {}) {
    const startTime = Date.now();
    let success = false;
    let resultDetails = {};
    
    try {
      // 执行原始删除操作
      const deleteResult = await originalDeleteFunction(deleteOptions);
      success = true;
      resultDetails = {
        delete_type: deleteOptions.type || 'temporary',
        delete_scope: deleteOptions.scope || 'logs',
        delete_count: deleteResult.count || 0,
        freed_space: deleteResult.freedSpace || 0,
        result: deleteResult
      };
      
      return deleteResult;
      
    } catch (error) {
      resultDetails = {
        error: error.message
      };
      throw error;
      
    } finally {
      const duration = Date.now() - startTime;
      
      // 记录审计日志
      await auditLogEnhanced(AUDIT_ACTION_TYPES.DATA_DELETE, {
        ...resultDetails,
        success,
        duration_ms: duration,
        operation: 'data_delete',
        options: deleteOptions
      }).catch(err => {
        logger.warn('Failed to record audit log for data delete:', err.message);
      });
    }
  };
}

/**
 * 初始化审计日志集成
 */
async function initializeAuditIntegration() {
  try {
    logger.info('Initializing audit log integration...');
    
    // 这里可以添加自动包装现有函数的逻辑
    // 例如：遍历模块并包装敏感操作
    
    logger.info('Audit log integration initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize audit log integration:', error);
    return false;
  }
}

/**
 * 获取已包装的函数列表
 */
function getWrappedFunctions() {
  return {
    wrapProjectDelete,
    wrapConfigUpdate,
    wrapRemoteDeploy,
    wrapSystemBackup,
    wrapSystemRestore,
    wrapServiceInstall,
    wrapServiceUninstall,
    wrapDataExport,
    wrapDataDelete
  };
}

module.exports = {
  // 包装函数
  wrapProjectDelete,
  wrapConfigUpdate,
  wrapRemoteDeploy,
  wrapSystemBackup,
  wrapSystemRestore,
  wrapServiceInstall,
  wrapServiceUninstall,
  wrapDataExport,
  wrapDataDelete,
  
  // 工具函数
  initializeAuditIntegration,
  getWrappedFunctions
};