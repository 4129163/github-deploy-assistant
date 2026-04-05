/**
 * 目录检测器
 * 检测文件系统中的非安装式程序目录
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class DirectoryDetector {
  constructor() {
    this.homeDir = os.homedir();
    this.commonPaths = this.getCommonPaths();
  }

  /**
   * 获取常见扫描路径
   */
  getCommonPaths() {
    const platform = os.platform();
    const paths = [
      this.homeDir,
      path.join(this.homeDir, '.config'),
      path.join(this.homeDir, '.local', 'share'),
      path.join(this.homeDir, '.cache'),
      path.join(this.homeDir, 'Documents'),
      path.join(this.homeDir, 'Desktop')
    ];

    // 平台特定路径
    if (platform === 'win32') {
      paths.push(
        path.join(process.env.APPDATA || '', 'Local'),
        path.join(process.env.PROGRAMDATA || ''),
        'C:\\Program Files',
        'C:\\Program Files (x86)'
      );
    } else if (platform === 'darwin') {
      paths.push(
        path.join(this.homeDir, 'Library', 'Application Support'),
        path.join(this.homeDir, 'Library', 'Preferences'),
        '/Applications',
        '/Library',
        '/opt'
      );
    } else {
      // Linux/Unix
      paths.push(
        '/opt',
        '/usr/local',
        '/usr/local/bin',
        '/usr/local/share',
        '/etc',
        '/var'
      );
    }

    return paths.filter(p => p); // 移除空路径
  }

  /**
   * 检测非安装式程序目录
   */
  async detectNonInstalledPrograms(fingerprints, maxDepth = 3) {
    const results = [];
    
    for (const [programName, fingerprint] of Object.entries(fingerprints)) {
      const detected = await this.findProgramDirectories(programName, fingerprint, maxDepth);
      results.push(...detected);
    }
    
    return results;
  }

  /**
   * 查找程序目录
   */
  async findProgramDirectories(programName, fingerprint, maxDepth) {
    const results = [];
    const searchPatterns = fingerprint.directoryPatterns || [];
    const fileFingerprints = fingerprint.fileFingerprints || [];
    
    // 检查每个预定义的目录模式
    for (const pattern of searchPatterns) {
      const dirPath = this.expandPath(pattern);
      
      try {
        if (await fs.pathExists(dirPath)) {
          const stats = await fs.stat(dirPath);
          
          if (stats.isDirectory()) {
            const matchResult = await this.evaluateDirectoryMatch(
              dirPath, 
              programName, 
              fileFingerprints
            );
            
            if (matchResult.confidence > 0) {
              results.push({
                program: programName,
                confidence: matchResult.confidence,
                detectedBy: ['目录匹配'],
                details: {
                  path: dirPath,
                  size: this.formatFileSize(stats.size),
                  modified: stats.mtime.toLocaleString('zh-CN'),
                  created: stats.birthtime?.toLocaleString('zh-CN') || '未知',
                  hasFingerprintFiles: matchResult.hasFingerprint,
                  fingerprintFiles: matchResult.fingerprintFiles
                }
              });
            }
          }
        }
      } catch (error) {
        // 忽略权限错误等
      }
    }
    
    // 深度扫描：在常见路径中搜索程序名
    if (maxDepth > 0) {
      const deepResults = await this.deepScanForProgram(programName, maxDepth);
      results.push(...deepResults);
    }
    
    return results;
  }

  /**
   * 评估目录匹配度
   */
  async evaluateDirectoryMatch(dirPath, programName, fileFingerprints) {
    let confidence = 30; // 基础分：目录存在
    let hasFingerprint = false;
    const foundFingerprintFiles = [];
    
    // 检查指纹文件
    for (const fp of fileFingerprints) {
      const filePath = path.join(dirPath, fp.name);
      
      try {
        if (await fs.pathExists(filePath)) {
          confidence += 40; // 指纹文件存在
          hasFingerprint = true;
          foundFingerprintFiles.push(fp.name);
          
          // 检查文件内容
          if (fp.contains && fp.contains.length > 0) {
            const content = await fs.readFile(filePath, 'utf8').catch(() => '');
            const contentMatch = fp.contains.some(keyword => 
              content.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (contentMatch) {
              confidence += 30; // 内容匹配
            }
          }
        }
      } catch (error) {
        // 忽略文件读取错误
      }
    }
    
    // 检查目录名称匹配度
    const dirName = path.basename(dirPath).toLowerCase();
    const progNameLower = programName.toLowerCase();
    
    if (dirName.includes(progNameLower)) {
      confidence += 20;
    }
    
    return {
      confidence: this.getConfidenceLevel(confidence),
      hasFingerprint,
      fingerprintFiles: foundFingerprintFiles
    };
  }

  /**
   * 深度扫描程序
   */
  async deepScanForProgram(programName, maxDepth) {
    const results = [];
    const progNameLower = programName.toLowerCase();
    
    // 限制扫描的路径数量，避免性能问题
    const scanPaths = this.commonPaths.slice(0, 10);
    
    for (const basePath of scanPaths) {
      try {
        if (await fs.pathExists(basePath)) {
          const found = await this.scanDirectoryRecursive(
            basePath, 
            progNameLower, 
            maxDepth,
            0 // 当前深度
          );
          
          if (found.length > 0) {
            results.push(...found.map(dir => ({
              program: programName,
              confidence: '低', // 深度扫描可信度较低
              detectedBy: ['深度目录扫描'],
              details: {
                path: dir,
                size: '未知',
                modified: '未知',
                note: '通过深度扫描发现，需要进一步确认'
              }
            })));
          }
        }
      } catch (error) {
        // 忽略权限错误
      }
    }
    
    return results;
  }

  /**
   * 递归扫描目录
   */
  async scanDirectoryRecursive(currentPath, searchName, maxDepth, currentDepth) {
    if (currentDepth >= maxDepth) {
      return [];
    }
    
    const foundDirs = [];
    
    try {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        
        try {
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            // 检查目录名是否包含搜索词
            if (item.toLowerCase().includes(searchName)) {
              foundDirs.push(itemPath);
            }
            
            // 递归扫描子目录（限制深度）
            if (currentDepth < maxDepth - 1) {
              const subFound = await this.scanDirectoryRecursive(
                itemPath, 
                searchName, 
                maxDepth, 
                currentDepth + 1
              );
              foundDirs.push(...subFound);
            }
          }
        } catch (error) {
          // 忽略单个项目错误
        }
      }
    } catch (error) {
      // 忽略目录读取错误
    }
    
    return foundDirs;
  }

  /**
   * 展开路径（替换 ~ 等）
   */
  expandPath(inputPath) {
    let expanded = inputPath;
    
    // 替换 ~ 为用户目录
    if (expanded.startsWith('~/') || expanded === '~') {
      expanded = path.join(this.homeDir, expanded.substring(1));
    }
    
    // 替换环境变量（Windows风格）
    if (os.platform() === 'win32') {
      expanded = expanded.replace(/%([^%]+)%/g, (match, envVar) => {
        return process.env[envVar] || match;
      });
    }
    
    // 替换环境变量（Unix风格）
    expanded = expanded.replace(/\$([A-Z_]+)/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
    
    return expanded;
  }

  /**
   * 获取目录大小
   */
  async getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        
        try {
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            const subSize = await this.getDirectorySize(itemPath);
            totalSize += subSize;
          } else {
            totalSize += stats.size;
          }
        } catch (error) {
          // 忽略单个项目错误
        }
      }
    } catch (error) {
      // 忽略目录读取错误
    }
    
    return totalSize;
  }

  /**
   * 检查目录是否可疑
   */
  async isSuspiciousDirectory(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      
      // 检查隐藏目录
      const isHidden = path.basename(dirPath).startsWith('.');
      
      // 检查最近修改时间（7天内）
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentlyModified = stats.mtime.getTime() > sevenDaysAgo;
      
      // 检查常见的可疑文件名
      const items = await fs.readdir(dirPath).catch(() => []);
      const hasSuspiciousFiles = items.some(item => {
        const lowerItem = item.toLowerCase();
        return (
          lowerItem.includes('agent') ||
          lowerItem.includes('bot') ||
          lowerItem.includes('crawler') ||
          lowerItem.includes('spider') ||
          lowerItem.includes('miner') ||
          lowerItem.endsWith('.exe') ||
          lowerItem.endsWith('.dll')
        );
      });
      
      return {
        isHidden,
        recentlyModified,
        hasSuspiciousFiles,
        itemCount: items.length
      };
      
    } catch (error) {
      return {
        isHidden: false,
        recentlyModified: false,
        hasSuspiciousFiles: false,
        itemCount: 0,
        error: error.message
      };
    }
  }

  /**
   * 根据分数获取可信度等级
   */
  getConfidenceLevel(score) {
    if (score >= 80) return '高';
    if (score >= 50) return '中';
    return '低';
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);
    return size.toFixed(i > 0 ? 2 : 0) + ' ' + sizes[i];
  }

  /**
   * 获取目录统计信息
   */
  async getDirectoryStats(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      const items = await fs.readdir(dirPath);
      
      let fileCount = 0;
      let dirCount = 0;
      let totalSize = 0;
      
      for (const item of items.slice(0, 100)) { // 限制检查数量
        const itemPath = path.join(dirPath, item);
        
        try {
          const itemStats = await fs.stat(itemPath);
          
          if (itemStats.isDirectory()) {
            dirCount++;
          } else {
            fileCount++;
            totalSize += itemStats.size;
          }
        } catch (error) {
          // 忽略单个项目错误
        }
      }
      
      return {
        exists: true,
        isDirectory: stats.isDirectory(),
        size: this.formatFileSize(totalSize),
        fileCount,
        dirCount,
        totalItems: items.length,
        modified: stats.mtime.toLocaleString('zh-CN'),
        permissions: stats.mode.toString(8)
      };
      
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }
}

module.exports = DirectoryDetector;