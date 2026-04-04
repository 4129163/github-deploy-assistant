/**
 * 部署恢复API路由
 */

const express = require('express');
const router = express.Router();
const DeployResumeService = require('../services/deploy-resume-service');
const { DeployStateManager } = require('../deploy-state-manager');

const resumeService = new DeployResumeService();
const stateManager = new DeployStateManager();

/**
 * 获取所有可恢复的部署
 * GET /api/deploy/resume-points
 */
router.get('/resume-points', async (req, res) => {
    try {
        const deployments = await resumeService.getAllResumableDeployments();
        
        res.json({
            success: true,
            data: deployments,
            count: deployments.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('获取可恢复部署失败:', error);
        res.status(500).json({
            success: false,
            error: '获取可恢复部署失败',
            message: error.message
        });
    }
});

/**
 * 获取特定部署的状态
 * GET /api/deploy/state/:stateId
 */
router.get('/state/:stateId', async (req, res) => {
    try {
        const { stateId } = req.params;
        const state = await stateManager.getDeployState(stateId);
        
        if (!state) {
            return res.status(404).json({
                success: false,
                error: '部署状态不存在'
            });
        }
        
        // 隐藏敏感信息
        const sanitizedState = { ...state };
        delete sanitizedState.checkpointFile;
        
        res.json({
            success: true,
            data: sanitizedState,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('获取部署状态失败:', error);
        res.status(500).json({
            success: false,
            error: '获取部署状态失败',
            message: error.message
        });
    }
});

/**
 * 继续部署
 * POST /api/deploy/resume/:stateId
 */
router.post('/resume/:stateId', async (req, res) => {
    try {
        const { stateId } = req.params;
        const io = req.io; // 从中间件获取Socket.io实例
        
        // 检查部署状态是否存在
        const state = await stateManager.getDeployState(stateId);
        if (!state) {
            return res.status(404).json({
                success: false,
                error: '部署状态不存在'
            });
        }
        
        if (!state.isResumable) {
            return res.status(400).json({
                success: false,
                error: '该部署不可恢复',
                message: '部署已完成或已被清理'
            });
        }
        
        // 异步执行恢复，立即返回响应
        res.json({
            success: true,
            message: '开始恢复部署',
            stateId,
            projectName: state.projectName,
            timestamp: new Date().toISOString()
        });
        
        // 异步执行恢复过程
        setTimeout(async () => {
            try {
                await resumeService.resumeDeployment(stateId, io);
            } catch (error) {
                console.error('异步恢复部署失败:', error);
            }
        }, 100);
        
    } catch (error) {
        console.error('开始恢复部署失败:', error);
        res.status(500).json({
            success: false,
            error: '开始恢复部署失败',
            message: error.message
        });
    }
});

/**
 * 检查项目是否可恢复
 * GET /api/deploy/can-resume/:projectId
 */
router.get('/can-resume/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const canResume = await resumeService.canResumeDeployment(projectId);
        
        res.json({
            success: true,
            canResume: !!canResume,
            deployment: canResume || null,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('检查可恢复性失败:', error);
        res.status(500).json({
            success: false,
            error: '检查可恢复性失败',
            message: error.message
        });
    }
});

/**
 * 清除部署状态
 * DELETE /api/deploy/state/:stateId
 */
router.delete('/state/:stateId', async (req, res) => {
    try {
        const { stateId } = req.params;
        const success = await stateManager.clearDeployState(stateId);
        
        if (success) {
            res.json({
                success: true,
                message: '部署状态已清除',
                stateId,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                error: '清除部署状态失败',
                stateId
            });
        }
    } catch (error) {
        console.error('清除部署状态失败:', error);
        res.status(500).json({
            success: false,
            error: '清除部署状态失败',
            message: error.message
        });
    }
});

/**
 * 清理所有过期的部署状态
 * POST /api/deploy/cleanup-expired
 */
router.post('/cleanup-expired', async (req, res) => {
    try {
        const { maxAgeHours = 24 } = req.body;
        
        await stateManager.cleanupExpiredStates(maxAgeHours);
        
        res.json({
            success: true,
            message: '过期部署状态已清理',
            maxAgeHours,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('清理过期部署状态失败:', error);
        res.status(500).json({
            success: false,
            error: '清理过期部署状态失败',
            message: error.message
        });
    }
});

/**
 * 创建部署检查点
 * POST /api/deploy/checkpoint/:stateId
 */
router.post('/checkpoint/:stateId', async (req, res) => {
    try {
        const { stateId } = req.params;
        const { stage, checkpointData } = req.body;
        
        if (!stage || !checkpointData) {
            return res.status(400).json({
                success: false,
                error: '缺少必要参数',
                required: ['stage', 'checkpointData']
            });
        }
        
        const success = await stateManager.saveCheckpoint(stateId, stage, checkpointData);
        
        if (success) {
            res.json({
                success: true,
                message: '检查点已保存',
                stateId,
                stage,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                error: '保存检查点失败',
                stateId
            });
        }
    } catch (error) {
        console.error('保存检查点失败:', error);
        res.status(500).json({
            success: false,
            error: '保存检查点失败',
            message: error.message
        });
    }
});

/**
 * 获取部署恢复统计
 * GET /api/deploy/resume-stats
 */
router.get('/resume-stats', async (req, res) => {
    try {
        const deployments = await resumeService.getAllResumableDeployments();
        
        // 按阶段统计
        const stageStats = {};
        deployments.forEach(deploy => {
            const stage = deploy.failedStage || 'unknown';
            stageStats[stage] = (stageStats[stage] || 0) + 1;
        });
        
        // 按时间统计（最近24小时）
        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        
        const recentDeployments = deployments.filter(deploy => {
            const deployTime = new Date(deploy.failedTime || deploy.createdAt);
            return deployTime > oneDayAgo;
        });
        
        res.json({
            success: true,
            data: {
                totalResumable: deployments.length,
                recent24h: recentDeployments.length,
                byStage: stageStats,
                deployments: deployments.map(d => ({
                    projectName: d.projectName,
                    failedStage: d.failedStage,
                    failedTime: d.failedTime,
                    stateId: d.stateId
                })),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('获取恢复统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取恢复统计失败',
            message: error.message
        });
    }
});

module.exports = router;