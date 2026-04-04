/**
 * 安全配置路由
 * 提供敏感信息加密存储的API接口
 */

const express = require('express');
const router = express.Router();
const secureStorage = require('../utils/secure-storage');
const cryptoUtils = require('../utils/crypto-utils');

// 中间件：验证请求体
const validateRequest = (req, res, next) => {
  if (!req.body) {
    return res.status(400).json({
      error: '请求体不能为空',
      code: 'EMPTY_BODY'
    });
  }
  next();
};

// 中间件：验证主密码
const validateMasterPassword = (req, res, next) => {
  const { masterPassword } = req.body;
  
  if (!masterPassword) {
    return res.status(400).json({
      error: '主密码不能为空',
      code: 'MISSING_MASTER_PASSWORD'
    });
  }
  
  if (typeof masterPassword !== 'string' || masterPassword.length < 8) {
    return res.status(400).json({
      error: '主密码必须为至少8个字符的字符串',
      code: 'INVALID_MASTER_PASSWORD'
    });
  }
  
  next();
};

// 中间件：检查存储是否初始化
const checkInitialized = (req, res, next) => {
  if (!secureStorage.isInitialized()) {
    return res.status(400).json({
      error: '安全存储未初始化，请先调用 /api/secure/initialize',
      code: 'STORAGE_NOT_INITIALIZED'
    });
  }
  next();
};

/**
 * @api {post} /api/secure/initialize 初始化安全存储
 * @apiName InitializeSecureStorage
 * @apiGroup SecureStorage
 * @apiDescription 初始化安全存储系统
 * 
 * @apiBody {String} masterPassword 主密码（至少8个字符）
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {String} message 成功消息
 * @apiSuccess {Object} info 存储信息
 * 
 * @apiError (400) {String} error 错误信息
 * @apiError (400) {String} code 错误代码
 */
