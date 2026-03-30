/**
 * 自然语言搜索服务
 * 1. 解析用户自然语言意图 → GitHub Search API
 * 2. AI 分析结果 → 分类/推荐/表格
 * 3. 保存到本地数据库
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const { logger } = require('../utils/logger');
const { getDb } = require('./database');
const { chat, getAvailableProviders } = require('./ai');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const githubAxios = axios.create({
  headers: {
    ...(GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}),
    Accept: 'application/vnd.github.v3+json',
  },
  timeout: 20000,
});

// ── 数据库初始化 ──────────────────────────────────────
function ensureSearchTable() {
  return new Promise((resolve, reject) => {
    getDb().run(`
      CREATE TABLE IF NOT EXISTS search_history (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        query    TEXT NOT NULL,
        keywords TEXT,
        results  TEXT,
        analysis TEXT,
        summary  TEXT,
        recommendation TEXT,
        save_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, err => err ? reject(err) : resolve());
  });
}

// ── GitHub Search ─────────────────────────────────────
async function searchGitHub(keywords, maxResults = 20) {
  const q = keywords.join(' ');
  logger.info(`[Search] GitHub query: ${q}`);
  const resp = await githubAxios.get('https://api.github.com/search/repositories', {
    params: { q, sort: 'stars', order: 'desc', per_page: Math.min(maxResults, 30) }
  });
  return (resp.data.items || []).map(r => ({
    name: r.full_name,
    url: r.html_url,
    description: r.description || '',
    language: r.language || 'Unknown',
    stars: r.stargazers_count,
    forks: r.forks_count,
    topics: (r.topics || []).join(', '),
    updated_at: r.updated_at ? r.updated_at.split('T')[0] : '',
    archived: r.archived,
    open_issues: r.open_issues_count,
  }));
}

// ── AI 分析 ───────────────────────────────────────────
async function analyzeWithAI(query, repos) {
  const available = getAvailableProviders();
  if (!available || available.length === 0) {
    // 无 AI 时降级：纯规则分类
    return ruleBasedAnalysis(query, repos);
  }

  const repoList = repos.slice(0, 20).map((r, i) =>
    `${i + 1}. ${r.name} (⭐${r.stars}) [${r.language}] — ${r.description}`
  ).join('\n');

  const prompt = `用户搜索："${query}"

以下是 GitHub 搜索结果（共${repos.length}个）：
${repoList}

请完成以下任务，用 JSON 格式回复：
1. "summary"：3-5句话总结搜索结果整体情况
2. "recommendation"：推荐最适合的1-3个项目，说明推荐理由（考虑Stars、活跃度、完整度、易用性）
3. "classified"：对每个项目按以下维度分类（返回数组，每项包含 index 字段对应编号）：
   - category_type: 核心框架/机器人 | 插件/扩展 | 工具/脚本 | 文档/示例 | 社区/整合列表 | 其他
   - tech_stack: 主要技术栈（如 Python、TypeScript、Go 等）
   - platform_support: 支持的平台（Discord/Telegram/Slack/微信/QQ/Matrix/通用/不适用）
   - activity: 活跃 | 维护中 | 停滞/归档
   - scenario: 个人助理/自动化 | 多平台消息聚合 | 游戏机器人 | DevOps集成 | AI/LLM集成 | 通用工具 | 其他
   - maturity: 生产可用 | 实验性/个人项目

只返回 JSON，不要有其他文字。`;

  try {
    const raw = await chat([{ role: 'user', content: prompt }]);
    // 提取 JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 未返回有效 JSON');
    const parsed = JSON.parse(jsonMatch[0]);
    return mergeAIResult(repos, parsed);
  } catch (e) {
    logger.warn('[Search] AI analysis failed, fallback to rule-based:', e.message);
    return ruleBasedAnalysis(query, repos);
  }
}

function mergeAIResult(repos, ai) {
  const classified = ai.classified || [];
  const enriched = repos.map((r, i) => {
    const cls = classified.find(c => c.index === i + 1) || {};
    return {
      ...r,
      category_type: cls.category_type || inferCategoryType(r),
      tech_stack: cls.tech_stack || r.language,
      platform_support: cls.platform_support || inferPlatform(r),
      activity: cls.activity || inferActivity(r),
      scenario: cls.scenario || '通用工具',
      maturity: cls.maturity || inferMaturity(r),
    };
  });
  return {
    summary: ai.summary || '',
    recommendation: ai.recommendation || '',
    repos: enriched,
  };
}

// ── 规则降级分类 ──────────────────────────────────────
function inferCategoryType(r) {
  const t = (r.topics + ' ' + r.description).toLowerCase();
  if (t.includes('awesome') || t.includes('list')) return '社区/整合列表';
  if (t.includes('plugin') || t.includes('extension') || t.includes('addon')) return '插件/扩展';
  if (t.includes('template') || t.includes('example') || t.includes('demo') || t.includes('tutorial')) return '文档/示例';
  if (t.includes('tool') || t.includes('script') || t.includes('util') || t.includes('cli')) return '工具/脚本';
  return '核心框架/机器人';
}

function inferPlatform(r) {
  const t = (r.topics + ' ' + r.description + ' ' + r.name).toLowerCase();
  const platforms = [];
  if (t.includes('discord')) platforms.push('Discord');
  if (t.includes('telegram')) platforms.push('Telegram');
  if (t.includes('slack')) platforms.push('Slack');
  if (t.includes('wechat') || t.includes('微信') || t.includes('weixin')) platforms.push('微信');
  if (t.includes('qq')) platforms.push('QQ');
  if (t.includes('matrix')) platforms.push('Matrix');
  if (t.includes('whatsapp')) platforms.push('WhatsApp');
  return platforms.length > 0 ? platforms.join('/') : '通用';
}

function inferActivity(r) {
  if (r.archived) return '停滞/归档';
  const updated = new Date(r.updated_at || 0);
  const monthsAgo = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsAgo < 3) return '活跃';
  if (monthsAgo < 12) return '维护中';
  return '停滞/归档';
}

function inferMaturity(r) {
  if (r.stars >= 1000 && !r.archived) return '生产可用';
  return '实验性/个人项目';
}

function ruleBasedAnalysis(query, repos) {
  return {
    summary: `搜索"${query}"共找到 ${repos.length} 个相关项目。按 Stars 排序，最热门项目为 ${repos[0]?.name || '未知'}。建议参考活跃度和文档完整性选择合适项目。`,
    recommendation: repos.slice(0, 3).map(r => r.name).join('、') + ' 综合评分较高，建议优先考虑。',
    repos: repos.map(r => ({
      ...r,
      category_type: inferCategoryType(r),
      tech_stack: r.language,
      platform_support: inferPlatform(r),
      activity: inferActivity(r),
      scenario: '通用工具',
      maturity: inferMaturity(r),
    })),
  };
}

// ── 主搜索入口 ────────────────────────────────────────
async function naturalSearch(query, maxResults = 20) {
  await ensureSearchTable();

  // 1. 提取关键词（简单分词：移除中文停用词，保留实质词）
  const stopWords = ['帮我', '找', '搜索', '查找', '有没有', '有哪些', '推荐', '一些', '相关', '项目', '的', '了', '吗', '啊', '呢'];
  let keywords = query.split(/[\s，,。.、]+/).filter(w => w.length > 0 && !stopWords.includes(w));
  if (keywords.length === 0) keywords = [query];

  // 2. 搜索 GitHub
  const repos = await searchGitHub(keywords, maxResults);

  // 3. AI 分析
  const analyzed = await analyzeWithAI(query, repos);

  // 4. 保存
  const saveDir = process.env.SEARCH_SAVE_DIR || path.join(__dirname, '../../search-records');
  await fs.ensureDir(saveDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const savePath = path.join(saveDir, `search_${timestamp}.md`);
  const mdContent = buildMarkdown(query, analyzed);
  await fs.writeFile(savePath, mdContent, 'utf8');

  // 5. 写入数据库
  const id = await new Promise((resolve, reject) => {
    getDb().run(
      `INSERT INTO search_history (query, keywords, results, analysis, summary, recommendation, save_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        query,
        keywords.join(', '),
        JSON.stringify(analyzed.repos),
        JSON.stringify(analyzed),
        analyzed.summary,
        analyzed.recommendation,
        savePath,
      ],
      function (err) { err ? reject(err) : resolve(this.lastID); }
    );
  });

  return { id, query, keywords, ...analyzed, save_path: savePath };
}

// ── 历史操作 ──────────────────────────────────────────
async function getHistory() {
  await ensureSearchTable();
  return new Promise((resolve, reject) => {
    getDb().all(
      'SELECT id, query, keywords, summary, recommendation, save_path, created_at FROM search_history ORDER BY created_at DESC LIMIT 100',
      (err, rows) => err ? reject(err) : resolve(rows || [])
    );
  });
}

async function getHistoryById(id) {
  await ensureSearchTable();
  return new Promise((resolve, reject) => {
    getDb().get('SELECT * FROM search_history WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      try {
        row.repos = JSON.parse(row.results || '[]');
        row.analysis = JSON.parse(row.analysis || '{}');
      } catch (_) { row.repos = []; }
      resolve(row);
    });
  });
}

async function deleteHistory(id) {
  await ensureSearchTable();
  return new Promise((resolve, reject) => {
    getDb().run('DELETE FROM search_history WHERE id = ?', [id], err => err ? reject(err) : resolve());
  });
}

// ── 导出格式 ──────────────────────────────────────────
function toCSV(record) {
  const repos = record.repos || [];
  const headers = ['项目名', 'Stars', '语言/技术栈', '描述', '项目类型', '平台支持', '活跃度', '应用场景', '成熟度', '更新日期', '地址'];
  const rows = repos.map(r => [
    r.name, r.stars, r.tech_stack || r.language, r.description,
    r.category_type, r.platform_support, r.activity, r.scenario, r.maturity,
    r.updated_at, r.url
  ].map(v => `"${String(v || '').replace(/"/g, '""')}"`));
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function toMarkdown(record) {
  return buildMarkdown(record.query, {
    summary: record.summary,
    recommendation: record.recommendation,
    repos: record.repos || [],
  });
}

function buildMarkdown(query, analyzed) {
  const { summary, recommendation, repos } = analyzed;
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  let md = `# GitHub 项目搜索报告\n\n`;
  md += `- **搜索内容：** ${query}\n`;
  md += `- **生成时间：** ${now}\n`;
  md += `- **结果数量：** ${repos.length} 个\n\n`;
  md += `## 📊 搜索分析\n\n${summary}\n\n`;
  md += `## �� 智能推荐\n\n${recommendation}\n\n`;
  md += `## 📋 项目列表\n\n`;
  md += `| # | 项目名 | ⭐ Stars | 语言 | 项目类型 | 平台 | 活跃度 | 场景 | 成熟度 | 描述 |\n`;
  md += `|---|--------|---------|------|----------|------|--------|------|--------|------|\n`;
  repos.forEach((r, i) => {
    md += `| ${i + 1} | [${r.name}](${r.url}) | ${r.stars} | ${r.tech_stack || r.language} | ${r.category_type} | ${r.platform_support} | ${r.activity} | ${r.scenario} | ${r.maturity} | ${r.description.slice(0, 60)} |\n`;
  });
  return md;
}

module.exports = { naturalSearch, getHistory, getHistoryById, deleteHistory, toCSV, toMarkdown, buildMarkdown };
