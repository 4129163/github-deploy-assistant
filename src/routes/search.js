/**
 * GitHub 自然语言搜索路由
 * POST /api/search/query     — 自然语言搜索 + AI 分析
 * GET  /api/search/history   — 获取搜索历史
 * GET  /api/search/history/:id — 获取单条记录详情
 * DELETE /api/search/history/:id — 删除记录
 * GET  /api/search/export/:id?fmt=csv|md — 导出
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const searchService = require('../services/search');

// 自然语言搜索
router.post('/query', async (req, res) => {
  try {
    const { query, maxResults = 20 } = req.body;
    if (!query || !query.trim()) return res.status(400).json({ error: '请输入搜索内容' });
    const result = await searchService.naturalSearch(query.trim(), maxResults);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 获取历史列表
router.get('/history', async (req, res) => {
  try {
    const list = await searchService.getHistory();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单条详情
router.get('/history/:id', async (req, res) => {
  try {
    const record = await searchService.getHistoryById(req.params.id);
    if (!record) return res.status(404).json({ error: '记录不存在' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除记录
router.delete('/history/:id', async (req, res) => {
  try {
    await searchService.deleteHistory(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 导出
router.get('/export/:id', async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const record = await searchService.getHistoryById(req.params.id);
    if (!record) return res.status(404).json({ error: '记录不存在' });
    if (fmt === 'csv') {
      const csv = searchService.toCSV(record);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="search_${req.params.id}.csv"`);
      res.send('\uFEFF' + csv); // BOM for Excel
    } else {
      const md = searchService.toMarkdown(record);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="search_${req.params.id}.md"`);
      res.send(md);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
