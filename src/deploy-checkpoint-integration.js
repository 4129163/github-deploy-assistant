/**
 * 部署检查点集成模块
 * 集成状态管理和临时文件管理
 */

const { DeployStateManager, DEPLOY_STAGES, STAGE_STATUS } = require('./deploy-state-manager');
const TempFileManager = require('./temp-file-manager');

class DeployCheckpointIntegration {
    constructor() {
        this.stateManager = new DeployStateManager();
        this.tempFileManager = new TempFileManager();
    }

    /**
     * 开始部署并创建检查点
     */
    async startDeploymentWithCheckpoint(projectData) {
        try {
            // 创建部署状态
            const state = await this.stateManager.createDeployState(projectData);
            
            // 创建初始临时标记
            await this.tempFileManager.createStageMarker(
                state.projectId,
                DEPLOY_STAGES.INIT,
                {
                    type: 'deployment_start',
                    projectData,
                    stateId: state.stateId
                }
            );
            
            // 创建部署状态临时文件
            await this.tempFileManager.createDeployStateTempFile(
                state.projectId,
                {
                    stateId: state.stateId,
                    currentStage: DEPLOY_STAGES.INIT,
                    status: 'starting'
                }
            );
            
            return {
                success: true,
                state,
                message: '部署检查点已创建'
            };
        } catch (error) {
            console.error('创建部署检查点失败:', error);
            return {
                success: false,
                error: error.message,
                message: '创建部署检查点失败'
            };
        }
    }

    /**
     * 更新阶段检查点
     */
    async updateStageCheckpoint(stateId, stage, stageData, tempMarkerData = {}) {
        try {
            // 更新状态管理器
            const stateUpdated = await this.stateManager.updateStageState(stateId, stage, stageData);
            
            if (!stateUpdated) {
                throw new Error('更新状态管理器失败');
            }
            
            // 获取状态信息
            const state = await this.stateManager.getDeployState(stateId);
            if (!state) {
                throw new Error('获取部署状态失败');
            }
            
            // 更新临时文件标记
            let tempMarker;
            switch (stage) {
                case DEPLOY_STAGES.CLONE:
                    tempMarker = await this.tempFileManager.createGitCloneMarker(
                        state.projectId,
                        state.targetPath,
                        tempMarkerData
                    );
                    break;
                    
                case DEPLOY_STAGES.INSTALL:
                    tempMarker = await this.tempFileManager.createNpmInstallMarker(
                        state.projectId,
                        state.targetPath,
                        tempMarkerData
                    );
                    break;
                    
                case DEPLOY_STAGES.BUILD:
                    tempMarker = await this.tempFileManager.createBuildMarker(
                        state.projectId,
                        state.targetPath,
                        tempMarkerData
                    );
                    break;
                    
                default:
                    tempMarker = await this.tempFileManager.createStageMarker(
                        state.projectId,
                        stage,
                        {
                            type: stage,
                            ...tempMarkerData,
                            stateId,
                            targetPath: state.targetPath
                        }
                    );
            }
            
            // 更新部署状态临时文件
            await this.tempFileManager.createDeployStateTempFile(state.projectId, {
                stateId,
                currentStage: stage,
                stageStatus: stageData.status,
                lastUpdated: new Date().toISOString()
            });
            
            return {
                success: true,
                state,
                tempMarker: tempMarker ? '已创建' : '创建失败',
                message: '阶段检查点已更新'
            };
        } catch (error) {
            console.error('更新阶段检查点失败:', error);
            return {
                success: false,
                error: error.message,
                message: '更新阶段检查点失败'
            };
        }
    }

    /**
     * 完成阶段并保存检查点
     */
    async completeStageWithCheckpoint(stateId, stage, resultData = {}) {
        try {
            // 更新状态为完成
            const stageUpdate = {
                status: STAGE_STATUS.COMPLETED,
                ...resultData
            };
            
            const updateResult = await this.updateStageCheckpoint(stateId, stage, stageUpdate, {
                completed: true,
                ...resultData
            });
            
            if (!updateResult.success) {
                throw new Error(updateResult.error);
            }
            
            // 完成临时标记
            await this.tempFileManager.completeStageMarker(
                updateResult.state.projectId,
                stage,
                resultData
            );
            
            return {
                success: true,
                stateId,
                stage,
                message: '阶段完成检查点已保存'
            };
        } catch (error) {
            console.error('完成阶段检查点失败:', error);
            return {
                success: false,
                error: error.message,
                message: '完成阶段检查点失败'
            };
        }
    }

