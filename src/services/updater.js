/**
 * 版本更新与回滚服务
 * 功能：
 * 1. 检测托管项目 & 自身是否有新版本（GitHub Releases / commits）
 * 2. 执行更新（git pull / npm install）
 * 3. 保存版本快照，支持回滚到任意历史版本
 * 4. 对 GADA 自身同样适用
 */

const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { logger } = require('./utils/logger');
const { getDb } = require('./services/database');
const { WORK_DIR } = require('./config');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const githubAxios = axios.create({
  headers: {
    ...(GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}),
    Accept: 'application/vnd.github.v3+json',
  },
  timeout: 30000,
});

// ============================================================
// 数据库：版本历史表（project_versions）
// ============================================================

/**
 * 初始化版本历史表（在 database.js initDatabase 之后调用一次即可）
 */
function initVersionTable() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      `CREATE TABLE IF NOT EXISTS project_versions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  INTEGER NOT NULL,   -- 0 表示 GADA 自身
        commit_sha  TEXT    NOT NULL,
        tag         TEXT,
        snapshot_path TEXT,            -- zip 快照路径（可选）
        note        TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => (err ? reject(err) : resolve())
    );
  });
}

// ============================================================
// 工具函数
// ============================================================

/** 解析 GitHub 仓库 URL，返回 { owner, repo } */
function parseGitHubUrl(url) {
  const m = url && url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

/** 获取远端最新 commit SHA */
async function getRemoteLatestCommit(owner, repo, branch = 'main') {
  try {
    const res = await githubAxios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`
    );
    return res.data.sha;
  } catch (e) {
    // 尝试 master 分支
    if (branch === 'main') return getRemoteLatestCommit(owner, repo, 'master');
    throw e;
  }
}

/** 获取本地仓库当前 HEAD commit SHA */
async function getLocalCommit(localPath) {
  const git = simpleGit(localPath);
  const log = await git.log({ maxCount: 1 });
  return log.latest ? log.latest.hash : null;
}

/** 获取远端 releases 列表 */
async function getReleases(owner, repo, perPage = 20) {
  try {
    const res = await githubAxios.get(
      `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${perPage}`
    );
    return res.data.map((r) => ({
      tag: r.tag_name,
      name: r.name,
      published: r.published_at,
      body: r.body,
      commitSha: r.target_commitish,
    }));
  } catch {
    return [];
  }
}

/** 获取最近 N 条 commits */
async function getCommitHistory(owner, repo, perPage = 20) {
  const res = await githubAxios.get(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}`
  );
  return res.data.map((c) => ({
    sha: c.sha,
    shortSha: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0],
    author: c.commit.author.name,
    date: c.commit.author.date,
  }));
}

// ============================================================
// 核心功能
// ============================================================

/**
 * 检测某个项目是否有可用更新
 * @param {object} project - ProjectDB 记录，包含 repo_url, local_path
 * @returns {{ hasUpdate, localSha, remoteSha, remoteCommits }}
 */
async function checkProjectUpdate(project) {
  const parsed = parseGitHubUrl(project.repo_url);
  if (!parsed) throw new Error('无法解析仓库地址');

  const remoteSha = await getRemoteLatestCommit(parsed.owner, parsed.repo);
  let localSha = null;
  if (project.local_path && (await fs.pathExists(project.local_path))) {
    localSha = await getLocalCommit(project.local_path);
  }

  const hasUpdate = remoteSha && localSha && remoteSha !== localSha;
  const remoteCommits = hasUpdate
    ? await getCommitHistory(parsed.owner, parsed.repo, 10)
    : [];

  return { hasUpdate, localSha, remoteSha, remoteCommits };
}

/**
 * 检测 GADA 自身是否有更新
 * @returns {{ hasUpdate, localSha, remoteSha, remoteCommits }}
 */
async function checkSelfUpdate() {
  const selfPath = path.join(__dirname, '..');
  const repoUrl = 'https://github.com/4129163/github-deploy-assistant';
  return checkProjectUpdate({ repo_url: repoUrl, local_path: selfPath });
}

/**
 * 保存当前版本快照到 DB
 */
async function saveVersionSnapshot(projectId, localPath, note = '') {
  let sha = null;
  try {
    sha = await getLocalCommit(localPath);
  } catch {}

  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      'INSERT INTO project_versions (project_id, commit_sha, note) VALUES (?, ?, ?)',
      [projectId, sha || 'unknown', note],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, sha });
      }
    );
  });
}

/**
 * 执行更新：git pull + npm install（如有 package.json）
 * 更新前自动保存快照
 * @param {object} project
 * @returns {{ success, output }}
 */
async function performUpdate(project, projectId) {
  const localPath = project.local_path;
  if (!localPath || !(await fs.pathExists(localPath))) {
    throw new Error('本地项目路径不存在，请先部署项目');
  }

  // 更新前保存快照
  await saveVersionSnapshot(projectId, localPath, '更新前自动快照');

  const git = simpleGit(localPath);
  const pullResult = await git.pull();
  let output = `git pull 完成：${pullResult.summary.changes} 个文件变更`;

  // 如有 package.json 则重新安装依赖
  const pkgPath = path.join(localPath, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const { execPromise } = require('./utils/exec-promise');
    const installOut = await execPromise('npm install', localPath);
    output += `\nnpm install:\n${installOut}`;
  }

  // 保存更新后快照
  await saveVersionSnapshot(projectId, localPath, '更新后快照');

  return { success: true, output };
}

/**
 * 获取项目的版本历史
 */
function getVersionHistory(projectId) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      'SELECT * FROM project_versions WHERE project_id = ? ORDER BY created_at DESC',
      [projectId],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });
}

/**
 * 回滚到指定 commit SHA
 * @param {object} project
 * @param {string} targetSha - 目标 commit sha
 * @param {number} projectId
 */
async function rollbackToVersion(project, targetSha, projectId) {
  const localPath = project.local_path;
  if (!localPath || !(await fs.pathExists(localPath))) {
    throw new Error('本地项目路径不存在');
  }

  // 回滚前保存当前版本
  await saveVersionSnapshot(projectId, localPath, '回滚前自动快照');

  const git = simpleGit(localPath);

  // fetch 确保有完整历史
  await git.fetch();
  await git.checkout(targetSha);

  // 如有 package.json 则重新安装依赖
  const pkgPath = path.join(localPath, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const { execPromise } = require('./utils/exec-promise');
    await execPromise('npm install', localPath);
  }

  await saveVersionSnapshot(projectId, localPath, `回滚至 ${targetSha.slice(0, 7)}`);

  return { success: true, rolledBackTo: targetSha };
}

module.exports = {
  initVersionTable,
  checkProjectUpdate,
  checkSelfUpdate,
  performUpdate,
  getVersionHistory,
  rollbackToVersion,
  getCommitHistory,
  getReleases,
  saveVersionSnapshot,
};
