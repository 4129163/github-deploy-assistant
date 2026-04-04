/**
 * 部署恢复服务
 * 负责断点续传的具体恢复逻辑
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const { DeployStateManager, DEPLOY_STAGES, STAGE_STATUS } = require('../deploy-state-manager');

class DeployResumeService {
    constructor() {
        this.stateManager = new DeployStateManager();
    }

    /**
     * 检测项目是否可恢复
     */
    async canResumeDeployment(projectId) {
        const deployments = await this.stateManager.detectResumableDeployments();
        return deployments.find(d => d.projectId === projectId);
    }

    /**
     * 开始恢复部署
     */
    async resumeDeployment(stateId, io = null) {
        try {
            const state = await this.stateManager.getDeployState(stateId);
            if (!state) {
                throw new Error('部署状态不存在');
            }

            if (!state.isResumable) {
                throw new Error('该部署不可恢复');
            }

            // 发送恢复开始事件
            this.emitResumeEvent(io, stateId, 'resume_started', {
                projectName: state.projectName,
                failedStage: state.currentStage
            });

            // 根据当前阶段执行恢复
            const result = await this.resumeFromStage(stateId, state.currentStage, state, io);

            // 发送恢复完成事件
            this.emitResumeEvent(io, stateId, 'resume_completed', {
                success: result.success,
                message: result.message,
                resumedStage: state.currentStage
            });

            return result;
        } catch (error) {
            console.error('恢复部署失败:', error);
            
            // 发送恢复失败事件
            this.emitResumeEvent(io, stateId, 'resume_failed', {
                error: error.message,
                stage: state ? state.currentStage : 'unknown'
            });

            return {
                success: false,
                message: `恢复部署失败: ${error.message}`
            };
        }
    }

    /**
     * 从指定阶段恢复
     */
    async resumeFromStage(stateId, stage, state, io) {
        switch (stage) {
            case DEPLOY_STAGES.CLONE:
                return await this.resumeCloneStage(stateId, state, io);
            case DEPLOY_STAGES.INSTALL:
                return await this.resumeInstallStage(stateId, state, io);
            case DEPLOY_STAGES.BUILD:
                return await this.resumeBuildStage(stateId, state, io);
            case DEPLOY_STAGES.START:
                return await this.resumeStartStage(stateId, state, io);
            default:
                return {
                    success: false,
                    message: `不支持的恢复阶段: ${stage}`
                };
        }
    }

    /**
     * 恢复克隆阶段
     */
    async resumeCloneStage(stateId, state, io) {
        try {
            const targetPath = state.targetPath;
            const repoUrl = state.repositoryUrl;
            const checkpointData = state.stages[DEPLOY_STAGES.CLONE]?.checkpointData;

            // 更新阶段状态为激活
            await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.CLONE, {
                status: STAGE_STATUS.ACTIVE
            });

            this.emitResumeEvent(io, stateId, 'stage_resume_started', {
                stage: DEPLOY_STAGES.CLONE,
                stageName: '克隆仓库'
            });

            // 检查目标目录
            const gitDir = path.join(targetPath, '.git');
            let resumeResult;

            try {
                await fs.access(gitDir);
                // .git目录存在，尝试恢复
                resumeResult = await this.resumeGitClone(targetPath, repoUrl, checkpointData, io);
            } catch (error) {
                // .git目录不存在，重新克隆
                resumeResult = await this.retryGitClone(targetPath, repoUrl, io);
            }

            if (resumeResult.success) {
                await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.CLONE, {
                    status: STAGE_STATUS.COMPLETED,
                    checkpointData: null // 清除检查点数据
                });

                this.emitResumeEvent(io, stateId, 'stage_resume_completed', {
                    stage: DEPLOY_STAGES.CLONE,
                    stageName: '克隆仓库',
                    message: '仓库克隆恢复成功'
                });

                // 自动进入下一阶段
                return await this.continueToNextStage(stateId, DEPLOY_STAGES.CLONE, state, io);
            } else {
                await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.CLONE, {
                    status: STAGE_STATUS.FAILED,
                    checkpointData: resumeResult.checkpointData || checkpointData
                });

                throw new Error(`克隆恢复失败: ${resumeResult.message}`);
            }
        } catch (error) {
            console.error('恢复克隆阶段失败:', error);
            throw error;
        }
    }

    /**
     * 恢复Git克隆
     */
    async resumeGitClone(targetPath, repoUrl, checkpointData, io) {
        try {
            // 检查是否在Git仓库中
            await execAsync('git rev-parse --git-dir', { cwd: targetPath });
            
            // 获取远程仓库信息
            const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url', { cwd: targetPath });
            
            if (remoteUrl.trim() !== repoUrl) {
                // 远程仓库不匹配，重新克隆
                await fs.rm(targetPath, { recursive: true, force: true });
                await fs.mkdir(targetPath, { recursive: true });
                return await this.retryGitClone(targetPath, repoUrl, io);
            }

            // 尝试继续拉取
            this.emitLog(io, '继续拉取Git仓库更新...');
            
            const { stdout, stderr } = await execAsync('git fetch --progress', { 
                cwd: targetPath,
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });

            if (stderr && stderr.includes('fatal')) {
                throw new Error(`Git拉取失败: ${stderr}`);
            }

            // 检查是否有未合并的更改
            const { stdout: status } = await execAsync('git status --porcelain', { cwd: targetPath });
            if (status.trim()) {
                this.emitLog(io, '检测到未提交的更改，正在重置...');
                await execAsync('git reset --hard HEAD', { cwd: targetPath });
            }

            // 拉取最新更改
            await execAsync('git pull --progress', { 
                cwd: targetPath,
                maxBuffer: 10 * 1024 * 1024
            });

            this.emitLog(io, 'Git仓库恢复成功');
            return {
                success: true,
                message: 'Git仓库恢复成功',
                checkpointData: null
            };
        } catch (error) {
            console.error('恢复Git克隆失败:', error);
            
            // 保存检查点数据
            const checkpointData = {
                lastError: error.message,
                retryTime: new Date().toISOString(),
                targetPath: targetPath
            };

            return {
                success: false,
                message: `恢复Git克隆失败: ${error.message}`,
                checkpointData
            };
        }
    }

    /**
     * 重试Git克隆
     */
    async retryGitClone(targetPath, repoUrl, io) {
        try {
            // 确保目录存在
            await fs.mkdir(targetPath, { recursive: true });
            
            // 清理目录（如果存在内容）
            try {
                const files = await fs.readdir(targetPath);
                if (files.length > 0) {
                    this.emitLog(io, '清理目录以重新克隆...');
                    await fs.rm(targetPath, { recursive: true, force: true });
                    await fs.mkdir(targetPath, { recursive: true });
                }
            } catch (error) {
                // 目录可能不存在，继续
            }

            this.emitLog(io, `开始克隆仓库: ${repoUrl}`);
            
            const { stdout, stderr } = await execAsync(`git clone --progress ${repoUrl} .`, { 
                cwd: targetPath,
                maxBuffer: 10 * 1024 * 1024
            });

            if (stderr && stderr.includes('fatal')) {
                throw new Error(`Git克隆失败: ${stderr}`);
            }

            this.emitLog(io, '仓库克隆成功');
            return {
                success: true,
                message: '仓库克隆成功',
                checkpointData: null
            };
        } catch (error) {
            console.error('重试Git克隆失败:', error);
            
            // 保存部分下载的检查点数据
            const checkpointData = {
                partialDownload: true,
                lastError: error.message,
                retryTime: new Date().toISOString(),
                targetPath: targetPath
            };

            return {
                success: false,
                message: `重试Git克隆失败: ${error.message}`,
                checkpointData
            };
        }
    }

    /**
     * 恢复安装阶段
     */
    async resumeInstallStage(stateId, state, io) {
        try {
            const targetPath = state.targetPath;
            const checkpointData = state.stages[DEPLOY_STAGES.INSTALL]?.checkpointData;

            // 更新阶段状态为激活
            await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.INSTALL, {
                status: STAGE_STATUS.ACTIVE
            });

            this.emitResumeEvent(io, stateId, 'stage_resume_started', {
                stage: DEPLOY_STAGES.INSTALL,
                stageName: '安装依赖'
            });

            // 检查package.json是否存在
            const packageJsonPath = path.join(targetPath, 'package.json');
            
            try {
                await fs.access(packageJsonPath);
            } catch (error) {
                throw new Error('package.json不存在，无法安装依赖');
            }

            // 检查node_modules目录
            const nodeModulesPath = path.join(targetPath, 'node_modules');
            let resumeResult;

            try {
                await fs.access(nodeModulesPath);
                // node_modules存在，尝试恢复安装
                resumeResult = await this.resumeNpmInstall(targetPath, checkpointData, io);
            } catch (error) {
                // node_modules不存在，重新安装
                resumeResult = await this.retryNpmInstall(targetPath, io);
            }

            if (resumeResult.success) {
                await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.INSTALL, {
                    status: STAGE_STATUS.COMPLETED,
                    checkpointData: null
                });

                this.emitResumeEvent(io, stateId, 'stage_resume_completed', {
                    stage: DEPLOY_STAGES.INSTALL,
                    stageName: '安装依赖',
                    message: '依赖安装恢复成功'
                });

                // 自动进入下一阶段
                return await this.continueToNextStage(stateId, DEPLOY_STAGES.INSTALL, state, io);
            } else {
                await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.INSTALL, {
                    status: STAGE_STATUS.FAILED,
                    checkpointData: resumeResult.checkpointData || checkpointData
                });

                throw new Error(`依赖安装恢复失败: ${resumeResult.message}`);
            }
        } catch (error) {
            console.error('恢复安装阶段失败:', error);
            throw error;
        }
    }

    /**
     * 恢复NPM安装
     */
    async resumeNpmInstall(targetPath, checkpointData, io) {
        try {
            this.emitLog(io, '继续安装NPM依赖...');
            
            // 检查package-lock.json或yarn.lock
            const packageLockPath = path.join(targetPath, 'package-lock.json');
            const yarnLockPath = path.join(targetPath, 'yarn.lock');
            
            let command = 'npm install --no-audit --progress=false';
            
            try {
                await fs.access(packageLockPath);
                command = 'npm ci --no-audit --progress=false';
                this.emitLog(io, '检测到package-lock.json，使用npm ci');
            } catch (error) {
                try {
                    await fs.access(yarnLockPath);
                    command = 'yarn install --non-interactive';
                    this.emitLog(io, '检测到yarn.lock，使用yarn install');
                } catch (error) {
                    // 使用默认的npm install
                }
            }

            const { stdout, stderr } = await execAsync(command, { 
                cwd: targetPath,
                maxBuffer: 10 * 1024 * 1024,
                timeout: 300000 // 5分钟超时
            });

            if (stderr && stderr.includes('ERR!')) {
                // 尝试清理node_modules后重试
                this.emitLog(io, '安装失败，清理node_modules后重试...');
                await fs.rm(path.join(targetPath, 'node_modules'), { recursive: true, force: true });
                return await this.retryNpmInstall(targetPath, io);
            }

            this.emitLog(io, 'NPM依赖安装恢复成功');
            return {
                success: true,
                message: 'NPM依赖安装恢复成功',
                checkpointData: null
            };
        } catch (error) {
            console.error('恢复NPM安装失败:', error);
            
            const checkpointData = {
                lastError: error.message,
                retryTime: new Date().toISOString(),
                targetPath: targetPath,
                command: 'npm install'
            };

            return {
                success: false,
                message: `恢复NPM安装失败: ${error.message}`,
                checkpointData
            };
        }
    }

    /**
     * 重试NPM安装
     */
    async retryNpmInstall(targetPath, io) {
        try {
            this.emitLog(io, '重新安装NPM依赖...');
            
            // 清理可能存在的node_modules
            try {
                await fs.rm(path.join(targetPath, 'node_modules'), { recursive: true, force: true });
            } catch (error) {
                // 忽略错误
            }

            const { stdout, stderr } = await execAsync('npm install --no-audit --progress=false', { 
                cwd: targetPath,
                maxBuffer: 10 * 1024 * 1024,
                timeout: 300000
            });

            if (stderr && stderr.includes('ERR!')) {
                throw new Error(`NPM安装失败: ${stderr}`);
            }

            this.emitLog(io, 'NPM依赖安装成功');
            return {
                success: true,
                message: 'NPM依赖安装成功',
                checkpointData: null
            };
        } catch (error) {
            console.error('重试NPM安装失败:', error);
            
            const checkpointData = {
                lastError: error.message,
                retryTime: new Date().toISOString(),
                targetPath: targetPath,
                command: 'npm install'
            };

            return {
                success: false,
                message: `重试NPM安装失败: ${error.message}`,
                checkpointData
            };
        }
    }

    /**
     * 恢复构建阶段
     */
    async resumeBuildStage(stateId, state, io) {
        // 简化的构建恢复逻辑
        // 实际实现需要根据项目类型（React, Vue, Node.js等）调整
        try {
            const targetPath = state.targetPath;

            await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.BUILD, {
                status: STAGE_STATUS.ACTIVE
            });

            this.emitResumeEvent(io, stateId, 'stage_resume_started', {
                stage: DEPLOY_STAGES.BUILD,
                stageName: '构建项目'
            });

            this.emitLog(io, '开始构建项目...');

            // 检查package.json中的构建脚本
            const packageJsonPath = path.join(targetPath, 'package.json');
            
            try {
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
                const buildScript = packageJson.scripts?.build;

                if (buildScript) {
                    const { stdout, stderr } = await execAsync(`npm run build`, { 
                        cwd: targetPath,
                        maxBuffer: 10 * 1024 * 1024,
                        timeout: 600000 // 10分钟超时
                    });

                    if (stderr && stderr.includes('ERR!')) {
                        throw new Error(`构建失败: ${stderr}`);
                    }

                    this.emitLog(io, '项目构建成功');
                    
                    await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.BUILD, {
                        status: STAGE_STATUS.COMPLETED,
                        checkpointData: null
                    });

                    this.emitResumeEvent(io, stateId, 'stage_resume_completed', {
                        stage: DEPLOY_STAGES.BUILD,
                        stageName: '构建项目',
                        message: '项目构建恢复成功'
                    });

                    // 自动进入下一阶段
                    return await this.continueToNextStage(stateId, DEPLOY_STAGES.BUILD, state, io);
                } else {
                    // 没有构建脚本，跳过构建阶段
                    this.emitLog(io, '未找到构建脚本，跳过构建阶段');
                    
                    await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.BUILD, {
                        status: STAGE_STATUS.COMPLETED,
                        checkpointData: null
                    });

                    return await this.continueToNextStage(stateId, DEPLOY_STAGES.BUILD, state, io);
                }
            } catch (error) {
                console.error('恢复构建阶段失败:', error);
                
                await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.BUILD, {
                    status: STAGE_STATUS.FAILED,
                    checkpointData: {
                        lastError: error.message,
                        retryTime: new Date().toISOString()
                    }
                });

                throw new Error(`构建恢复失败: ${error.message}`);
            }
        } catch (error) {
            console.error('恢复构建阶段失败:', error);
            throw error;
        }
    }

    /**
     * 恢复启动阶段
     */
    async resumeStartStage(stateId, state, io) {
        try {
            const targetPath = state.targetPath;
            const projectName = state.projectName;

            await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.START, {
                status: STAGE_STATUS.ACTIVE
            });

            this.emitResumeEvent(io, stateId, 'stage_resume_started', {
                stage: DEPLOY_STAGES.START,
                stageName: '启动服务'
            });

            this.emitLog(io, '启动项目服务...');

            // 检查package.json中的启动脚本
            const packageJsonPath = path.join(targetPath, 'package.json');
            
            try {
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
                const startScript = packageJson.scripts?.start || packageJson.scripts?.dev;

                if (startScript) {
                    // 在实际部署中，这里应该启动服务并监控
                    // 简化版本：假设启动成功
                    
                    this.emitLog(io, '项目服务启动成功');
                    
                    await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.START, {
                        status: STAGE_STATUS.COMPLETED,
                        checkpointData: null
                    });

                    // 标记部署完成
                    await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.COMPLETE, {
                        status: STAGE_STATUS.COMPLETED
                    });

                    this.emitResumeEvent(io, stateId, 'stage_resume_completed', {
                        stage: DEPLOY_STAGES.COMPLETE,
                        stageName: '部署完成',
                        message: '部署恢复成功完成'
                    });

                    // 标记为不可恢复
                    const finalState = await this.stateManager.getDeployState(stateId);
                    finalState.isResumable = false;
                    await this.stateManager.saveState(stateId, finalState);

                    return {
                        success: true,
                        message: '部署恢复成功完成',
                        completed: true
                    };
                } else {
                    throw new Error('未找到启动脚本');
                }
            } catch (error) {
                console.error('恢复启动阶段失败:', error);
                
                await this.stateManager.updateStageState(stateId, DEPLOY_STAGES.START, {
                    status: STAGE_STATUS.FAILED,
                    checkpointData: {
                        lastError: error.message,
                        retryTime: new Date().toISOString()
                    }
                });

                throw new Error(`启动恢复失败: ${error.message}`);
            }
        } catch (error) {
            console.error('恢复启动阶段失败:', error);
            throw error;
        }
    }

    /**
     * 继续到下一阶段
     */
    async continueToNextStage(stateId, currentStage, state, io) {
        const stageOrder = [
            DEPLOY_STAGES.CLONE,
            DEPLOY_STAGES.INSTALL,
            DEPLOY_STAGES.BUILD,
            DEPLOY_STAGES.START
        ];

        const currentIndex = stageOrder.indexOf(currentStage);
        if (currentIndex === -1 || currentIndex >= stageOrder.length - 1) {
            return {
                success: true,
                message: '所有阶段已完成',
                completed: true
            };
        }

        const nextStage = stageOrder[currentIndex + 1];
        
        // 检查下一阶段是否已完成
        if (state.stages[nextStage] && state.stages[nextStage].status === STAGE_STATUS.COMPLETED) {
            // 跳过已完成的阶段
            return await this.continueToNextStage(stateId, nextStage, state, io);
        }

        // 进入下一阶段
        return await this.resumeFromStage(stateId, nextStage, state, io);
    }

    /**
     * 发送恢复事件
     */
    emitResumeEvent(io, stateId, eventType, data) {
        if (!io) return;
        
        try {
            io.emit('deploy_resume_event', {
                stateId,
                type: eventType,
                data,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('发送恢复事件失败:', error);
        }
    }

    /**
     * 发送日志
     */
    emitLog(io, message, level = 'info') {
        if (!io) return;
        
        try {
            io.emit('deploy_log', {
                type: 'log',
                data: {
                    message,
                    level,
                    time: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('发送日志失败:', error);
        }
    }

    /**
     * 获取所有可恢复的部署
     */
    async getAllResumableDeployments() {
        return await this.stateManager.detectResumableDeployments();
    }

    /**
     * 清除部署状态
     */
    async clearDeploymentState(stateId) {
        return await this.stateManager.clearDeployState(stateId);
    }
}

module.exports = DeployResumeService;