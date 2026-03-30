/**
 * 环境指南路由
 * GET /api/envguide/list  — 所有工具列表（按分类）
 * GET /api/envguide/:id   — 单个工具详情（含完整教程）
 */
const express = require('express');
const router = express.Router();
const { ENV_TOOLS_DATA, groupByCategory } = require('../data/env-tools');

router.get('/list', (req, res) => {
  const { q, category } = req.query;
  let tools = ENV_TOOLS_DATA;
  if (category) tools = tools.filter(t => t.category === category);
  if (q) {
    const lq = q.toLowerCase();
    tools = tools.filter(t =>
      t.name.toLowerCase().includes(lq) ||
      t.desc.toLowerCase().includes(lq) ||
      t.category.toLowerCase().includes(lq)
    );
  }
  const groups = groupByCategory(tools);
  const categories = [...new Set(ENV_TOOLS_DATA.map(t => t.category))];
  res.json({ success: true, data: { tools, groups, categories, total: ENV_TOOLS_DATA.length } });
});

router.get('/:id', (req, res) => {
  const tool = ENV_TOOLS_DATA.find(t => t.id === req.params.id);
  if (!tool) return res.status(404).json({ error: '未找到该工具' });
  res.json({ success: true, data: tool });
});

module.exports = router;
