/**
 * 配置导入/导出服务
 * 支持导出所有项目配置为 JSON，并在新机器上导入恢复
 */

const path = require('path');
const fs = require('fs-extra');
const { ProjectDB } = require('./database');
const { logger } = require('../utils/logger');
const { WORK_DIR } = require('../config');

const EXPORT_VERSION = '1.0';

/**
 * 导出所有项目配置
 */
async function exportConfig() {
  const projects = await ProjectDB.getAll();

  // 每个项目附带 .env 内容（脱敏后）
  const enriched = await Promise.all(projects.map(async (p) => {
    let envVars = null;
    let hasEnvFile = false;
    if (p.local_path) {
      const envPath = path.join(p.local_path, '.env');
      const envExPath = path.join(p.local_path, '.env.example');
      hasEnvFile = await fs.pathExists(envPath);
      // 只导出 .env.example 的 key 列表（不导出实际值，保护隐私）
      if (await fs.pathExists(envExPath)) {
        try {
          const content = await fs.readFile(envExPath, 'utf8');
          envVars = content.split('\n')
            .filter(l => l.trim() && !l.startsWith('#'))
            .map(l => l.split('=')[0].trim())
            .filter(Boolean);
        } catch (_) {}
      }
    }
    return {
      id: p.id,
      name: p.name,
      repo_url: p.repo_url,
      local_path: p.local_path,
      project_type: p.project_type,
      status: p.status,
      port: p.port,
      notes: p.notes,
      tags: p.tags,
      health_url: p.health_url,
      config: p.config,
      created_at: p.created_at,
      has_env_file: hasEnvFile,
      env_keys: envVars,  // 只记录 key 名，不记录值
    };
  }));

  return {
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    machine: require('os').hostname(),
    work_dir: WORK_DIR,
    total: enriched.length,
    projects: enriched,
  };
}

/**
 * 将导出数据写入文件
 */
async function exportToFile(filePath) {
  const data = await exportConfig();
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, data, { spaces: 2 });
  return { filePath, total: data.total };
}

/**
 * 从导入数据恢复项目
 * mode: 'preview' | 'import'
 * conflict: 'skip' | 'overwrite'
 */
async function importConfig(data, mode = 'preview', conflict = 'skip') {
  if (!data.projects || !Array.isArray(data.projects)) {
    throw new Error('无效的导入数据格式');
  }

  const existing = await ProjectDB.getAll();
  const existingUrls = new Set(existing.map(p => p.repo_url));
  const existingNames = new Set(existing.map(p => p.name));

  const preview = [];
  for (const p of data.projects) {
    const urlConflict = existingUrls.has(p.repo_url);
    const nameConflict = existingNames.has(p.name);
    const status = urlConflict || nameConflict ? 'conflict' : 'new';
    preview.push({ ...p, _import_status: status, _conflict_type: urlConflict ? 'url' : nameConflict ? 'name' : null });
  }

  if (mode === 'preview') {
    return {
      preview,
      total: preview.length,
      new: preview.filter(p => p._import_status === 'new').length,
      conflicts: preview.filter(p => p._import_status === 'conflict').length,
    };
  }

  // 执行导入
  const results = [];
  for (const p of preview) {
    if (p._import_status === 'conflict' && conflict === 'skip') {
      results.push({ name: p.name, action: 'skipped', reason: '已存在' });
      continue;
    }
    try {
      if (p._import_status === 'conflict' && conflict === 'overwrite') {
        // 找到现有项目并更新
        const existing = (await ProjectDB.getAll()).find(e => e.repo_url === p.repo_url || e.name === p.name);
        if (existing) {
          await ProjectDB.update(existing.id, {
            name: p.name, repo_url: p.repo_url, local_path: p.local_path,
            project_type: p.project_type, port: p.port, notes: p.notes,
            tags: p.tags, health_url: p.health_url,
          });
          results.push({ name: p.name, action: 'overwritten' });
          continue;
        }
      }
      await ProjectDB.create({
        name: p.name,
        repo_url: p.repo_url,
        local_path: p.local_path || '',
        project_type: p.project_type || '',
        config: p.config ? JSON.stringify(p.config) : null,
      });
      // 补充字段
      const newProjects = await ProjectDB.getAll();
      const newP = newProjects.find(e => e.repo_url === p.repo_url);
      if (newP) {
        await ProjectDB.update(newP.id, {
          status: 'imported', port: p.port, notes: p.notes || '',
          tags: p.tags || '', health_url: p.health_url || '',
        });
      }
      results.push({ name: p.name, action: 'imported' });
    } catch (err) {
      results.push({ name: p.name, action: 'failed', reason: err.message });
    }
  }

  logger.info(`Import complete: ${results.filter(r=>r.action==='imported').length} imported, ${results.filter(r=>r.action==='skipped').length} skipped`);
  return { results, total: results.length };
}

/**
 * 更新环境变量 (.env)
 */
async function updateEnvConfig(projectPath, config) {
  const envPath = path.join(projectPath, '.env');
  let content = '';
  for (const [key, value] of Object.entries(config)) {
    content += `${key}=${value}\n`;
  }
  await fs.writeFile(envPath, content, 'utf8');
  return { success: true };
}

module.exports = { exportConfig, exportToFile, importConfig, updateEnvConfig };
