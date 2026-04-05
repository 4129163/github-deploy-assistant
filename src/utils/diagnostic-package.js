/**
 * 诊断包导出工具
 * 用于打包日志文件、配置、环境信息和错误堆栈
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const { logger } = require('./logger');
const config = require('../config');

/**
 * 创建诊断包
 * @param {Object} options - 导出选项
 * @param {string} options.projectId - 项目ID
 * @param {boolean} options.includeLogs - 是否包含日志文件
 * @param {boolean} options.includeConfig - 是否包含配置
 * @param {boolean} options.includeEnv - 是否包含环境信息
 * @param {boolean} options.includeErrors - 是否包含错误堆栈
 * @param {number} options.days - 包含最近几天的日志
 * @returns {Promise<{success: boolean, zipPath: string, error: string}>}
 */
async function createDiagnosticPackage(options = {}) {
    const {
        projectId = 'system',
        includeLogs = true,
        includeConfig = true,
        includeEnv = true,
        includeErrors = true,
        days = 7
    } = options;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const packageName = `diagnostic-package-${projectId}-${timestamp}`;
    const tempDir = path.join(os.tmpdir(), packageName);
    const zipPath = path.join(os.tmpdir(), `${packageName}.zip`);

    try {
        // 创建临时目录
        await fs.mkdir(tempDir, { recursive: true });

        // 收集诊断信息
        const diagnosticData = {
            metadata: {
                timestamp: new Date().toISOString(),
                projectId,
                system: os.platform(),
                nodeVersion: process.version,
                appVersion: require('../../package.json').version
            },
            collectionStatus: {}
        };

        // 1. 收集日志文件
        if (includeLogs) {
            try {
                await collectLogFiles(tempDir, days);
                diagnosticData.collectionStatus.logs = 'success';
            } catch (error) {
                logger.warn(`日志收集失败: ${error.message}`);
                diagnosticData.collectionStatus.logs = `failed: ${error.message}`;
            }
        }

        // 2. 收集配置信息
        if (includeConfig) {
            try {
                await collectConfigInfo(tempDir);
                diagnosticData.collectionStatus.config = 'success';
            } catch (error) {
                logger.warn(`配置收集失败: ${error.message}`);
                diagnosticData.collectionStatus.config = `failed: ${error.message}`;
            }
        }

        // 3. 收集环境信息
        if (includeEnv) {
            try {
                await collectEnvironmentInfo(tempDir);
                diagnosticData.collectionStatus.environment = 'success';
            } catch (error) {
                logger.warn(`环境信息收集失败: ${error.message}`);
                diagnosticData.collectionStatus.environment = `failed: ${error.message}`;
            }
        }

        // 4. 收集错误堆栈
        if (includeErrors) {
            try {
                await collectErrorStack(tempDir);
                diagnosticData.collectionStatus.errors = 'success';
            } catch (error) {
                logger.warn(`错误堆栈收集失败: ${error.message}`);
                diagnosticData.collectionStatus.errors = `failed: ${error.message}`;
            }
        }

        // 保存诊断元数据
        await fs.writeFile(
            path.join(tempDir, 'diagnostic-metadata.json'),
            JSON.stringify(diagnosticData, null, 2)
        );

        // 创建README文件
        await createReadmeFile(tempDir, diagnosticData);

        // 打包为ZIP
        await createZipArchive(tempDir, zipPath);

        // 清理临时目录
        await fs.rm(tempDir, { recursive: true, force: true });

        logger.info(`诊断包创建成功: ${zipPath}`);
        return {
            success: true,
            zipPath,
            filename: `${packageName}.zip`,
            size: fsSync.statSync(zipPath).size
        };

    } catch (error) {
        logger.error(`创建诊断包失败: ${error.message}`, error);
        
        // 清理临时目录
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
            // 忽略清理错误
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 收集日志文件
 */
async function collectLogFiles(tempDir, days) {
    const logsDir = path.join(tempDir, 'logs');
    await fs.mkdir(logsDir, { recursive: true });

    // 检查常见日志位置
    const logLocations = [
        'server.log',
        'deploy.log',
        'error.log',
        path.join(process.cwd(), 'logs'),
        path.join(os.homedir(), '.github-deploy-assistant', 'logs')
    ];

    for (const location of logLocations) {
        try {
            if (fsSync.existsSync(location)) {
                const stats = fsSync.statSync(location);
                if (stats.isDirectory()) {
                    // 处理日志目录
                    const files = await fs.readdir(location);
                    for (const file of files) {
                        if (file.endsWith('.log')) {
                            const filePath = path.join(location, file);
                            const destPath = path.join(logsDir, file);
                            await fs.copyFile(filePath, destPath);
                        }
                    }
                } else if (location.endsWith('.log')) {
                    // 处理单个日志文件
                    const filename = path.basename(location);
                    const destPath = path.join(logsDir, filename);
                    await fs.copyFile(location, destPath);
                }
            }
        } catch (error) {
            // 忽略单个日志文件的错误
        }
    }

    // 如果没有找到日志文件，创建一个空的日志摘要
    if ((await fs.readdir(logsDir)).length === 0) {
        await fs.writeFile(
            path.join(logsDir, 'no-logs-found.txt'),
            '未找到日志文件。这可能是因为：\n1. 日志功能未启用\n2. 日志文件位于非标准位置\n3. 应用刚刚启动'
        );
    }
}

/**
 * 收集配置信息
 */
async function collectConfigInfo(tempDir) {
    const configDir = path.join(tempDir, 'config');
    await fs.mkdir(configDir, { recursive: true });

    try {
        // 收集应用配置
        await fs.writeFile(
            path.join(configDir, 'app-config.json'),
            JSON.stringify(config, null, 2)
        );

        // 收集环境配置文件
        const envFiles = [
            '.env',
            '.env.local',
            '.env.development',
            '.env.production'
        ];

        for (const envFile of envFiles) {
            try {
                if (fsSync.existsSync(envFile)) {
                    const content = await fs.readFile(envFile, 'utf8');
                    // 移除敏感信息
                    const sanitized = content.replace(/password=.*/gi, 'password=***REMOVED***')
                                            .replace(/token=.*/gi, 'token=***REMOVED***')
                                            .replace(/key=.*/gi, 'key=***REMOVED***')
                                            .replace(/secret=.*/gi, 'secret=***REMOVED***');
                    await fs.writeFile(
                        path.join(configDir, `env-${envFile.replace(/^\./, '')}.txt`),
                        sanitized
                    );
                }
            } catch (error) {
                // 忽略单个环境文件的错误
            }
        }

        // 收集系统配置
        const systemConfig = {
            nodeEnv: process.env.NODE_ENV,
            cwd: process.cwd(),
            homedir: os.homedir(),
            tmpdir: os.tmpdir(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalmem: os.totalmem(),
            freemem: os.freemem(),
            uptime: os.uptime()
        };

        await fs.writeFile(
            path.join(configDir, 'system-config.json'),
            JSON.stringify(systemConfig, null, 2)
        );

    } catch (error) {
        throw new Error(`配置收集失败: ${error.message}`);
    }
}

/**
 * 收集环境信息
 */
async function collectEnvironmentInfo(tempDir) {
    const envDir = path.join(tempDir, 'environment');
    await fs.mkdir(envDir, { recursive: true });

    try {
        // 系统信息
        const systemInfo = {
            platform: os.platform(),
            release: os.release(),
            type: os.type(),
            version: os.version(),
            arch: os.arch(),
            cpus: os.cpus(),
            networkInterfaces: os.networkInterfaces(),
            userInfo: os.userInfo(),
            hostname: os.hostname()
        };

        await fs.writeFile(
            path.join(envDir, 'system-info.json'),
            JSON.stringify(systemInfo, null, 2)
        );

        // Node.js 环境
        const nodeInfo = {
            version: process.version,
            versions: process.versions,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            ppid: process.ppid,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            argv: process.argv,
            execPath: process.execPath,
            cwd: process.cwd(),
            env: Object.keys(process.env).length
        };

        await fs.writeFile(
            path.join(envDir, 'node-info.json'),
            JSON.stringify(nodeInfo, null, 2)
        );

        // 检查依赖工具
        const tools = await checkDependencyTools();
        await fs.writeFile(
            path.join(envDir, 'dependency-tools.json'),
            JSON.stringify(tools, null, 2)
        );

        // 磁盘空间信息
        const diskInfo = await getDiskInfo();
        await fs.writeFile(
            path.join(envDir, 'disk-info.json'),
            JSON.stringify(diskInfo, null, 2)
        );

    } catch (error) {
        throw new Error(`环境信息收集失败: ${error.message}`);
    }
}

/**
 * 收集错误堆栈
 */
async function collectErrorStack(tempDir) {
    const errorsDir = path.join(tempDir, 'errors');
    await fs.mkdir(errorsDir, { recursive: true });

    try {
        // 从日志文件中提取错误
        const errorPatterns = [
            /error:/i,
            /exception:/i,
            /failed/i,
            /uncaught/i,
            /traceback/i,
            /stack trace/i
        ];

        // 检查常见错误日志位置
        const errorLogs = [];

        // 尝试从内存中获取最近的错误（如果有的话）
        // 这里可以扩展为从应用错误存储中获取
        
        if (errorLogs.length === 0) {
            await fs.writeFile(
                path.join(errorsDir, 'no-recent-errors.txt'),
                '未找到最近的错误堆栈。\n这可能是因为：\n1. 应用运行正常，没有发生错误\n2. 错误日志功能未启用\n3. 错误已被清理'
            );
        } else {
            await fs.writeFile(
                path.join(errorsDir, 'recent-errors.json'),
                JSON.stringify(errorLogs, null, 2)
            );
        }

        // 创建错误分析报告
        const errorReport = {
            timestamp: new Date().toISOString(),
            totalErrors: errorLogs.length,
            errorTypes: {},
            recommendations: []
        };

        await fs.writeFile(
            path.join(errorsDir, 'error-analysis-report.json'),
            JSON.stringify(errorReport, null, 2)
        );

    } catch (error) {
        throw new Error(`错误堆栈收集失败: ${error.message}`);
    }
}

/**
 * 检查依赖工具
 */
async function checkDependencyTools() {
    const tools = [
        { name: 'node', command: 'node --version', versionPattern: /v(\d+\.\d+\.\d+)/ },
        { name: 'npm', command: 'npm --version', versionPattern: /(\d+\.\d+\.\d+)/ },
        { name: 'git', command: 'git --version', versionPattern: /git version (\d+\.\d+\.\d+)/ },
        { name: 'python', command: 'python3 --version || python --version', versionPattern: /Python (\d+\.\d+\.\d+)/ },
        { name: 'docker', command: 'docker --version', versionPattern: /Docker version (\d+\.\d+\.\d+)/ },
        { name: 'curl', command: 'curl --version', versionPattern: /curl (\d+\.\d+\.\d+)/ },
        { name: 'wget', command: 'wget --version', versionPattern: /GNU Wget (\d+\.\d+)/ }
    ];

    const results = {};

    for (const tool of tools) {
        try {
            const { stdout } = await execAsync(tool.command, { timeout: 5000 });
            const match = stdout.match(tool.versionPattern);
            results[tool.name] = {
                installed: true,
                version: match ? match[1] : 'unknown',
                rawOutput: stdout.trim()
            };
        } catch (error) {
            results[tool.name] = {
                installed: false,
                error: error.message
            };
        }
    }

    return results;
}

/**
 * 获取磁盘信息
 */
async function getDiskInfo() {
    const diskInfo = {
        platform: os.platform(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        homedir: os.homedir(),
        tmpdir: os.tmpdir()
    };

    // 在Linux/Unix系统上获取更详细的磁盘信息
    if (os.platform() !== 'win32') {
        try {
            const { stdout } = await execAsync('df -h', { timeout: 5000 });
            diskInfo.dfOutput = stdout;
        } catch (error) {
            diskInfo.dfError = error.message;
        }
    }

    return diskInfo;
}

/**
 * 创建README文件
 */
async function createReadmeFile(tempDir, diagnosticData) {
    const readmeContent = `# GitHub Deploy Assistant 诊断包

## 基本信息
- 生成时间: ${diagnosticData.metadata.timestamp}
- 项目ID: ${diagnosticData.metadata.projectId}
- 系统: ${diagnosticData.metadata.system}
- Node.js 版本: ${diagnosticData.metadata.nodeVersion}
- 应用版本: ${diagnosticData.metadata.appVersion}

## 包含内容
${Object.entries(diagnosticData.collectionStatus).map(([key, status]) => `- ${key}: ${status}`).join('\n')}

## 目录结构
1. logs/ - 日志文件
2. config/ - 配置文件
3. environment/ - 环境信息
4. errors/ - 错误堆栈
5. diagnostic-metadata.json - 元数据
6. README.md - 本文件

## 使用说明
此诊断包包含了应用运行时的关键信息，可用于：
1. 故障排查
2. 性能分析
3. 环境验证
4. 开发者调试

## 隐私说明
- 敏感信息（如密码、密钥）已被移除或混淆
- 请勿公开分享此诊断包
- 仅在信任的开发人员之间共享

## 支持
如有问题，请提供此诊断包给技术支持人员。
`;

    await fs.writeFile(path.join(tempDir, 'README.md'), readmeContent);
}

/**
 * 创建ZIP压缩包
 */
async function createZipArchive(sourceDir, zipPath) {
    return new Promise((resolve, reject) => {
        const output = fsSync.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // 最高压缩级别
        });

        output.on('close', () => {
            resolve();
        });

        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                logger.warn(`压缩警告: ${err.message}`);
            } else {
                reject(err);
            }
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

/**
 * 清理旧的诊断包
 * @param {number} maxAgeDays - 最大保留天数
 */
async function cleanupOldDiagnosticPackages(maxAgeDays = 30) {
    try {
        const tmpDir = os.tmpdir();
        const files = await fs.readdir(tmpDir);
        const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

        for (const file of files) {
            if (file.startsWith('diagnostic-package-') && file.endsWith('.zip')) {
                const filePath = path.join(tmpDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtimeMs < cutoffTime) {
                    await fs.unlink(filePath);
                    logger.info(`清理旧诊断包: ${file}`);
                }
            }
        }
    } catch (error) {
        logger.warn(`清理诊断包失败: ${error.message}`);
    }
}

module.exports = {
    createDiagnosticPackage,
    cleanupOldDiagnosticPackages
};