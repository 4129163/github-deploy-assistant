/**
 * 诊断包导出API路由
 * 【工具-P2】一键导出诊断包功能
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const { createDiagnosticPackage, cleanupOldDiagnosticPackages } = require('../utils/diagnostic-package');
const { logger } = require('../utils/logger');

// 中间件：验证请求
function validateExportRequest(req, res, next) {
    const { projectId, includeLogs, includeConfig, includeEnv, includeErrors, days } = req.body;
    
    // 验证参数
    if (days && (isNaN(days) || days < 1 || days > 30)) {
        return res.status(400).json({
            success: false,
            error: 'days参数必须是1-30之间的数字'
        });
    }
    
    next();
}

// 中间件：清理旧诊断包
async function autoCleanupMiddleware(req, res, next) {
    try {
        // 异步清理30天前的旧诊断包
        cleanupOldDiagnosticPackages(30).catch(err => {
            logger.warn(`自动清理失败: ${err.message}`);
        });
    } catch (error) {
        // 忽略清理错误，不影响主流程
    }
    next();
}

/**
 * POST /api/diagnostic/export
 * 创建并导出诊断包
 * 
 * 请求体：
 * {
 *   "projectId": "项目ID", // 可选，默认为'system'
 *   "includeLogs": true,   // 是否包含日志文件
 *   "includeConfig": true, // 是否包含配置
 *   "includeEnv": true,    // 是否包含环境信息
 *   "includeErrors": true, // 是否包含错误堆栈
 *   "days": 7             // 包含最近几天的日志
 * }
 * 
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "downloadUrl": "/api/diagnostic/download/filename.zip",
 *     "filename": "diagnostic-package-system-2026-04-05T03-04-45-123Z.zip",
 *     "size": 123456,
 *     "createdAt": "2026-04-05T03:04:45.123Z"
 *   }
 * }
 */
router.post('/export', validateExportRequest, autoCleanupMiddleware, async (req, res) => {
    try {
        const {
            projectId = 'system',
            includeLogs = true,
            includeConfig = true,
            includeEnv = true,
            includeErrors = true,
            days = 7
        } = req.body;

        logger.info(`开始创建诊断包: project=${projectId}, logs=${includeLogs}, config=${includeConfig}, env=${includeEnv}, errors=${includeErrors}, days=${days}`);

        // 创建诊断包
        const result = await createDiagnosticPackage({
            projectId,
            includeLogs,
            includeConfig,
            includeEnv,
            includeErrors,
            days
        });

        if (!result.success) {
            logger.error(`创建诊断包失败: ${result.error}`);
            return res.status(500).json({
                success: false,
                error: `创建诊断包失败: ${result.error}`
            });
        }

        const downloadUrl = `/api/diagnostic/download/${path.basename(result.zipPath)}`;
        
        logger.info(`诊断包创建成功: ${result.filename}, 大小: ${result.size} bytes`);

        res.json({
            success: true,
            data: {
                downloadUrl,
                filename: result.filename,
                size: result.size,
                createdAt: new Date().toISOString(),
                downloadInstructions: `使用 GET ${downloadUrl} 下载文件`
            }
        });

    } catch (error) {
        logger.error(`诊断包导出API错误: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: `服务器内部错误: ${error.message}`
        });
    }
});

/**
 * GET /api/diagnostic/download/:filename
 * 下载诊断包文件
 */
router.get('/download/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        // 安全验证：确保只允许下载诊断包文件
        if (!filename.startsWith('diagnostic-package-') || !filename.endsWith('.zip')) {
            return res.status(400).json({
                success: false,
                error: '无效的文件名格式'
            });
        }

        const filePath = path.join(os.tmpdir(), filename);
        
        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: '文件不存在或已过期'
            });
        }

        // 获取文件信息
        const stats = await fs.stat(filePath);
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // 流式传输文件
        const stream = require('fs').createReadStream(filePath);
        stream.pipe(res);

        // 记录下载日志
        logger.info(`诊断包下载: ${filename}, IP: ${req.ip}, Size: ${stats.size} bytes`);

        // 文件传输完成后不立即删除，让用户有时间下载
        // 清理由定时任务处理

    } catch (error) {
        logger.error(`诊断包下载错误: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: `文件下载失败: ${error.message}`
        });
    }
});

/**
 * GET /api/diagnostic/status
 * 获取诊断包系统状态
 */
router.get('/status', async (req, res) => {
    try {
        const tmpDir = os.tmpdir();
        const files = await fs.readdir(tmpDir);
        
        const diagnosticFiles = files
            .filter(file => file.startsWith('diagnostic-package-') && file.endsWith('.zip'))
            .map(file => {
                const filePath = path.join(tmpDir, file);
                const stats = require('fs').statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    created: stats.mtime,
                    ageHours: Math.round((Date.now() - stats.mtimeMs) / (1000 * 60 * 60))
                };
            })
            .sort((a, b) => b.created - a.created); // 按创建时间倒序

        const systemInfo = {
            platform: os.platform(),
            tmpdir: tmpDir,
            totalFiles: diagnosticFiles.length,
            totalSize: diagnosticFiles.reduce((sum, file) => sum + file.size, 0),
            autoCleanupEnabled: true,
            maxAgeDays: 30
        };

        res.json({
            success: true,
            data: {
                system: systemInfo,
                files: diagnosticFiles
            }
        });

    } catch (error) {
        logger.error(`获取诊断包状态错误: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: `获取状态失败: ${error.message}`
        });
    }
});

/**
 * DELETE /api/diagnostic/cleanup
 * 手动清理诊断包
 * 
 * 请求体：
 * {
 *   "maxAgeHours": 24, // 可选，清理多少小时前的文件，默认24小时
 *   "dryRun": true    // 可选，仅显示要删除的文件而不实际删除
 * }
 */
router.delete('/cleanup', async (req, res) => {
    try {
        const { maxAgeHours = 24, dryRun = false } = req.body;
        
        if (isNaN(maxAgeHours) || maxAgeHours < 1) {
            return res.status(400).json({
                success: false,
                error: 'maxAgeHours必须是大于0的数字'
            });
        }

        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        const tmpDir = os.tmpdir();
        const files = await fs.readdir(tmpDir);
        
        const filesToDelete = [];
        const errors = [];

        for (const file of files) {
            if (file.startsWith('diagnostic-package-') && file.endsWith('.zip')) {
                const filePath = path.join(tmpDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.mtimeMs < cutoffTime) {
                        filesToDelete.push({
                            filename: file,
                            size: stats.size,
                            created: stats.mtime,
                            ageHours: Math.round((Date.now() - stats.mtimeMs) / (1000 * 60 * 60))
                        });

                        if (!dryRun) {
                            await fs.unlink(filePath);
                            logger.info(`清理诊断包: ${file}`);
                        }
                    }
                } catch (error) {
                    errors.push({ filename: file, error: error.message });
                }
            }
        }

        const response = {
            success: true,
            data: {
                dryRun,
                maxAgeHours,
                filesDeleted: filesToDelete.length,
                totalSize: filesToDelete.reduce((sum, file) => sum + file.size, 0),
                files: filesToDelete
            }
        };

        if (errors.length > 0) {
            response.warnings = errors;
        }

        if (dryRun) {
            response.message = `预览：将删除 ${filesToDelete.length} 个文件`;
        } else {
            response.message = `已删除 ${filesToDelete.length} 个文件`;
        }

        res.json(response);

    } catch (error) {
        logger.error(`诊断包清理错误: ${error.message}`, error);
        res.status(500).json({
            success: false,
            error: `清理失败: ${error.message}`
        });
    }
});

module.exports = router;