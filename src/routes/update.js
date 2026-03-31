/**
 * 版本更新 & 回滚 API 路由
 * 挂载路径：/api/update
 *
 * GET  /api/update/check/:projectId   检测项目是否有更新（projectId=0 表示 GADA 自身）
 * GET  /api/update/history/:projectId  获取版本历史列表
 * POST /api/update/perform/:projectId  执行更新
 * POST /api/update/rollback/:projectId 回滚到指定版本
 * GET  /api/update/commits/:projectId  获取远端最近 commits（供用户选择回滚目标）
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { ProjectDB } = require('../services/database');
const {
  checkProjectUpdate,
  checkSelfUpdate,
  performUpdate,
  getVersionHistory,
  rollbackToVersion,
  getCommitHistory,
  getReleases,
  initVersionTable,
} = require('../services/updater');

// 确保版本表存在
initVersionTable().catch(() => {});

/** 获取 project 辅助（0 = GADA 自身） */
async function resolveProject(projectId) {
  if (String(projectId) === '0') {
    return {
      id: 0,
      name: 'GitHub Deploy Assistant (GADA)',
      repo_url: 'https://github.com/4129163/github-deploy-assistant',
      local_path: path.join(__dirname, '../..'),
    };
  }
  const p = await ProjectDB.getById(Number(projectId));
  if (!p) throw new Error('项目不存在');
  return p;
}

// GET /api/update/check/:projectId
router.get('/check/:projectId', async (req, res) => {
  try {
    const project = await resolveProject(req.params.projectId);
    const result =
      String(req.params.projectId) === '0'
        ? await checkSelfUpdate()
        : await checkProjectUpdate(project);
    res.json({ success: true, project: { id: project.id, name: project.name }, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/update/history/:projectId
router.get('/history/:projectId', async (req, res) => {
  try {
    const history = await getVersionHistory(Number(req.params.projectId));
    res.json({ success: true, history });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/update/perform/:projectId
router.post('/perform/:projectId', async (req, res) => {
  try {
    const project = await resolveProject(req.params.projectId);
    const result = await performUpdate(project, project.id);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/update/rollback/:projectId  body: { sha }
router.post('/rollback/:projectId', async (req, res) => {
  try {
    const { sha } = req.body;
    if (!sha) return res.status(400).json({ success: false, error: '缺少 sha 参数' });
    const project = await resolveProject(req.params.projectId);
    const result = await rollbackToVersion(project, sha, project.id);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/update/commits/:projectId  查询远端 commit 历史（用于选择回滚版本）
router.get('/commits/:projectId', async (req, res) => {
  try {
    const project = await resolveProject(req.params.projectId);
    const parsed = require('../services/github').parseGitHubUrl
      ? require('../services/github').parseGitHubUrl(project.repo_url)
      : (() => {
          const m = project.repo_url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
          return m ? { owner: m[1], repo: m[2] } : null;
        })();
    if (!parsed) return res.status(400).json({ success: false, error: '无法解析仓库地址' });
    const perPage = Math.min(parseInt(req.query.perPage) || 20, 50);
    const [commits, releases] = await Promise.all([
      getCommitHistory(parsed.owner, parsed.repo, perPage),
      getReleases(parsed.owner, parsed.repo, 10),
    ]);
    res.json({ success: true, commits, releases });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
