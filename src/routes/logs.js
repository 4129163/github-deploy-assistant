/**
 * 集中日志查看路由
 * GET /api/logs/list                — 日志文件列表
 * GET /api/logs/read/:filename      — 读取日志文件内容（支持分页/过滤）
 * GET /api/logs/project/:projectId  — 读取项目部署日志
 * GET /api/logs/stream/:filename    — SSE 实时 tail
 */

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const { logger } = require('../utils/logger');
const { ProjectDB, DeployLogDB } = require('../services/database');
const { WORK_DIR } = require('../config');

const LOG_DIR = path.join(WORK_DIR, '..', 'logs');

// 日志文件列表
router.get('/list', async (req, res) => {
  try {
    const files = [];
    if (await fs.pathExists(LOG_DIR)) {
      const entries = await fs.readdir(LOG_DIR);
      for (const f of entries) {
        if (!f.endsWith('.log') && !f.endsWith('.txt')) continue;
        const stat = await fs.stat(path.join(LOG_DIR, f));
        files.push({
          name: f,
          size: stat.size,
          size_human: formatBytes(stat.size),
          modified: stat.mtime.toISOString(),
        });
      }
      files.sort((a, b) => b.modified.localeCompare(a.modified));
    }
    res.json({ success: true, data: { files, log_dir: LOG_DIR } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 读取日志文件（支持 tail、filter、page）
router.get('/read/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // 防路径穿越
    const filePath = path.join(LOG_DIR, filename);
    if (!(await fs.pathExists(filePath))) return res.status(404).json({ error: '日志文件不存在' });

    const { tail = 200, filter = '', page = 1, pageSize = 200 } = req.query;
    const content = await fs.readFile(filePath, 'utf8');
    let lines = content.split('\n').filter(l => l.trim());

    // 关键词过滤
    if (filter) {
      const lf = filter.toLowerCase();
      lines = lines.filter(l => l.toLowerCase().includes(lf));
    }

    const total = lines.length;
    const tailNum = parseInt(tail);
    const pageNum = parseInt(page);
    const pageSizeNum = parseInt(pageSize);

    // tail 模式
    if (tailNum > 0 && !filter) {
      lines = lines.slice(-tailNum);
    } else {
      // 分页模式
      const start = (pageNum - 1) * pageSizeNum;
      lines = lines.slice(start, start + pageSizeNum);
    }

    res.json({
      success: true,
      data: {
        filename,
        lines,
        total,
        returned: lines.length,
        page: pageNum,
        has_more: total > pageNum * pageSizeNum,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 读取项目部署日志（从数据库）
router.get('/project/:projectId', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const logs = await DeployLogDB.getByProjectId(req.params.projectId);
    res.json({ success: true, data: { logs: logs.slice(0, parseInt(limit)), project_name: project.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE 实时 tail
router.get('/stream/:filename', async (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(LOG_DIR, filename);
  if (!(await fs.pathExists(filePath))) {
    res.status(404).end(); return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 先发送最后 50 行
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const last50 = content.split('\n').filter(l=>l.trim()).slice(-50);
    last50.forEach(line => res.write(`data: ${JSON.stringify(line)}\n\n`));
  } catch (_) {}

  let pos = (await fs.stat(filePath)).size;
  const interval = setInterval(async () => {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > pos) {
        const fd = await fs.open(filePath, 'r');
        const buf = Buffer.alloc(stat.size - pos);
        await fs.read(fd, buf, 0, buf.length, pos);
        await fs.close(fd);
        pos = stat.size;
        buf.toString('utf8').split('\n').filter(l=>l.trim()).forEach(line => {
          res.write(`data: ${JSON.stringify(line)}\n\n`);
        });
      }
    } catch (_) {}
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  return (b/1024/1024).toFixed(1) + ' MB';
}

module.exports = router;

// 审计日志
router.get('/audit', async (req, res) => {
  try {
    const { limit = 100, filter = '' } = req.query;
    const { readAuditLog } = require('../services/audit-log');
    const entries = await readAuditLog(parseInt(limit), filter);
    res.json({ success: true, data: { entries, total: entries.length } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