router.post('/initialize', validateRequest, validateMasterPassword, async (req, res) => {
  try {
    const { masterPassword } = req.body;
    
    if (secureStorage.isInitialized()) {
      return res.status(400).json({
        error: '安全存储已初始化',
        code: 'ALREADY_INITIALIZED'
      });
    }
    
    await secureStorage.initialize(masterPassword);
    
    res.status(200).json({
      success: true,
      message: '安全存储初始化成功',
      info: {
        storageDir: secureStorage.storageDir,
        initializedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('初始化安全存储失败:', error);
    res.status(500).json({
      error: `初始化失败: ${error.message}`,
      code: 'INITIALIZATION_FAILED'
    });
  }
});

/**
 * @api {post} /api/secure/save 保存敏感信息
 * @apiName SaveSecureData
 * @apiGroup SecureStorage
 * @apiDescription 保存敏感信息到安全存储
 * 
 * @apiBody {String} masterPassword 主密码
 * @apiBody {String} key 存储键名
 * @apiBody {String} value 要存储的值
 * @apiBody {String} [description] 描述信息
 * @apiBody {Array} [tags] 标签数组
 * @apiBody {String} [expiresAt] 过期时间（ISO格式）
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {String} message 成功消息
 * @apiSuccess {String} key 存储的键名
 * 
 * @apiError (400) {String} error 错误信息
 * @apiError (400) {String} code 错误代码
 */
router.post('/save', validateRequest, validateMasterPassword, checkInitialized, async (req, res) => {
  try {
    const { masterPassword, key, value, description, tags, expiresAt } = req.body;
    
    if (!key || !value) {
      return res.status(400).json({
        error: 'key和value不能为空',
        code: 'MISSING_KEY_OR_VALUE'
      });
    }
    
    const metadata = {
      description: description || '',
      tags: tags || [],
      expiresAt: expiresAt || null
    };
    
    await secureStorage.save(key, value, masterPassword, metadata);
    
    res.status(200).json({
      success: true,
      message: '敏感信息保存成功',
      key
    });
  } catch (error) {
    console.error('保存敏感信息失败:', error);
    res.status(500).json({
      error: `保存失败: ${error.message}`,
      code: 'SAVE_FAILED'
    });
  }
});

/**
 * @api {post} /api/secure/get 获取敏感信息
 * @apiName GetSecureData
 * @apiGroup SecureStorage
 * @apiDescription 从安全存储获取敏感信息
 * 
 * @apiBody {String} masterPassword 主密码
 * @apiBody {String} key 存储键名
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {String} value 存储的值
 * @apiSuccess {Object} metadata 元数据
 * @apiSuccess {Object} storageInfo 存储信息
 * 
 * @apiError (400) {String} error 错误信息
 * @apiError (400) {String} code 错误代码
 */
router.post('/get', validateRequest, validateMasterPassword, checkInitialized, async (req, res) => {
  try {
    const { masterPassword, key } = req.body;
    
    if (!key) {
      return res.status(400).json({
        error: 'key不能为空',
        code: 'MISSING_KEY'
      });
    }
    
    const result = await secureStorage.get(key, masterPassword);
    
    res.status(200).json({
      success: true,
      value: result.value,
      metadata: result.metadata,
      storageInfo: result.storageInfo
    });
  } catch (error) {
    console.error('获取敏感信息失败:', error);
    
    if (error.message.includes('未找到存储项')) {
      res.status(404).json({
        error: error.message,
        code: 'ITEM_NOT_FOUND'
      });
    } else {
      res.status(500).json({
        error: `获取失败: ${error.message}`,
        code: 'GET_FAILED'
      });
    }
  }
});

/**
 * @api {post} /api/secure/list 列出存储项
 * @apiName ListSecureData
 * @apiGroup SecureStorage
 * @apiDescription 列出所有存储项（仅元数据）
 * 
 * @apiBody {String} masterPassword 主密码
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {Array} items 存储项列表
 * 
 * @apiError (400) {String} error 错误信息
 * @apiError (400) {String} code 错误代码
 */
router.post('/list', validateRequest, validateMasterPassword, checkInitialized, async (req, res) => {
  try {
    const { masterPassword } = req.body;
    
    const items = await secureStorage.list(masterPassword);
    
    res.status(200).json({
      success: true,
      items
    });
  } catch (error) {
    console.error('列出存储项失败:', error);
    res.status(500).json({
      error: `列出失败: ${error.message}`,
      code: 'LIST_FAILED'
    });
  }
});

/**
 * @api {post} /api/secure/delete 删除存储项
 * @apiName DeleteSecureData
 * @apiGroup SecureStorage
 * @apiDescription 删除存储项
 * 
 * @apiBody {String} masterPassword 主密码
 * @apiBody {String} key 存储键名
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {String} message 成功消息
 * 
 * @apiError (400) {String} error 错误信息
 * @apiError (400) {String} code 错误代码
 */
router.post('/delete', validateRequest, validateMasterPassword, checkInitialized, async (req, res) => {
  try {
    const { masterPassword, key } = req.body;
    
    if (!key) {
      return res.status(400).json({
        error: 'key不能为空',
        code: 'MISSING_KEY'
      });
    }
    
    const success = await secureStorage.delete(key, masterPassword);
    
    res.status(200).json({
      success,
      message: success ? '存储项删除成功' : '存储项不存在'
    });
  } catch (error) {
    console.error('删除存储项失败:', error);
    res.status(500).json({
      error: `删除失败: ${error.message}`,
      code: 'DELETE_FAILED'
    });
  }
});

/**
 * @api {post} /api/secure/clear 清空所有存储
 * @apiName ClearSecureData
 * @apiGroup SecureStorage
 * @apiDescription 清空所有存储项
 * 
 * @apiBody {String} masterPassword 主密码
 * @apiBody {Boolean} [confirm=false] 确认操作
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {String} message 成功消息
 * 
 * @apiError (400) {String} error 错误信息
 * @apiError (400) {String} code 错误代码
 */
router.post('/clear', validateRequest, validateMasterPassword, checkInitialized, async (req, res) => {
  try {
    const { masterPassword, confirm } = req.body;
    
    if (confirm !== true) {
      return res.status(400).json({
        error: '请确认清空操作，设置confirm=true',
        code: 'CONFIRMATION_REQUIRED'
      });
    }
    
    await secureStorage.clear(masterPassword);
    
    res.status(200).json({
      success: true,
      message: '所有存储项已清空'
    });
  } catch (error) {
    console.error('清空存储失败:', error);
    res.status(500).json({
      error: `清空失败: ${error.message}`,
      code: 'CLEAR_FAILED'
    });
  }
});

/**
 * @api {post} /api/secure/migrate 从环境变量迁移
 * @apiName MigrateFromEnv
 * @apiGroup SecureStorage
 * @apiDescription 从环境变量迁移敏感信息到安全存储
 * 
 * @apiBody {String} masterPassword 主密码
 * @apiBody {Object} [envConfig] 环境变量配置（可选，默认使用process.env）
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {Object} report 迁移报告
 * 
 * @apiError (400) {String} error 错误信息
 * @apiError (400) {String} code 错误代码
 */
router.post('/migrate', validateRequest, validateMasterPassword, async (req, res) => {
  try {
    const { masterPassword, envConfig } = req.body;
    
    // 如果未提供envConfig，使用process.env
    const configToMigrate = envConfig || process.env;
    
    const report = await secureStorage.migrateFromEnv(configToMigrate, masterPassword);
    
    res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    console.error('迁移环境变量失败:', error);
    res.status(500).json({
      error: `迁移失败: ${error.message}`,
      code: 'MIGRATION_FAILED'
    });
  }
});

/**
 * @api {post} /api/secure/stats 获取存储统计
 * @apiName GetStorageStats
 * @apiGroup SecureStorage
 * @apiDescription 获取安全存储的统计信息
 * 
 * @apiBody {String} masterPassword 主密码
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {Object} stats 统计信息
 * 
 * @apiError (400) {String} error 错误信息
 * @apiError (400) {String} code 错误代码
 */
router.post('/stats', validateRequest, validateMasterPassword, checkInitialized, async (req, res) => {
  try {
    const { masterPassword } = req.body;
    
    const stats = await secureStorage.getStats(masterPassword);
    
    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      error: `获取失败: ${error.message}`,
      code: 'STATS_FAILED'
    });
  }
});

/**
 * @api {post} /api/secure/backup 备份安全存储
 * @apiName BackupSecureStorage
 * @apiGroup SecureStorage
 * @apiDescription 备份安全存储数据
 * 
 * @apiBody {String} masterPassword 主密码
 * @apiBody {String} [backupPath] 备份文件路径（可选）
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {String} message 成功消息
 * @apiSuccess {String} backupFile 备份文件路径
 * 
 * @apiError (400) {String} error 错误信息
 * @apiError (400) {String} code 错误代码
 */
router.post('/backup', validateRequest, validateMasterPassword, checkInitialized, async (req, res) => {
  try {
    const { masterPassword, backupPath } = req.body;
    
    const backupFile = await secureStorage.backup(backupPath, masterPassword);
    
    res.status(200).json({
      success: true,
      message: '安全存储备份成功',
      backupFile
    });
  } catch (error) {
    console.error('备份失败:', error);
    res.status(500).json({
      error: `备份失败: ${error.message}`,
      code: 'BACKUP_FAILED'
    });
  }
});

/**
 * @api {post} /api/secure/restore 从备份恢复
 * @apiName RestoreSecureStorage
 * @apiGroup SecureStorage
 * @apiDescription 从备份文件恢复安全存储
 * 
 * @apiBody {String} masterPassword 主密码
 * @apiBody {String} backupFile 备份文件路径
 * @apiBody {Boolean} [confirm=false] 确认操作
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {String} message 成功消息
 * 
 * @apiError (400) {String} error 错误信息
 * @apiError (400) {String} code 错误代码
 */
router.post('/restore', validateRequest, validateMasterPassword, async (req, res) => {
  try {
    const { masterPassword, backupFile, confirm } = req.body;
    
    if (!backupFile) {
      return res.status(400).json({
        error: 'backupFile不能为空',
        code: 'MISSING_BACKUP_FILE'
      });
    }
    
    if (confirm !== true) {
      return res.status(400).json({
        error: '请确认恢复操作，设置confirm=true',
        code: 'CONFIRMATION_REQUIRED'
      });
    }
    
    await secureStorage.restore(backupFile, masterPassword);
    
    res.status(200).json({
      success: true,
      message: '安全存储恢复成功'
    });
  } catch (error) {
    console.error('恢复失败:', error);
    res.status(500).json({
      error: `恢复失败: ${error.message}`,
      code: 'RESTORE_FAILED'
    });
  }
});

/**
 * @api {get} /api/secure/status 获取存储状态
 * @apiName GetStorageStatus
 * @apiGroup SecureStorage
 * @apiDescription 获取安全存储的状态信息
 * 
 * @apiSuccess {Boolean} initialized 是否已初始化
 * @apiSuccess {String} storageDir 存储目录
 * @apiSuccess {String} algorithm 加密算法
 */
router.get('/status', (req, res) => {
  try {
    const status = {
      initialized: secureStorage.isInitialized(),
      storageDir: secureStorage.storageDir,
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2-SHA256 (100,000 iterations)',
      maxAttempts: secureStorage.maxAttempts,
      lockDuration: '15 minutes'
    };
    
    res.status(200).json(status);
  } catch (error) {
    console.error('获取状态失败:', error);
    res.status(500).json({
      error: `获取状态失败: ${error.message}`,
      code: 'STATUS_FAILED'
    });
  }
});

/**
 * @api {post} /api/secure/generate-token 生成安全令牌
 * @apiName GenerateSecureToken
 * @apiGroup SecureStorage
 * @apiDescription 生成安全随机令牌
 * 
 * @apiBody {Number} [length=32] 令牌长度
 * 
 * @apiSuccess {Boolean} success 是否成功
 * @apiSuccess {String} token 生成的令牌
 */
router.post('/generate-token', (req, res) => {
  try {
    const { length = 32 } = req.body;
    
    if (length < 8 || length > 256) {
      return res.status(400).json({
        error: '令牌长度必须在8-256之间',
        code: 'INVALID_TOKEN_LENGTH'
      });
    }
    
    const token = cryptoUtils.generateSecureToken(length);
    
    res.status(200).json({
      success: true,
      token
    });
  } catch (error) {
    console.error('生成令牌失败:', error);
    res.status(500).json({
      error: `生成令牌失败: ${error.message}`,
      code: 'TOKEN_GENERATION_FAILED'
    });
  }
});

module.exports = router;