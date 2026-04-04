/**
 * 磁盘空间检测器
 */

const BaseDetector = require('./BaseDetector');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class DiskDetector extends BaseDetector {
  constructor() {
    super();
    this.name = 'DiskDetector';
    this.description = '检测磁盘空间是否足够';
    this.priority = 20; // 高优先级
  }

  /**
   * 执行磁盘空间检测
   * @param {Object} context 检测上下文
   * @returns {Promise<Array>} 检测结果
   */
  async detect(context) {
    const issues = [];
    const { project, workspacePath = process.cwd() } = context;
    
    if (!project) {
      return issues;
    }

    try {
      // 获取目标部署路径
      const targetPath = this.getTargetPath(context);
      
      // 获取磁盘空间信息
      const diskInfo = await this.getDiskInfo(targetPath);
      
      // 估算项目所需空间
      const requiredSpace = await this.estimateRequiredSpace(project, context);
      
      // 检查空间是否足够
      if (diskInfo.availableGB < requiredSpace) {
        const shortageGB = (requiredSpace - diskInfo.availableGB).toFixed(2);
        
        issues.push(this.formatIssue({
          type: 'disk_space_insufficient',
          title: `磁盘空间不足`,
          description: `部署需要 ${requiredSpace.toFixed(2)}GB 空间，但 ${targetPath} 所在磁盘仅剩 ${diskInfo.availableGB.toFixed(2)}GB，缺少 ${shortageGB}GB`,
          severity: 'high',
          fixable: true,
          fixType: 'semi-auto',
          fixSteps: [
            {
              type: 'suggestion',
              description: `清理 ${targetPath} 所在磁盘的临时文件`
            },
            {
              type: 'suggestion',
              description: '删除不需要的旧项目或文件'
            },
            {
              type: 'suggestion',
              description: `更换部署目录到有足够空间的磁盘`
            },
            {
              type: 'command',
              description: '查看磁盘使用情况',
              command: this.getDiskUsageCommand(targetPath)
            }
          ],
          data: {
            targetPath,
            diskInfo,
            requiredSpaceGB: requiredSpace,
            shortageGB: parseFloat(shortageGB),
            availableSpaceGB: diskInfo.availableGB
          }
        }));
      } else if (diskInfo.availableGB < requiredSpace * 2) {
        // 空间足够但接近极限
        issues.push(this.formatIssue({
          type: 'disk_space_low',
          title: `磁盘空间紧张`,
          description: `部署需要 ${requiredSpace.toFixed(2)}GB 空间，${targetPath} 所在磁盘剩余 ${diskInfo.availableGB.toFixed(2)}GB，建议预留更多空间`,
          severity: 'medium',
          fixable: true,
          fixType: 'manual',
          fixSteps: [
            {
              type: 'suggestion',
              description: '考虑清理磁盘空间以获得更好的性能'
            }
          ],
          data: {
            targetPath,
            diskInfo,
            requiredSpaceGB: requiredSpace,
            warningThreshold: requiredSpace * 2
          }
        }));
      }
      
    } catch (error) {
      console.error('磁盘空间检测失败:', error.message);
      // 添加一个警告问题
      issues.push(this.formatIssue({
        type: 'disk_check_failed',
        title: '磁盘空间检测失败',
        description: `无法检测磁盘空间: ${error.message}`,
        severity: 'low',
        fixable: false,
        data: { error: error.message }
      }));
    }

    return issues;
  }

  /**
   * 获取目标部署路径
   * @param {Object} context 检测上下文
   * @returns {string}
   */
  getTargetPath(context) {
    const { project, workspacePath } = context;
    
    // 优先使用项目配置的路径
    if (project.config && project.config.deployPath) {
      return project.config.deployPath;
    }
    
    // 使用工作空间路径
    if (workspacePath) {
      return workspacePath;
    }
    
    // 默认使用当前目录
    return process.cwd();
  }

  /**
   * 获取磁盘信息
   * @param {string} path 路径
   * @returns {Promise<Object>} 磁盘信息
   */
  async getDiskInfo(path) {
    try {
      // 方法1: 使用 df 命令
      if (process.platform !== 'win32') {
        const { stdout } = await execAsync(`df -BG "${path}" | tail -1`);
        const parts = stdout.trim().split(/\s+/);
        
        if (parts.length >= 4) {
          const totalGB = parseFloat(parts[1].replace('G', ''));
          const usedGB = parseFloat(parts[2].replace('G', ''));
          const availableGB = parseFloat(parts[3].replace('G', ''));
          const usagePercent = parseFloat(parts[4].replace('%', ''));
          
          return {
            totalGB,
            usedGB,
            availableGB,
            usagePercent,
            mountPoint: parts[5] || path
          };
        }
      }
      
      // 方法2: 使用 Node.js 的 fs 模块（Windows 兼容）
      const stats = fs.statfsSync ? fs.statfsSync(path) : null;
      if (stats) {
        const totalBytes = stats.blocks * stats.bsize;
        const freeBytes = stats.bfree * stats.bsize;
        const totalGB = totalBytes / (1024 * 1024 * 1024);
        const availableGB = freeBytes / (1024 * 1024 * 1024);
        const usagePercent = ((totalBytes - freeBytes) / totalBytes * 100);
        
        return {
          totalGB,
          usedGB: totalGB - availableGB,
          availableGB,
          usagePercent,
          mountPoint: path
        };
      }
      
      // 方法3: 回退方案
      return {
        totalGB: 100, // 默认值
        usedGB: 50,   // 默认值
        availableGB: 50, // 默认值
        usagePercent: 50,
        mountPoint: path,
        estimated: true
      };
      
    } catch (error) {
      console.error('获取磁盘信息失败:', error.message);
      throw error;
    }
  }

  /**
   * 估算项目所需空间
   * @param {Object} project 项目信息
   * @param {Object} context 检测上下文
   * @returns {Promise<number>} 所需空间（GB）
   */
  async estimateRequiredSpace(project, context) {
    // 基础空间需求（GB）
    let requiredSpace = 1.0; // 默认1GB
    
    // 根据项目类型调整
    if (project.types) {
      const typeSpace = {
        'node': 0.5,
        'python': 0.5,
        'java': 2.0,
        'go': 0.3,
        'rust': 1.0,
        'docker': 2.0,
        'react': 0.3,
        'vue': 0.3,
        'next': 0.5
      };
      
      project.types.forEach(type => {
        const space = typeSpace[type.toLowerCase()];
        if (space) {
          requiredSpace = Math.max(requiredSpace, space);
        }
      });
    }
    
    // 考虑依赖包大小
    if (project.config && project.config.hasLargeDependencies) {
      requiredSpace += 1.0;
    }
    
    // 考虑数据库空间
    if (project.config && project.config.hasDatabase) {
      requiredSpace += 2.0;
    }
    
    // 考虑日志和缓存空间
    requiredSpace += 0.5;
    
    // 安全系数：额外预留50%空间
    requiredSpace *= 1.5;
    
    return Math.max(requiredSpace, 2.0); // 最少需要2GB
  }

  /**
   * 获取磁盘使用情况命令
   * @param {string} path 路径
   * @returns {string}
   */
  getDiskUsageCommand(path) {
    if (process.platform === 'win32') {
      return `wmic logicaldisk where "DeviceID='${path.charAt(0).toUpperCase()}:'" get Size,FreeSpace`;
    } else {
      return `df -h "${path}" && du -sh "${path}"/* 2>/dev/null | sort -hr | head -10`;
    }
  }

  /**
   * 检查是否应该运行此检测器
   * @param {Object} context 检测上下文
   * @returns {boolean}
   */
  shouldRun(context) {
    const { project } = context;
    return project && project.id;
  }
}

module.exports = DiskDetector;