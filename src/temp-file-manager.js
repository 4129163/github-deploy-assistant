/**
 * 临时文件管理器
 * 负责管理部署过程中的临时文件和标记
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class TempFileManager {
    constructor() {
        this.tempDir = path.join(os.tmpdir(), 'gada-deploy-temp');
        this.markersDir = path.join(this.tempDir, 'markers');
        this.ensureDirectories();
    }

    /**
     * 确保目录存在
     */
    async ensureDirectories() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            await fs.mkdir(this.markersDir, { recursive: true });
        } catch (error) {
            console.error('创建临时目录失败:', error);
        }
    }

    /**
     * 创建阶段标记文件
     */
    async createStageMarker(projectId, stage, markerData = {}) {
        try {
            const markerFile = path.join(this.markersDir, `${projectId}-${stage}.json`);
            const marker = {
                projectId,
                stage,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                data: markerData,
                status: 'active'
            };
            
            await fs.writeFile(markerFile, JSON.stringify(marker, null, 2), 'utf8');
            return markerFile;
        } catch (error) {
            console.error('创建阶段标记失败:', error);
            return null;
        }
    }

    /**
     * 更新阶段标记
     */
    async updateStageMarker(projectId, stage, updates) {
        try {
            const markerFile = path.join(this.markersDir, `${projectId}-${stage}.json`);
            
            let marker;
            try {
                const data = await fs.readFile(markerFile, 'utf8');
                marker = JSON.parse(data);
            } catch (error) {
                // 标记文件不存在，创建新的
                return await this.createStageMarker(projectId, stage, updates.data || {});
            }
            
            // 更新标记
            Object.assign(marker, updates);
            marker.lastUpdated = new Date().toISOString();
            
            await fs.writeFile(markerFile, JSON.stringify(marker, null, 2), 'utf8');
            return markerFile;
        } catch (error) {
            console.error('更新阶段标记失败:', error);
            return null;
        }
    }

    /**
     * 完成阶段标记
     */
    async completeStageMarker(projectId, stage, resultData = {}) {
        return await this.updateStageMarker(projectId, stage, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            data: {
                ...resultData,
                success: true
            }
        });
    }

    /**
     * 失败阶段标记
     */
    async failStageMarker(projectId, stage, errorData = {}) {
        return await this.updateStageMarker(projectId, stage, {
            status: 'failed',
            failedAt: new Date().toISOString(),
            data: {
                ...errorData,
                success: false,
                error: errorData.error || '未知错误'
            }
        });
    }

    /**
     * 获取阶段标记
     */
    async getStageMarker(projectId, stage) {
        try {
            const markerFile = path.join(this.markersDir, `${projectId}-${stage}.json`);
            const data = await fs.readFile(markerFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    /**
     * 获取项目的所有标记
     */
    async getProjectMarkers(projectId) {
        try {
            const files = await fs.readdir(this.markersDir);
            const projectMarkers = [];
            
            for (const file of files) {
                if (file.startsWith(`${projectId}-`)) {
                    try {
                        const data = await fs.readFile(path.join(this.markersDir, file), 'utf8');
                        const marker = JSON.parse(data);
                        projectMarkers.push(marker);
                    } catch (error) {
                        console.error(`解析标记文件 ${file} 失败:`, error);
                    }
                }
            }
            
            return projectMarkers;
        } catch (error) {
            console.error('获取项目标记失败:', error);
            return [];
        }
    }

    /**
     * 删除阶段标记
     */
    async deleteStageMarker(projectId, stage) {
        try {
            const markerFile = path.join(this.markersDir, `${projectId}-${stage}.json`);
            await fs.unlink(markerFile);
            return true;
        } catch (error) {
            // 文件可能不存在，忽略错误
            return true;
        }
    }

    /**
     * 删除项目的所有标记
     */
    async deleteProjectMarkers(projectId) {
        try {
            const files = await fs.readdir(this.markersDir);
            
            for (const file of files) {
                if (file.startsWith(`${projectId}-`)) {
                    try {
                        await fs.unlink(path.join(this.markersDir, file));
                    } catch (error) {
                        console.error(`删除标记文件 ${file} 失败:`, error);
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error('删除项目标记失败:', error);
            return false;
        }
    }

    /**
     * 创建Git克隆临时标记
     */
    async createGitCloneMarker(projectId, targetPath, progressData = {}) {
        const markerData = {
            type: 'git_clone',
            targetPath,
            ...progressData,
            partialFiles: await this.detectPartialGitClone(targetPath),
            markerTime: new Date().toISOString()
        };
        
        return await this.createStageMarker(projectId, 'clone', markerData);
    }

    /**
     * 检测部分Git克隆
     */
    async detectPartialGitClone(targetPath) {
        try {
            const gitDir = path.join(targetPath, '.git');
            await fs.access(gitDir);
            
            // 检查Git配置
            const configPath = path.join(gitDir, 'config');
            const configExists = await fs.access(configPath).then(() => true).catch(() => false);
            
            // 检查objects目录
            const objectsPath = path.join(gitDir, 'objects');
            let objectsExist = false;
            try {
                await fs.access(objectsPath);
                objectsExist = true;
            } catch (error) {
                objectsExist = false;
            }
            
            return {
                gitDirExists: true,
                configExists,
                objectsExist,
                isPartialClone: configExists && !objectsExist
            };
        } catch (error) {
            return {
                gitDirExists: false,
                configExists: false,
                objectsExist: false,
                isPartialClone: false
            };
        }
    }

    /**
     * 创建NPM安装临时标记
     */
    async createNpmInstallMarker(projectId, targetPath, progressData = {}) {
        const markerData = {
            type: 'npm_install',
            targetPath,
            ...progressData,
            installedPackages: await this.countInstalledPackages(targetPath),
            packageJsonExists: await this.checkFileExists(path.join(targetPath, 'package.json')),
            markerTime: new Date().toISOString()
        };
        
        return await this.createStageMarker(projectId, 'install', markerData);
    }

    /**
     * 计算已安装的包数量
     */
    async countInstalledPackages(targetPath) {
        try {
            const nodeModulesPath = path.join(targetPath, 'node_modules');
            await fs.access(nodeModulesPath);
            
            const items = await fs.readdir(nodeModulesPath);
            // 过滤掉非包目录（如.bin）
            const packages = items.filter(item => 
                !item.startsWith('.') && 
                !item.startsWith('@') &&
                item !== 'bin'
            );
            
            return packages.length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * 创建构建临时标记
     */
    async createBuildMarker(projectId, targetPath, progressData = {}) {
        const markerData = {
            type: 'build',
            targetPath,
            ...progressData,
            buildOutputExists: await this.checkBuildOutput(targetPath),
            markerTime: new Date().toISOString()
        };
        
        return await this.createStageMarker(projectId, 'build', markerData);
    }

    /**
     * 检查构建输出
     */
    async checkBuildOutput(targetPath) {
        try {
            // 检查常见的构建输出目录
            const commonDirs = ['dist', 'build', 'out', 'public'];
            
            for (const dir of commonDirs) {
                const dirPath = path.join(targetPath, dir);
                try {
                    await fs.access(dirPath);
                    const files = await fs.readdir(dirPath);
                    if (files.length > 0) {
                        return {
                            dir,
                            exists: true,
                            fileCount: files.length
                        };
                    }
                } catch (error) {
                    // 目录不存在，继续检查下一个
                }
            }
            
            return { exists: false };
        } catch (error) {
            return { exists: false, error: error.message };
        }
    }

    /**
     * 创建部署状态临时文件
     */
    async createDeployStateTempFile(projectId, stateData) {
        try {
            const tempFile = path.join(this.tempDir, `${projectId}-deploy-state.json`);
            const data = {
                projectId,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                ...stateData
            };
            
            await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
            return tempFile;
        } catch (error) {
            console.error('创建部署状态临时文件失败:', error);
            return null;
        }
    }

    /**
     * 检查文件是否存在
     */
    async checkFileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 清理过期的临时文件
     */
    async cleanupExpiredTempFiles(maxAgeHours = 24) {
        try {
            const files = await fs.readdir(this.tempDir);
            const now = new Date();
            const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
            
            let cleanedCount = 0;
            
            for (const file of files) {
                try {
                    const filePath = path.join(this.tempDir, file);
                    const stats = await fs.stat(filePath);
                    const fileAge = now - stats.mtime;
                    
                    if (fileAge > maxAgeMs) {
                        await fs.unlink(filePath);
                        cleanedCount++;
                        console.log(`清理过期临时文件: ${file}`);
                    }
                } catch (error) {
                    console.error(`清理文件 ${file} 失败:`, error);
                }
            }
            
            // 清理标记目录
            const markerFiles = await fs.readdir(this.markersDir);
            for (const file of markerFiles) {
                try {
                    const filePath = path.join(this.markersDir, file);
                    const stats = await fs.stat(filePath);
                    const fileAge = now - stats.mtime;
                    
                    if (fileAge > maxAgeMs) {
                        await fs.unlink(filePath);
                        cleanedCount++;
                        console.log(`清理过期标记文件: ${file}`);
                    }
                } catch (error) {
                    console.error(`清理标记文件 ${file} 失败:`, error);
                }
            }
            
            console.log(`临时文件清理完成，共清理 ${cleanedCount} 个文件`);
            return cleanedCount;
        } catch (error) {
            console.error('清理临时文件失败:', error);
            return 0;
        }
    }

    /**
     * 获取临时文件统计
     */
    async getTempFileStats() {
        try {
            const allFiles = await fs.readdir(this.tempDir);
            const markerFiles = await fs.readdir(this.markersDir);
            
            // 按类型统计
            const byType = {
                deployState: allFiles.filter(f => f.includes('-deploy-state.json')).length,
                markers: markerFiles.length,
                other: allFiles.length - allFiles.filter(f => f.includes('-deploy-state.json')).length
            };
            
            // 计算总大小
            let totalSize = 0;
            for (const file of allFiles) {
                try {
                    const filePath = path.join(this.tempDir, file);
                    const stats = await fs.stat(filePath);
                    totalSize += stats.size;
                } catch (error) {
                    // 忽略错误
                }
            }
            
            // 按时间统计（最近24小时）
            const now = new Date();
            const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
            
            let recentCount = 0;
            for (const file of allFiles) {
                try {
                    const filePath = path.join(this.tempDir, file);
                    const stats = await fs.stat(filePath);
                    if (stats.mtime > oneDayAgo) {
                        recentCount++;
                    }
                } catch (error) {
                    // 忽略错误
                }
            }
            
            return {
                totalFiles: allFiles.length + markerFiles.length,
                totalSizeBytes: totalSize,
                totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
                recent24hFiles: recentCount,
                byType,
                tempDir: this.tempDir,
                markersDir: this.markersDir,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('获取临时文件统计失败:', error);
            return {
                totalFiles: 0,
                totalSizeBytes: 0,
                totalSizeMB: 0,
                recent24hFiles: 0,
                byType: {},
                tempDir: this.tempDir,
                markersDir: this.markersDir,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 验证临时文件完整性
     */
    async validateTempFiles() {
        try {
            const stats = await this.getTempFileStats();
            const issues = [];
            
            // 检查目录权限
            try {
                await fs.access(this.tempDir, fs.constants.W_OK | fs.constants.R_OK);
            } catch (error) {
                issues.push(`临时目录权限问题: ${error.message}`);
            }
            
            // 检查标记文件格式
            const markerFiles = await fs.readdir(this.markersDir);
            for (const file of markerFiles) {
                try {
                    const filePath = path.join(this.markersDir, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    const marker = JSON.parse(data);
                    
                    // 验证必需字段
                    if (!marker.projectId || !marker.stage || !marker.createdAt) {
                        issues.push(`标记文件格式错误: ${file}`);
                    }
                    
                    // 检查过期标记
                    const markerAge = new Date() - new Date(marker.lastUpdated || marker.createdAt);
                    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7天
                    if (markerAge > maxAgeMs) {
                        issues.push(`标记文件过期: ${file} (${Math.floor(markerAge / (24 * 60 * 60 * 1000))}天)`);
                    }
                } catch (error) {
                    issues.push(`标记文件解析失败: ${file} - ${error.message}`);
                }
            }
            
            return {
                valid: issues.length === 0,
                stats,
                issues,
                issueCount: issues.length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('验证临时文件失败:', error);
            return {
                valid: false,
                error: error.message,
                issues: [`验证过程失败: ${error.message}`],
                issueCount: 1,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = TempFileManager;