/**
 * 部署模板路由
 * GET  /api/templates/list          — 所有模板（按分类）
 * GET  /api/templates/:id           — 单个模板详情
 * POST /api/templates/:id/deploy    — 用模板部署项目
 * POST /api/templates/export        — 将某次成功部署导出为模板
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { TEMPLATES, groupTemplatesByCategory } = require('../data/deploy-templates');
const { ProjectDB } = require('../services/database');
const { logger } = require('../utils/logger');
const { WORK_DIR } = require('../config');

// 自定义模板文件路径（用户导出的模板持久化存储）
const CUSTOM_TEMPLATES_PATH = path.join(WORK_DIR, '.templates', 'custom.json');

async function loadCustomTemplates() {
  try {
    if (await fs.pathExists(CUSTOM_TEMPLATES_PATH)) {
      return await fs.readJson(CUSTOM_TEMPLATES_PATH);
    }
  } catch (_) {}
  return [];
}

async function saveCustomTemplates(templates) {
  await fs.ensureDir(path.dirname(CUSTOM_TEMPLATES_PATH));
  await fs.writeJson(CUSTOM_TEMPLATES_PATH, templates, { spaces: 2 });
}

// 列出所有模板（官方+自定义）
router.get('/list', async (req, res) => {
  try {
    const { q, category } = req.query;
    const custom = await loadCustomTemplates();
    let all = [
      ...TEMPLATES.map(t => ({ ...t, source: 'official' })),
      ...custom.map(t => ({ ...t, source: 'custom' })),
    ];
    if (category) all = all.filter(t => t.category === category);
    if (q) {
      const lq = q.toLowerCase();
      all = all.filter(t =>
        t.name.toLowerCase().includes(lq) ||
        t.desc.toLowerCase().includes(lq) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(lq))
      );
    }
    const groups = groupTemplatesByCategory(all);
    const categories = [...new Set(all.map(t => t.category))];
    res.json({ success: true, data: { templates: all, groups, categories, total: all.length } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个模板
router.get('/:id', async (req, res) => {
  try {
    const custom = await loadCustomTemplates();
    const all = [...TEMPLATES, ...custom];
    const tpl = all.find(t => t.id === req.params.id);
    if (!tpl) return res.status(404).json({ error: '模板不存在' });
    res.json({ success: true, data: tpl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 用模板触发部署
router.post('/:id/deploy', async (req, res) => {
  try {
    const custom = await loadCustomTemplates();
    const all = [...TEMPLATES, ...custom];
    const tpl = all.find(t => t.id === req.params.id);
    if (!tpl) return res.status(404).json({ error: '模板不存在' });

    // 先调用 /repo/analyze 接口（内部 require 避免循环依赖）
    const repoModule = require('./repo');
    // 直接返回模板配置给前端，由前端跳转到部署流程
    res.json({
      success: true,
      data: {
        template: tpl,
        redirect: { url: tpl.repo_url, type: 'template_deploy' },
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 将成功部署的项目导出为模板
router.post('/export', async (req, res) => {
  try {
    const { projectId, templateName, desc, category = '我的模板' } = req.body;
    if (!projectId || !templateName) return res.status(400).json({ error: '缺少 projectId 或 templateName' });

    const project = await ProjectDB.getById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!['deployed', 'running'].includes(project.status)) {
      return res.status(400).json({ error: '只能导出已成功部署的项目' });
    }

    const custom = await loadCustomTemplates();

    // 从 package.json / requirements.txt 提取 start_cmd
    let start_cmd = 'npm start';
    let setup_steps = [];
    const local_path = project.local_path;
    if (local_path && await fs.pathExists(local_path)) {
      try {
        const pkg = await fs.readJson(path.join(local_path, 'package.json'));
        if (pkg.scripts?.start) start_cmd = 'npm start';
        setup_steps = [{ cmd: 'npm install --ignore-scripts', desc: '安装依赖' }];
      } catch (_) {}
      if (project.project_type?.includes('python')) {
        start_cmd = 'python3 main.py';
        setup_steps = [{ cmd: 'pip3 install -r requirements.txt', desc: '安装依赖' }];
      }
    }

    const newTemplate = {
      id: `custom-${Date.now()}`,
      name: templateName,
      category,
      icon: '📦',
      desc: desc || `从项目「${project.name}」导出的部署模板`,
      stars: '',
      repo_url: project.repo_url,
      project_type: project.project_type,
      verified: false,
      setup_steps,
      start_cmd,
      env_vars: [],
      port: project.port || 3000,
      tags: (project.tags || '').split(',').filter(Boolean),
      source: 'custom',
      exported_from: project.name,
      exported_at: new Date().toISOString(),
    };

    custom.push(newTemplate);
    await saveCustomTemplates(custom);
    logger.info(`Template exported: ${templateName} from project ${project.name}`);
    res.json({ success: true, data: newTemplate, message: `模板「${templateName}」已保存` });
  } catch (err) {
    logger.error('Export template error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 删除自定义模板
router.delete('/custom/:id', async (req, res) => {
  try {
    const custom = await loadCustomTemplates();
    const filtered = custom.filter(t => t.id !== req.params.id);
    if (filtered.length === custom.length) return res.status(404).json({ error: '模板不存在' });
    await saveCustomTemplates(filtered);
    res.json({ success: true, message: '模板已删除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
