/**
 * 跨平台压缩/解压工具
 * 支持 Windows 和 Linux/macOS
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { logger } = require('./logger');

/**
 * 检测操作系统
 */
function getPlatform() {
  return process.platform;
}

/**
 * 检测是否支持 tar 命令
 */
async function hasTarCommand() {
  return new Promise((resolve) => {
    const platform = getPlatform();
    if (platform === 'win32') {
      // Windows 通常没有原生 tar，但可能有 Git Bash 或 WSL
      const which = spawn('where', ['tar'], { shell: true });
      which.on('close', (code) => {
        resolve(code === 0);
      });
      which.on('error', () => resolve(false));
    } else {
      // Linux/macOS 通常有 tar
      const which = spawn('which', ['tar']);
      which.on('close', (code) => {
        resolve(code === 0);
      });
      which.on('error', () => resolve(false));
    }
  });
}

/**
 * 使用 tar 命令创建压缩包
 */
async function createTarArchive(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const sourceName = path.basename(sourceDir);
    const parentDir = path.dirname(sourceDir);
    
    const tar = spawn('tar', [
      '-czf', outputPath,
      '-C', parentDir,
      sourceName
    ]);
    
    tar.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar command failed with exit code ${code}`));
      }
    });
    
    tar.on('error', (err) => {
      reject(new Error(`tar command error: ${err.message}`));
    });
  });
}

/**
 * 使用 tar 命令解压压缩包
 */
async function extractTarArchive(archivePath, targetDir) {
  return new Promise((resolve, reject) => {
    const tar = spawn('tar', [
      '-xzf', archivePath,
      '-C', targetDir
    ]);
    
    tar.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar extract failed with exit code ${code}`));
      }
    });
    
    tar.on('error', (err) => {
      reject(new Error(`tar extract error: ${err.message}`));
    });
  });
}

/**
 * 使用 Node.js 原生方法创建压缩包（跨平台）
 */
async function createZipArchive(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const archiver = require('archiver');
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      });
      
      output.on('close', () => {
        logger.info(`Archive created: ${outputPath} (${archive.pointer()} bytes)`);
        resolve();
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    } catch (err) {
      reject(new Error(`Failed to create zip archive: ${err.message}`));
    }
  });
}

/**
 * 使用 Node.js 原生方法解压压缩包（跨平台）
 */
async function extractZipArchive(archivePath, targetDir) {
  return new Promise((resolve, reject) => {
    try {
      const extract = require('extract-zip');
      extract(archivePath, { dir: targetDir })
        .then(() => resolve())
        .catch(reject);
    } catch (err) {
      reject(new Error(`Failed to extract zip archive: ${err.message}`));
    }
  });
}

/**
 * 创建备份（自动选择最佳方法）
 */
async function createBackup(sourceDir, backupName = null) {
  const platform = getPlatform();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sourceName = path.basename(sourceDir);
  const backupDir = path.join(path.dirname(sourceDir), '.backups');
  
  await fs.ensureDir(backupDir);
  
  const backupFileName = backupName || `${sourceName}-${timestamp}`;
  let backupPath;
  let method;
  
  // 检查是否支持 tar
  const hasTar = await hasTarCommand();
  
  if (hasTar && platform !== 'win32') {
    // Linux/macOS 且有 tar 命令，使用 tar.gz
    backupPath = path.join(backupDir, `${backupFileName}.tar.gz`);
    method = 'tar';
    await createTarArchive(sourceDir, backupPath);
  } else {
    // Windows 或不支持 tar，使用 zip
    backupPath = path.join(backupDir, `${backupFileName}.zip`);
    method = 'zip';
    await createZipArchive(sourceDir, backupPath);
  }
  
  logger.info(`Backup created using ${method}: ${backupPath}`);
  return {
    path: backupPath,
    method,
    size: (await fs.stat(backupPath)).size
  };
}

/**
 * 恢复备份（自动检测格式）
 */
