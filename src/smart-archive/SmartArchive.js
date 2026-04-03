const fs = require('fs-extra');
const path = require('path');
const { execPromise } = require('../utils/exec-promise');
const os = require('os');

class SmartArchive {
  constructor() {
    // 存档存储目录
    this.archiveDir = process.env.ARCHIVE_DIR || path.join(os.homedir(), '.gada', 'archives');
    fs.mkdirpSync(this.archiveDir);
    // 最多保留3份存档
    this.maxArchives = 3;
    // 自动存档触发次数（默认打开关闭3次触发）
    this.autoArchiveTriggerCount = 3;
  }

  /**
   * 项目使用次数+1，达到阈值自动触发存档
   * @param {Object} project 项目信息
   * @returns {Promise<boolean>} 是否触发了自动存档
   */
  async onProjectUse(project) {
    // 更新使用次数
    const useCountKey = `use_count_${project.id}`;
    let useCount = parseInt(await this.getConfig(useCountKey, '0')) + 1;
    await this.setConfig(useCountKey, useCount.toString());

    // 达到触发次数，自动存档
    if (useCount >= this.autoArchiveTriggerCount) {
      await this.createArchive(project, 'auto');
      // 重置计数
      await this.setConfig(useCountKey, '0');
      return true;
    }
    return false;
  }

  /**
   * 创建存档
   * @param {Object} project 项目信息
   * @param {string} type 存档类型：auto/manual
   * @returns {Promise<Object>} 存档信息
   */
  async createArchive(project, type = 'manual') {
    const projectDir = project.local_path;
    if (!await fs.pathExists(projectDir)) {
      throw new Error('项目路径不存在');
    }

    // 生成存档文件名：项目名_时间_类型.zip
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `${project.name}_${timestamp}_${type}.zip`;
    const archivePath = path.join(this.archiveDir, archiveName);

    // 1. 先导出项目的数据库记录
    const projectDBData = await this.exportProjectDBData(project);
    const dbBackupPath = path.join(projectDir, '.gada_backup.json');
    await fs.writeJSON(dbBackupPath, projectDBData);

    // 2. 压缩整个项目目录
    const spinner = require('ora')('正在创建存档...').start();
    try {
      // 压缩时排除node_modules、.git等大文件
      if (process.platform === 'win32') {
        await execPromise(`powershell Compress-Archive -Path "${projectDir}\\*" -DestinationPath "${archivePath}" -Force -ExcludePath "node_modules", ".git", "dist", "build"`);
      } else {
        await execPromise(`cd "${projectDir}" && zip -r "${archivePath}" . -x "node_modules/*" ".git/*" "dist/*" "build/*" "venv/*" "env/*"`);
      }
      spinner.succeed('存档创建成功');
    } catch (e) {
      spinner.fail('存档创建失败: ' + e.message);
      await fs.remove(dbBackupPath);
      throw e;
    }

    // 清理临时备份文件
    await fs.remove(dbBackupPath);

    // 3. 保存存档信息
    const archiveInfo = {
      id: Date.now().toString(),
      projectId: project.id,
      projectName: project.name,
      type,
      name: archiveName,
      path: archivePath,
      size: (await fs.stat(archivePath)).size,
      createTime: new Date().toISOString(),
      description: type === 'auto' ? '自动存档' : '手动存档'
    };

    await this.saveArchiveInfo(archiveInfo);
    // 4. 清理旧存档，只保留规则要求的数量
    await this.cleanupOldArchives(project.id);

    return archiveInfo;
  }

  /**
   * 恢复到指定存档
   * @param {string} archiveId 存档ID
   * @param {Object} project 项目信息
   * @returns {Promise<boolean>} 是否恢复成功
   */
  async restoreArchive(archiveId, project) {
    // 1. 先导出当前数据到桌面
    const exportPath = await this.exportUserData(project);
    console.log(`当前数据已导出到桌面: ${exportPath}`);

    // 2. 获取存档信息
    const archives = await this.getProjectArchives(project.id);
    const archive = archives.find(a => a.id === archiveId);
    if (!archive) {
      throw new Error('存档不存在');
    }

    const spinner = require('ora')('正在恢复存档...').start();
    try {
      // 3. 清空现有项目目录（保留用户数据先导出了）
      const projectDir = project.local_path;
      await fs.remove(projectDir);
      await fs.mkdirp(projectDir);

      // 4. 解压存档到项目目录
      if (process.platform === 'win32') {
        await execPromise(`powershell Expand-Archive -Path "${archive.path}" -DestinationPath "${projectDir}" -Force`);
      } else {
        await execPromise(`unzip -o "${archive.path}" -d "${projectDir}"`);
      }

      // 5. 恢复数据库记录
      const dbBackupPath = path.join(projectDir, '.gada_backup.json');
      if (await fs.pathExists(dbBackupPath)) {
        const dbData = await fs.readJSON(dbBackupPath);
        await this.restoreProjectDBData(dbData);
        await fs.remove(dbBackupPath);
      }

      // 6. 自动导入导出的用户数据
      await this.importUserData(project, exportPath);

      spinner.succeed('存档恢复成功！');
      return true;
    } catch (e) {
      spinner.fail('存档恢复失败: ' + e.message);
      return false;
    }
  }

