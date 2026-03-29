/**
 * 本地项目扫描路由
 * 扫描 workspace 目录，发现所有本地项目（包括未被 GADA 记录的）
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');
const { WORK_DIR } = require('../config');

/**
 * 识别目录是什么类型的项目
 */
async function detectProjectType(dirPath) {
  const types = [];
  const checks = [
    { file: 'package.json', type: 'nodejs' },
    { file: 'requirements.txt', type: 'python' },
    { file: 'setup.py', type: 'python' },
    { file: 'pyproject.toml', type: 'python' },
    { file: 'Dockerfile', type: 'docker' },
    { file: 'docker-compose.yml', type: 'docker' },
    { file: 'go.mod', type: 'go' },
    { file: 'Cargo.toml', type: 'rust' },
    { file: 'pom.xml', type: 'java' },
    { file: 'build.gradle', type: 'java' },
    { file: 'index.html', type: 'static' },
  ];
  for (const { file, type } of checks) {
    if (await fs.pathExists(path.join(dirPath, file))) {
      if (!types.includes(type)) types.push(type);
    }
  }
  return types;
}

/**
 * 获取目录大小（快速估算，只扫描一层）
 */
async function getQuickSize(dirPath) {
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'venv' || entry.name === '.git') {
        // 这些目录单独标记，不递归
        try {
          const st = await fs.stat(path.join(dirPath, entry.name));
          size += 0; // 不计入，单独展示
        } catch (_) {}
        continue;
      }
      try {
        const st = await fs.stat(path.join(dirPath, entry.name));
        size += st.size;
      } catch (_) {}
    }
  } catch (_) {}
  return size;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

/**
 * 扫描 workspace 目录
 * GET /api/scan
 */
router.get('/', async (req, res) => {
  try {
    await fs.ensureDir(WORK_DIR);
    const entries = await fs.readdir(WORK_DIR, { withFileTypes: true });

    // 获取数据库中已记录的项目（按本地路径索引）
    const dbProjects = await ProjectDB.getAll();
    const dbByPath = {};
    const dbByName = {};
    dbProjects.forEach(p => {
      if (p.local_path) dbByPath[p.local_path] = p;
      dbByName[p.name] = p;
    });

    const found = [];

    for (const entry of entries) {
      // 跳过 .backups 和其他隐藏目录
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const dirPath = path.join(WORK_DIR, entry.name);
      const types = await detectProjectType(dirPath);

      // 检查是否有 .git
      const hasGit = await fs.pathExists(path.join(dirPath, '.git'));

      // 尝试读取 package.json 获取更多信息
      let pkgName = null, pkgVersion = null, pkgDesc = null;
      try {
        const pkg = await fs.readJson(path.join(dirPath, 'package.json'));
        pkgName = pkg.name;
        pkgVersion = pkg.version;
        pkgDesc = pkg.description;
      } catch (_) {}

      // 检查是否在数据库中
      const dbRecord = dbByPath[dirPath] || dbByName[entry.name];

      // 检查特殊子目录
      const hasNodeModules = await fs.pathExists(path.join(dirPath, 'node_modules'));
      const hasVenv = await fs.pathExists(path.join(dirPath, 'venv'));

      found.push({
        name: entry.name,
        path: dirPath,
        types,
        hasGit,
        hasNodeModules,
        hasVenv,
        pkgName,
        pkgVersion,
        pkgDesc,
        inDatabase: !!dbRecord,
        dbId: dbRecord?.id || null,
        dbStatus: dbRecord?.status || null,
        repoUrl: dbRecord?.repo_url || null,
      });
    }

    res.json({
      success: true,
      data: {
        total: found.length,
        inDatabase: found.filter(f => f.inDatabase).length,
        notInDatabase: found.filter(f => !f.inDatabase).length,
        projects: found
      }
    });
  } catch (error) {
    logger.error('Scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 将未记录的目录导入 GADA 数据库
 * POST /api/scan/import
 * body: { name, path, types, repoUrl? }
 */
router.post('/import', async (req, res) => {
  try {
    const { name, dirPath, types, repoUrl } = req.body;
    if (!name || !dirPath) return res.status(400).json({ error: '缺少 name 或 dirPath' });
    if (!await fs.pathExists(dirPath)) return res.status(400).json({ error: '目录不存在' });

    const project = await ProjectDB.create({
      name,
      repo_url: repoUrl || '',
      local_path: dirPath,
      status: 'cloned',
      project_type: Array.isArray(types) ? types.join(',') : (types || ''),
      config: {}
    });

    res.json({ success: true, data: project, message: `"${name}" 已导入 GADA` });
  } catch (error) {
    logger.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

/**
 * 直接删除未管理的目录
 * DELETE /api/scan/remove
 * body: { dirPath }
 */
router.delete('/remove', async (req, res) => {
  try {
    const { dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ error: '缺少 dirPath' });

    // 安全检查：只允许删除 workspace 内的目录
    const resolved = path.resolve(dirPath);
    const workspaceResolved = path.resolve(WORK_DIR);
    if (!resolved.startsWith(workspaceResolved) || resolved === workspaceResolved) {
      return res.status(403).json({ error: '只允许删除 workspace 内的目录' });
    }

    if (!await fs.pathExists(resolved)) {
      return res.status(404).json({ error: '目录不存在' });
    }

    await fs.remove(resolved);
    logger.info(`Force removed directory: ${resolved}`);
    res.json({ success: true, message: `已删除: ${path.basename(resolved)}` });
  } catch (error) {
    logger.error('Force remove error:', error);
    res.status(500).json({ error: error.message });
  }
});