async function restoreBackup(backupPath, targetDir) {
  const extension = path.extname(backupPath).toLowerCase();
  
  await fs.ensureDir(targetDir);
  
  if (extension === '.tar.gz' || extension === '.tgz') {
    // 尝试使用 tar 解压
    try {
      await extractTarArchive(backupPath, targetDir);
      logger.info(`Restored from tar.gz: ${backupPath}`);
    } catch (err) {
      logger.warn(`tar extract failed, trying zip method: ${err.message}`);
      // 如果 tar 失败，尝试作为 zip 处理
      await extractZipArchive(backupPath, targetDir);
    }
  } else if (extension === '.zip') {
    // 使用 zip 解压
    await extractZipArchive(backupPath, targetDir);
    logger.info(`Restored from zip: ${backupPath}`);
  } else {
    throw new Error(`Unsupported backup format: ${extension}`);
  }
}

/**
 * 获取备份列表
 */
async function listBackups(backupDir, projectName = null) {
  await fs.ensureDir(backupDir);
  const files = await fs.readdir(backupDir);
  
  return files
    .filter(f => {
      if (!projectName) return true;
      return f.startsWith(projectName + '-');
    })
    .filter(f => f.endsWith('.tar.gz') || f.endsWith('.zip') || f.endsWith('.tgz'))
    .sort()
    .reverse()
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      time: f.replace(/\.(tar\.gz|zip|tgz)$/, '').split('-').slice(-5).join('-'),
      size: fs.statSync(path.join(backupDir, f)).size
    }));
}

/**
 * 压缩目录（通用接口）
 */
async function compress(sourceDir, outputPath) {
  try {
    const extension = path.extname(outputPath).toLowerCase();
    const platform = getPlatform();
    const hasTar = await hasTarCommand();
    
    let format;
    let size;
    
    if ((extension === '.tar.gz' || extension === '.tgz') && hasTar) {
      // 使用tar命令
      await createTarArchive(sourceDir, outputPath);
      format = 'tar.gz';
    } else if (extension === '.zip' || !hasTar || platform === 'win32') {
      // 使用zip格式（跨平台）
      await createZipArchive(sourceDir, outputPath);
      format = 'zip';
    } else {
      // 默认使用tar.gz
      await createTarArchive(sourceDir, outputPath);
      format = 'tar.gz';
    }
    
    const stats = await fs.stat(outputPath);
    size = stats.size;
    
    logger.info(`Compressed ${sourceDir} to ${outputPath} (${format}, ${size} bytes)`);
    
    return {
      success: true,
      format,
      size,
      path: outputPath
    };
  } catch (error) {
    logger.error(`Compression failed: ${error.message}`, { sourceDir, outputPath });
    return {
      success: false,
      error: error.message,
      format: null,
      size: 0
    };
  }
}

/**
 * 解压文件（通用接口）
 */
async function decompress(archivePath, targetDir) {
  try {
    if (!(await fs.pathExists(archivePath))) {
      throw new Error(`Archive file not found: ${archivePath}`);
    }
    
    await fs.ensureDir(targetDir);
    const extension = path.extname(archivePath).toLowerCase();
    
    let format;
    let extractedFiles = 0;
    
    if (extension === '.tar.gz' || extension === '.tgz') {
      // 尝试使用tar解压
      try {
        await extractTarArchive(archivePath, targetDir);
        format = 'tar.gz';
      } catch (err) {
        logger.warn(`tar extract failed, trying zip method: ${err.message}`);
        // 如果tar失败，尝试作为zip处理
        await extractZipArchive(archivePath, targetDir);
        format = 'zip';
      }
    } else if (extension === '.zip') {
      // 使用zip解压
      await extractZipArchive(archivePath, targetDir);
      format = 'zip';
    } else {
      throw new Error(`Unsupported archive format: ${extension}`);
    }
    
    // 统计解压的文件数量
    const files = await fs.readdir(targetDir, { recursive: true });
    extractedFiles = files.length;
    
    logger.info(`Decompressed ${archivePath} to ${targetDir} (${format}, ${extractedFiles} files)`);
    
    return {
      success: true,
      format,
      extractedFiles,
      targetDir
    };
  } catch (error) {
    logger.error(`Decompression failed: ${error.message}`, { archivePath, targetDir });
    return {
      success: false,
      error: error.message,
      format: null,
      extractedFiles: 0
    };
  }
}

module.exports = {
  createBackup,
  restoreBackup,
  listBackups,
  compress,
  decompress,
  getPlatform,
  hasTarCommand
};