/**
 * 一键修复路由
 */

const express = require('express');
const router = express.Router();
const AutoFixManager = require('../deploy-precheck/fixers/AutoFixManager');
const DeployPrecheck = require('../deploy-precheck');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');

/**
 * 启动一键修复
 * POST /api/precheck/fix/start
 */
router.post('/start', async (req, res) => {
  try {
    const { 
      checkId, 
      issueIds = [], 
      userConfirmation = false 
    } = req.body;

    if (!checkId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数: checkId' 
      });
    }

    // 获取预检结果以获取项目信息
    const precheckResult = DeployPrecheck.getResult(checkId);
    if (!precheckResult) {
      return res.status(404).json({ 
        success: false, 
        error: '预检结果不存在或已过期' 
      });
    }

    // 获取项目信息
    const project = await ProjectDB.getById(precheckResult.projectId);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: '项目不存在' 
      });
    }

    // 启动一键修复
    const result = await AutoFixManager.runAutoFix({
      checkId,
      issueIds,
      project,
      userConfirmation
    });

    res.json({
      success: true,
      data: {
        fixId: result.fixId,
        status: result.status,
        startTime: result.startTime,
        requiresConfirmation: result.requiresConfirmation,
        confirmationRequiredIssues: result.confirmationRequiredIssues,
        message: result.message
      }
    });

    logger.info(`一键修复启动成功: ${result.fixId}, 检查ID: ${checkId}`);

  } catch (error) {
    logger.error('启动一键修复失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 获取修复结果
 * GET /api/precheck/fix/result/:fixId
 */
router.get('/result/:fixId', async (req, res) => {
  try {
    const { fixId } = req.params;
    const { format } = req.query;

    const result = AutoFixManager.getResult(fixId);
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        error: '修复结果不存在或已过期' 
      });
    }

    // 如果指定了格式，返回格式化报告
    if (format && ['json', 'markdown', 'html'].includes(format)) {
      try {
        const report = await AutoFixManager.exportReport(result, format);
        
        if (format === 'json') {
          res.json(JSON.parse(report));
        } else if (format === 'html') {
          res.setHeader('Content-Type', 'text/html');
          res.send(report);
        } else {
          res.setHeader('Content-Type', 'text/markdown');
          res.send(report);
        }
        return;
      } catch (reportError) {
        logger.error('生成修复报告失败:', reportError);
      }
    }

    // 返回原始结果
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('获取修复结果失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 获取修复进度
 * GET /api/precheck/fix/progress/:fixId
 */
router.get('/progress/:fixId', async (req, res) => {
  try {
    const { fixId } = req.params;

    const progress = AutoFixManager.getProgress(fixId);
    
    if (progress.status === 'not_found') {
      return res.status(404).json({ 
        success: false, 
        error: '修复不存在或已结束' 
      });
    }

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    logger.error('获取修复进度失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 确认高风险修复
 * POST /api/precheck/fix/confirm
 */
router.post('/confirm', async (req, res) => {
  try {
    const { fixId, confirmedIssues = [] } = req.body;

    if (!fixId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数: fixId' 
      });
    }

    // 获取修复结果
    const fixResult = AutoFixManager.getResult(fixId);
    if (!fixResult) {
      return res.status(404).json({ 
        success: false, 
        error: '修复不存在或已过期' 
      });
    }

    if (fixResult.status !== 'requires_confirmation') {
      return res.status(400).json({ 
        success: false, 
        error: '修复不需要确认' 
      });
    }

    // 重新启动修复，传入用户确认
    const result = await AutoFixManager.runAutoFix({
      checkId: fixResult.checkId,
      issueIds: confirmedIssues.length > 0 ? confirmedIssues : undefined,
      project: { id: fixResult.projectId },
      userConfirmation: true,
      fixId: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // 新的修复ID
    });

    res.json({
      success: true,
      data: {
        newFixId: result.fixId,
        status: result.status,
        message: result.message
      }
    });

    logger.info(`用户确认修复: ${fixId} -> ${result.fixId}`);

  } catch (error) {
    logger.error('确认修复失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 获取修复历史
 * GET /api/precheck/fix/history
 */
router.get('/history', async (req, res) => {
  try {
    const { projectId, limit = 10 } = req.query;

    const history = AutoFixManager.getHistory(projectId, parseInt(limit));

    res.json({
      success: true,
      data: {
        history,
        total: history.length
      }
    });

  } catch (error) {
    logger.error('获取修复历史失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 获取支持的修复类型
 * GET /api/precheck/fix/supported-types
 */
router.get('/supported-types', async (req, res) => {
  try {
    const supportedTypes = AutoFixManager.getSupportedFixTypes();

    res.json({
      success: true,
      data: supportedTypes
    });

  } catch (error) {
    logger.error('获取支持的修复类型失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 清理修复历史
 * POST /api/precheck/fix/clear-history
 */
router.post('/clear-history', async (req, res) => {
  try {
    const { maxAge } = req.body; // 毫秒
    
    const cleared = AutoFixManager.clearHistory(maxAge);
    
    res.json({
      success: true,
      data: {
        clearedCount: cleared,
        message: `清理了 ${cleared} 条历史记录`
      }
    });

    logger.info(`清理修复历史: ${cleared} 条记录`);

  } catch (error) {
    logger.error('清理修复历史失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 批量修复多个预检结果
 * POST /api/precheck/fix/batch
 */
router.post('/batch', async (req, res) => {
  try {
    const { checkIds, userConfirmation = false } = req.body;

    if (!checkIds || !Array.isArray(checkIds) || checkIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数: checkIds (数组)' 
      });
    }

    if (checkIds.length > 5) {
      return res.status(400).json({ 
        success: false, 
        error: '批量修复最多支持5个检查' 
      });
    }

    const results = [];
    const errors = [];

    // 串行执行修复（避免资源冲突）
    for (const checkId of checkIds) {
      try {
        // 获取预检结果以获取项目信息
        const precheckResult = DeployPrecheck.getResult(checkId);
        if (!precheckResult) {
          errors.push({ checkId, error: '预检结果不存在或已过期' });
          continue;
        }

        // 获取项目信息
        const project = await ProjectDB.getById(precheckResult.projectId);
        if (!project) {
          errors.push({ checkId, error: '项目不存在' });
          continue;
        }

        // 执行修复
        const result = await AutoFixManager.runAutoFix({
          checkId,
          project,
          userConfirmation
        });

        results.push({
          checkId,
          fixId: result.fixId,
          status: result.status,
          projectId: project.id,
          projectName: project.name,
          issuesFixed: result.fixedIssues,
          totalIssues: result.totalIssues
        });

      } catch (error) {
        errors.push({ checkId, error: error.message });
      }
    }

    res.json({
      success: true,
      data: {
        total: checkIds.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      }
    });

    logger.info(`批量修复完成: ${results.length}/${checkIds.length} 成功`);

  } catch (error) {
    logger.error('批量修复失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 导出修复报告
 * GET /api/precheck/fix/export/:fixId
 */
router.get('/export/:fixId', async (req, res) => {
  try {
    const { fixId } = req.params;
    const { format = 'markdown' } = req.query;

    const result = AutoFixManager.getResult(fixId);
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        error: '修复结果不存在或已过期' 
      });
    }

    if (!['json', 'markdown', 'html'].includes(format)) {
      return res.status(400).json({ 
        success: false, 
        error: '不支持的格式，支持: json, markdown, html' 
      });
    }

    const report = await AutoFixManager.exportReport(result, format);
    const projectName = result.projectId?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `autofix_report_${projectName}_${timestamp}`;

    // 设置响应头
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.send(report);
    } else if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
      res.send(report);
    } else {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.md"`);
      res.send(report);
    }

    logger.info(`导出修复报告: ${fixId}, 格式: ${format}`);

  } catch (error) {
    logger.error('导出修复报告失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 健康检查端点
 * GET /api/precheck/fix/health
 */
router.get('/health', async (req, res) => {
  try {
    const activeFixes = AutoFixManager.activeFixes?.size || 0;
    const historySize = AutoFixManager.fixHistory?.size || 0;
    const supportedTypes = AutoFixManager.getSupportedFixTypes().length;
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        activeFixes,
        historySize,
        supportedTypes,
        fixers: AutoFixManager.fixers?.length || 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('修复健康检查失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;