    /**
     * 失败阶段并保存检查点
     */
    async failStageWithCheckpoint(stateId, stage, errorData = {}) {
        try {
            // 更新状态为失败
            const stageUpdate = {
                status: STAGE_STATUS.FAILED,
                ...errorData
            };
            
            const updateResult = await this.updateStageCheckpoint(stateId, stage, stageUpdate, {
                failed: true,
                error: errorData.error || '未知错误',
                ...errorData
            });
            
            if (!updateResult.success) {
                throw new Error(updateResult.error);
            }
            
            // 失败临时标记
            await this.tempFileManager.failStageMarker(
                updateResult.state.projectId,
                stage,
                errorData
            );
            
            // 保存检查点数据
            await this.stateManager.saveCheckpoint(stateId, stage, {
                error: errorData.error || '未知错误',
                timestamp: new Date().toISOString(),
                ...errorData
            });
            
            return {
                success: true,
                stateId,
                stage,
                isResumable: true,
                message: '阶段失败检查点已保存，部署可恢复'
            };
        } catch (error) {
            console.error('失败阶段检查点失败:', error);
            return {
                success: false,
                error: error.message,
                message: '失败阶段检查点失败'
            };
        }
    }

    /**
     * 检测可恢复的部署（集成版本）
     */
    async detectResumableDeploymentsIntegrated() {
        try {
            // 从状态管理器获取
            const stateDeployments = await this.stateManager.detectResumableDeployments();
            
            // 从临时文件管理器获取
            const tempStats = await this.tempFileManager.getTempFileStats();
            const tempValidation = await this.tempFileManager.validateTempFiles();
            
            // 合并结果
            const integratedDeployments = [];
            
            for (const deployment of stateDeployments) {
                // 获取临时标记
                const tempMarkers = await this.tempFileManager.getProjectMarkers(deployment.projectId);
                
                // 查找对应阶段的标记
                const stageMarker = tempMarkers.find(marker => marker.stage === deployment.failedStage);
                
                integratedDeployments.push({
                    ...deployment,
                    hasTempMarkers: tempMarkers.length > 0,
                    stageMarker: stageMarker || null,
                    tempMarkerData: stageMarker?.data || null,
                    canResume: true
                });
            }
            
            return {
                success: true,
                deployments: integratedDeployments,
                stats: {
                    stateManager: stateDeployments.length,
                    tempFiles: tempStats,
                    validation: tempValidation
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('检测可恢复部署失败:', error);
            return {
                success: false,
                deployments: [],
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 恢复部署（集成版本）
     */
    async resumeDeploymentIntegrated(stateId, io = null) {
        try {
            // 获取部署状态
            const state = await this.stateManager.getDeployState(stateId);
            if (!state) {
                throw new Error('部署状态不存在');
            }
            
            // 获取临时标记
            const tempMarkers = await this.tempFileManager.getProjectMarkers(state.projectId);
            const stageMarker = tempMarkers.find(marker => marker.stage === state.currentStage);
            
            // 发送恢复开始事件
            if (io) {
                io.emit('deploy_resume_integrated_start', {
                    stateId,
                    projectName: state.projectName,
                    failedStage: state.currentStage,
                    hasTempMarkers: tempMarkers.length > 0,
                    stageMarkerData: stageMarker?.data || null,
                    timestamp: new Date().toISOString()
                });
            }
            
            // 根据临时标记决定恢复策略
            let resumeStrategy = 'standard';
            let resumeData = {};
            
            if (stageMarker) {
                resumeStrategy = 'with_temp_markers';
                resumeData = {
                    markerType: stageMarker.data?.type,
                    markerStatus: stageMarker.status,
                    markerData: stageMarker.data
                };
                
                // 根据标记类型调整恢复策略
                if (stageMarker.data?.type === 'git_clone' && stageMarker.data?.partialFiles?.isPartialClone) {
                    resumeStrategy = 'git_partial_clone';
                } else if (stageMarker.data?.type === 'npm_install' && stageMarker.data?.installedPackages > 0) {
                    resumeStrategy = 'npm_partial_install';
                }
            }
            
            // 更新状态为恢复中
            await this.stateManager.updateStageState(stateId, state.currentStage, {
                status: STAGE_STATUS.ACTIVE,
                resumeStartedAt: new Date().toISOString(),
                resumeStrategy
            });
            
            // 更新临时标记
            await this.tempFileManager.updateStageMarker(state.projectId, state.currentStage, {
                status: 'resuming',
                resumeStartedAt: new Date().toISOString(),
                resumeStrategy
            });
            
            return {
                success: true,
                stateId,
                projectId: state.projectId,
                projectName: state.projectName,
                currentStage: state.currentStage,
                resumeStrategy,
                resumeData,
                hasTempMarkers: tempMarkers.length > 0,
                message: '部署恢复已开始',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('集成恢复部署失败:', error);
            return {
                success: false,
                error: error.message,
                message: '集成恢复部署失败'
            };
        }
    }

    /**
     * 清理部署检查点
     */
    async cleanupDeploymentCheckpoint(stateId, cleanupTempFiles = true) {
        try {
            // 获取状态信息
            const state = await this.stateManager.getDeployState(stateId);
            if (!state) {
                return {
                    success: false,
                    error: '部署状态不存在'
                };
            }
            
            // 清理状态管理器
            const stateCleaned = await this.stateManager.clearDeployState(stateId);
            
            // 清理临时文件
            let tempCleaned = false;
            if (cleanupTempFiles) {
                tempCleaned = await this.tempFileManager.deleteProjectMarkers(state.projectId);
                
                // 清理部署状态临时文件
                try {
                    const tempFile = path.join(this.tempFileManager.tempDir, `${state.projectId}-deploy-state.json`);
                    await fs.unlink(tempFile);
                } catch (error) {
                    // 文件可能不存在，忽略
                }
            }
            
            return {
                success: stateCleaned,
                stateId,
                projectId: state.projectId,
                stateCleaned,
                tempCleaned,
                message: '部署检查点已清理'
            };
        } catch (error) {
            console.error('清理部署检查点失败:', error);
            return {
                success: false,
                error: error.message,
                message: '清理部署检查点失败'
            };
        }
    }

    /**
     * 获取部署检查点详情
     */
    async getDeploymentCheckpointDetails(stateId) {
        try {
            // 获取状态
            const state = await this.stateManager.getDeployState(stateId);
            if (!state) {
                throw new Error('部署状态不存在');
            }
            
            // 获取临时标记
            const tempMarkers = await this.tempFileManager.getProjectMarkers(state.projectId);
            
            // 获取临时文件统计
            const tempStats = await this.tempFileManager.getTempFileStats();
            
            // 计算恢复信息
            const resumeInfo = this.calculateResumeInfo(state, tempMarkers);
            
            return {
                success: true,
                state: {
                    ...state,
                    // 隐藏敏感信息
                    checkpointFile: undefined
                },
                tempMarkers,
                tempStats: {
                    totalMarkers: tempMarkers.length,
                    ...tempStats
                },
                resumeInfo,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('获取部署检查点详情失败:', error);
            return {
                success: false,
                error: error.message,
                message: '获取部署检查点详情失败'
            };
        }
    }

    /**
     * 计算恢复信息
     */
    calculateResumeInfo(state, tempMarkers) {
        const info = {
            canResume: state.isResumable,
            currentStage: state.currentStage,
            stageStatus: state.stages[state.currentStage]?.status || 'unknown',
            hasTempMarkers: tempMarkers.length > 0,
            estimatedResumeTime: null,
            recommendedAction: null
        };
        
        // 根据阶段和状态计算预计恢复时间
        const stageTimes = {
            [DEPLOY_STAGES.CLONE]: 300, // 5分钟
            [DEPLOY_STAGES.INSTALL]: 180, // 3分钟
            [DEPLOY_STAGES.BUILD]: 240, // 4分钟
            [DEPLOY_STAGES.START]: 60 // 1分钟
        };
        
        if (stageTimes[state.currentStage]) {
            info.estimatedResumeTime = stageTimes[state.currentStage];
        }
        
        // 推荐操作
        if (state.isResumable) {
            info.recommendedAction = 'resume';
        } else if (state.stages[DEPLOY_STAGES.COMPLETE]?.status === STAGE_STATUS.COMPLETED) {
            info.recommendedAction = 'view';
        } else {
            info.recommendedAction = 'restart';
        }
        
        return info;
    }

    /**
     * 验证部署检查点完整性
     */
    async validateDeploymentCheckpoint(stateId) {
        try {
            const details = await this.getDeploymentCheckpointDetails(stateId);
            if (!details.success) {
                return {
                    valid: false,
                    error: details.error,
                    issues: ['无法获取部署详情']
                };
            }
            
            const issues = [];
            const { state, tempMarkers } = details;
            
            // 验证状态文件
            if (!state.stateId || !state.projectId) {
                issues.push('状态文件缺少必需字段');
            }
            
            // 验证阶段状态一致性
            for (const [stage, stageInfo] of Object.entries(state.stages)) {
                if (stageInfo.status === STAGE_STATUS.ACTIVE && !stageInfo.startTime) {
                    issues.push(`阶段 ${stage} 状态为激活但缺少开始时间`);
                }
                
                if ((stageInfo.status === STAGE_STATUS.COMPLETED || stageInfo.status === STAGE_STATUS.FAILED) && 
                    !stageInfo.endTime) {
                    issues.push(`阶段 ${stage} 状态为完成/失败但缺少结束时间`);
                }
            }
            
            // 验证临时标记一致性
            const stageMarker = tempMarkers.find(m => m.stage === state.currentStage);
            if (stageMarker) {
                if (stageMarker.status === 'failed' && state.stages[state.currentStage]?.status !== STAGE_STATUS.FAILED) {
                    issues.push('临时标记与状态文件阶段状态不一致');
                }
            }
            
            return {
                valid: issues.length === 0,
                stateId,
                projectId: state.projectId,
                issues,
                issueCount: issues.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('验证部署检查点失败:', error);
            return {
                valid: false,
                error: error.message,
                issues: [`验证失败: ${error.message}`],
                issueCount: 1,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// 导出单例实例
const deployCheckpointIntegration = new DeployCheckpointIntegration();

module.exports = {
    DeployCheckpointIntegration,
    deployCheckpointIntegration,
    DEPLOY_STAGES,
    STAGE_STATUS
};