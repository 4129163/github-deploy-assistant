/**
 * 部署状态管理器
 * 负责管理部署状态持久化、断点检测和恢复
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 部署阶段定义
const DEPLOY_STAGES = {
    INIT: 'init',
    CLONE: 'clone',
    INSTALL: 'install',
    BUILD: 'build',
    START: 'start',
    COMPLETE: 'complete',
    ERROR: 'error'
};

// 阶段状态
const STAGE_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

class DeployStateManager {
    constructor() {
        this.statesDir = path.join(process.cwd(), 'deploy-states');
        this.checkpointsDir = path.join(this.statesDir, 'checkpoints');
        this.ensureDirectories();
    }

    /**
     * 确保目录存在
     */
    async ensureDirectories() {
        try {
            await fs.mkdir(this.statesDir, { recursive: true });
            await fs.mkdir(this.checkpointsDir, { recursive: true });
        } catch (error) {
            console.error('创建状态目录失败:', error);
        }
    }

    /**
     * 创建新的部署状态
     */
    async createDeployState(projectData) {
        const stateId = uuidv4();
        const stateFile = path.join(this.statesDir, `${stateId}.json`);
        
        const initialState = {
            stateId,
            projectId: projectData.id || uuidv4(),
            projectName: projectData.name,
            repositoryUrl: projectData.url,
            targetPath: projectData.path,
            currentStage: DEPLOY_STAGES.INIT,
            stages: {
                [DEPLOY_STAGES.INIT]: {
                    status: STAGE_STATUS.PENDING,
                    startTime: null,
                    endTime: null,
                    checkpointData: null
                },
                [DEPLOY_STAGES.CLONE]: {
                    status: STAGE_STATUS.PENDING,
                    startTime: null,
                    endTime: null,
                    checkpointData: null
                },
                [DEPLOY_STAGES.INSTALL]: {
                    status: STAGE_STATUS.PENDING,
                    startTime: null,
                    endTime: null,
                    checkpointData: null
                },
                [DEPLOY_STAGES.BUILD]: {
                    status: STAGE_STATUS.PENDING,
                    startTime: null,
                    endTime: null,
                    checkpointData: null
                },
                [DEPLOY_STAGES.START]: {
                    status: STAGE_STATUS.PENDING,
                    startTime: null,
                    endTime: null,
                    checkpointData: null
                }
            },
            checkpointFile: path.join(this.checkpointsDir, `checkpoint-${stateId}.json`),
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            isResumable: true
        };

        await this.saveState(stateId, initialState);
        return initialState;
    }

    /**
     * 保存状态到文件
     */
    async saveState(stateId, state) {
        try {
            const stateFile = path.join(this.statesDir, `${stateId}.json`);
            state.lastUpdated = new Date().toISOString();
            await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('保存状态失败:', error);
            return false;
        }
    }

    /**
     * 加载状态
     */
    async loadState(stateId) {
        try {
            const stateFile = path.join(this.statesDir, `${stateId}.json`);
            const data = await fs.readFile(stateFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('加载状态失败:', error);
            return null;
        }
    }

    /**
     * 更新阶段状态
     */
    async updateStageState(stateId, stage, stageData) {
        const state = await this.loadState(stateId);
        if (!state) return false;

        if (!state.stages[stage]) {
            state.stages[stage] = {
                status: STAGE_STATUS.PENDING,
                startTime: null,
                endTime: null,
                checkpointData: null
            };
        }

        // 更新阶段数据
        Object.assign(state.stages[stage], stageData);
        
        // 如果阶段完成或失败，设置结束时间
        if (stageData.status === STAGE_STATUS.COMPLETED || stageData.status === STAGE_STATUS.FAILED) {
            if (!state.stages[stage].endTime) {
                state.stages[stage].endTime = new Date().toISOString();
            }
        }

        // 如果阶段开始，设置开始时间
        if (stageData.status === STAGE_STATUS.ACTIVE && !state.stages[stage].startTime) {
            state.stages[stage].startTime = new Date().toISOString();
        }

        // 更新当前阶段
        if (stageData.status === STAGE_STATUS.ACTIVE) {
            state.currentStage = stage;
        }

        // 如果阶段失败，标记为可恢复
        if (stageData.status === STAGE_STATUS.FAILED) {
            state.isResumable = true;
        }

        // 如果部署完成，标记为不可恢复
        if (stage === DEPLOY_STAGES.COMPLETE && stageData.status === STAGE_STATUS.COMPLETED) {
            state.isResumable = false;
        }

        return await this.saveState(stateId, state);
    }

    /**
     * 保存检查点数据
     */
    async saveCheckpoint(stateId, stage, checkpointData) {
        const state = await this.loadState(stateId);
        if (!state) return false;

        if (!state.stages[stage]) {
            state.stages[stage] = {
                status: STAGE_STATUS.ACTIVE,
                startTime: new Date().toISOString(),
                endTime: null,
                checkpointData: null
            };
        }

        state.stages[stage].checkpointData = checkpointData;
        state.currentStage = stage;
        state.isResumable = true;

        // 同时保存到检查点文件
        try {
            const checkpoint = {
                stateId,
                stage,
                data: checkpointData,
                timestamp: new Date().toISOString()
            };
            await fs.writeFile(state.checkpointFile, JSON.stringify(checkpoint, null, 2), 'utf8');
        } catch (error) {
            console.error('保存检查点文件失败:', error);
        }

        return await this.saveState(stateId, state);
    }

    /**
     * 检测可恢复的部署
     */
    async detectResumableDeployments() {
        try {
            const files = await fs.readdir(this.statesDir);
            const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('checkpoint-'));
            
            const resumableDeployments = [];
            
            for (const file of jsonFiles) {
                try {
                    const stateId = path.basename(file, '.json');
                    const state = await this.loadState(stateId);
                    
                    if (state && state.isResumable) {
                        // 查找最后一个失败或未完成的阶段
                        let lastFailedStage = null;
                        const stageOrder = [DEPLOY_STAGES.CLONE, DEPLOY_STAGES.INSTALL, DEPLOY_STAGES.BUILD, DEPLOY_STAGES.START];
                        
                        for (const stage of stageOrder) {
                            if (state.stages[stage]) {
                                const stageStatus = state.stages[stage].status;
                                if (stageStatus === STAGE_STATUS.FAILED || 
                                    stageStatus === STAGE_STATUS.ACTIVE) {
                                    lastFailedStage = stage;
                                    break;
                                }
                            }
                        }
                        
                        if (lastFailedStage) {
                            resumableDeployments.push({
                                stateId: state.stateId,
                                projectId: state.projectId,
                                projectName: state.projectName,
                                repositoryUrl: state.repositoryUrl,
                                targetPath: state.targetPath,
                                failedStage: lastFailedStage,
                                failedTime: state.lastUpdated,
                                createdAt: state.createdAt
                            });
                        }
                    }
                } catch (error) {
                    console.error(`解析状态文件 ${file} 失败:`, error);
                }
            }
            
            return resumableDeployments;
        } catch (error) {
            console.error('检测可恢复部署失败:', error);
            return [];
        }
    }

    /**
     * 获取部署状态
     */
    async getDeployState(stateId) {
        return await this.loadState(stateId);
    }

    /**
     * 清除部署状态
     */
    async clearDeployState(stateId) {
        try {
            const stateFile = path.join(this.statesDir, `${stateId}.json`);
            await fs.unlink(stateFile);
            
            // 同时删除检查点文件
            const state = await this.loadState(stateId);
            if (state && state.checkpointFile) {
                try {
                    await fs.unlink(state.checkpointFile);
                } catch (error) {
                    // 检查点文件可能不存在，忽略错误
                }
            }
            
            return true;
        } catch (error) {
            console.error('清除部署状态失败:', error);
            return false;
        }
    }

    /**
     * 获取阶段恢复策略
     */
    getStageResumeStrategy(stage, checkpointData) {
        const strategies = {
            [DEPLOY_STAGES.CLONE]: {
                description: '恢复Git仓库克隆',
                action: 'git_fetch_continue',
                checkpoints: ['partialFiles', 'bytesDownloaded', 'totalBytes']
            },
            [DEPLOY_STAGES.INSTALL]: {
                description: '恢复依赖安装',
                action: 'npm_install_resume',
                checkpoints: ['installedPackages', 'totalPackages']
            },
            [DEPLOY_STAGES.BUILD]: {
                description: '恢复项目构建',
                action: 'incremental_build',
                checkpoints: ['builtModules', 'totalModules']
            },
            [DEPLOY_STAGES.START]: {
                description: '恢复服务启动',
                action: 'service_restart',
                checkpoints: ['startAttempts', 'lastError']
            }
        };

        return strategies[stage] || {
            description: '重新开始阶段',
            action: 'restart',
            checkpoints: []
        };
    }

    /**
     * 清理过期的状态文件
     */
    async cleanupExpiredStates(maxAgeHours = 24) {
        try {
            const files = await fs.readdir(this.statesDir);
            const now = new Date();
            const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
            
            for (const file of files) {
                if (file.endsWith('.json') && !file.includes('checkpoint-')) {
                    try {
                        const filePath = path.join(this.statesDir, file);
                        const stats = await fs.stat(filePath);
                        const fileAge = now - stats.mtime;
                        
                        if (fileAge > maxAgeMs) {
                            const stateId = path.basename(file, '.json');
                            await this.clearDeployState(stateId);
                            console.log(`清理过期状态文件: ${file}`);
                        }
                    } catch (error) {
                        console.error(`清理文件 ${file} 失败:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('清理过期状态失败:', error);
        }
    }
}

module.exports = {
    DeployStateManager,
    DEPLOY_STAGES,
    STAGE_STATUS
};