  /**
   * 导出用户数据到桌面
   * @param {Object} project 项目信息
   * @returns {Promise<string>} 导出文件路径
   */
  async exportUserData(project) {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const exportFileName = `GADA_${project.name}_数据备份_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const exportPath = path.join(desktopPath, exportFileName);

    const data = {
      exportTime: new Date().toISOString(),
      project: project,
      deployRecords: await this.getProjectDeployRecords(project.id),
      config: await this.getAllProjectConfig(project.id),
      doctorRecords: await this.getDoctorRecords(project.id),
      analyzeRecords: await this.getAnalyzeRecords(project.id)
    };

    await fs.writeJSON(exportPath, data, { spaces: 2 });
    return exportPath;
  }

  /**
   * 导入用户数据
   * @param {Object} project 项目信息
   * @param {string} importPath 导入文件路径
   * @returns {Promise<Object>} 导入结果
   */
  async importUserData(project, importPath) {
    if (!await fs.pathExists(importPath)) {
      return { success: false, message: '导入文件不存在' };
    }

    try {
      const importData = await fs.readJSON(importPath);
      const result = {
        added: 0,
        updated: 0,
        skipped: 0,
        conflicts: []
      };

      // 合并部署记录
      const existingRecords = await this.getProjectDeployRecords(project.id);
      const existingIds = new Set(existingRecords.map(r => r.id));
      
      for (const record of importData.deployRecords || []) {
        if (!existingIds.has(record.id)) {
          await this.addDeployRecord(record);
          result.added++;
        } else {
          // 检查是否有差异
          const existing = existingRecords.find(r => r.id === record.id);
          if (JSON.stringify(existing) !== JSON.stringify(record)) {
            result.conflicts.push({
              type: 'deploy_record',
              id: record.id,
              existing: existing,
              imported: record
            });
          } else {
            result.skipped++;
          }
        }
      }

      // 合并配置
      const existingConfig = await this.getAllProjectConfig(project.id);
      for (const [key, value] of Object.entries(importData.config || {})) {
        if (!existingConfig[key]) {
          await this.setConfig(key, value);
          result.added++;
        } else if (existingConfig[key] !== value) {
          result.conflicts.push({
            type: 'config',
            key,
            existingValue: existingConfig[key],
            importedValue: value
          });
        } else {
          result.skipped++;
        }
      }

      return {
        success: true,
        ...result,
        message: `导入完成：新增${result.added}项，跳过${result.skipped}项，存在${result.conflicts.length}个冲突需要处理`
      };
    } catch (e) {
      return { success: false, message: '导入失败: ' + e.message };
    }
  }

  /**
   * 获取项目的所有存档
   * @param {number} projectId 项目ID
   * @returns {Promise<Array>} 存档列表
   */
  async getProjectArchives(projectId) {
    const archivesPath = path.join(this.archiveDir, `archives_${projectId}.json`);
    if (!await fs.pathExists(archivesPath)) {
      return [];
    }
    const archives = await fs.readJSON(archivesPath);
    // 按创建时间倒序排列
    return archives.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
  }

  /**
   * 清理旧存档，保留规则：第一份永久保留 + 最近2份 = 总共3份
   * @param {number} projectId 项目ID
   */
  async cleanupOldArchives(projectId) {
    let archives = await this.getProjectArchives(projectId);
    if (archives.length <= this.maxArchives) {
      return;
    }

    // 第一份存档永远保留，剩下的只保留最新的2份
    const firstArchive = archives[archives.length - 1]; // 最旧的是第一份
    const recentArchives = archives.slice(0, this.maxArchives - 1); // 最新的2份
    const archivesToKeep = [firstArchive, ...recentArchives].map(a => a.id);

    // 删除不在保留列表里的存档
    for (const archive of archives) {
      if (!archivesToKeep.includes(archive.id)) {
        await fs.remove(archive.path);
      }
    }

    // 更新存档列表
    archives = archives.filter(a => archivesToKeep.includes(a.id));
    const archivesPath = path.join(this.archiveDir, `archives_${projectId}.json`);
    await fs.writeJSON(archivesPath, archives, { spaces: 2 });
  }

  // 辅助方法：保存存档信息
  async saveArchiveInfo(archiveInfo) {
    const archivesPath = path.join(this.archiveDir, `archives_${archiveInfo.projectId}.json`);
    let archives = [];
    if (await fs.pathExists(archivesPath)) {
      archives = await fs.readJSON(archivesPath);
    }
    archives.push(archiveInfo);
    await fs.writeJSON(archivesPath, archives, { spaces: 2 });
  }

  // 辅助方法：导出项目数据库数据
  async exportProjectDBData(project) {
    const { ProjectDB } = require('../services/database');
    return {
      project,
      deployRecords: await this.getProjectDeployRecords(project.id),
      config: await this.getAllProjectConfig(project.id),
      doctorRecords: await this.getDoctorRecords(project.id),
      analyzeRecords: await this.getAnalyzeRecords(project.id)
    };
  }

  // 辅助方法：恢复项目数据库数据
  async restoreProjectDBData(dbData) {
    const { ProjectDB } = require('../services/database');
    // 恢复项目基础信息
    await ProjectDB.update(dbData.project.id, dbData.project);
    // 其他表恢复逻辑...
  }

  // 数据库操作辅助方法
  async getProjectDeployRecords(projectId) {
    // 这里实现获取部署记录的逻辑
    return [];
  }

  async getAllProjectConfig(projectId) {
    // 这里实现获取项目所有配置的逻辑
    return {};
  }

  async getDoctorRecords(projectId) {
    // 这里实现获取项目医生诊断记录的逻辑
    return [];
  }

  async getAnalyzeRecords(projectId) {
    // 这里实现获取仓库解析记录的逻辑
    return [];
  }

  async addDeployRecord(record) {
    // 这里实现添加部署记录的逻辑
  }

  async getConfig(key, defaultValue = null) {
    // 这里实现获取配置的逻辑
    return defaultValue;
  }

  async setConfig(key, value) {
    // 这里实现设置配置的逻辑
  }
}

module.exports = SmartArchive;
