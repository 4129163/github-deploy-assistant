/**
 * 网络连通性 + AI Key 检测服务
 */

const http = require('http');
const https = require('https');
const { logger } = require('../utils/logger');

const TIMEOUT = 8000;

function checkUrl(url, timeout = TIMEOUT) {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      const latency = Date.now() - start;
      resolve({ ok: true, status: res.statusCode, latency });
      res.resume();
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout', latency: timeout }); });
    req.on('error', (err) => resolve({ ok: false, error: err.message, latency: Date.now() - start }));
  });
}

async function checkGitHubNetwork() {
  const result = {
    github_reachable: false,
    latency_ms: 0,
    quality: 'unknown', // smooth, unstable, unreachable
    proxy_recommended: false,
    mirror_recommended: false
  };

  try {
    const check = await checkUrl('https://github.com');
    
    if (check.ok) {
      result.github_reachable = true;
      result.latency_ms = check.latency;
      
      if (result.latency_ms < 500) {
        result.quality = 'smooth';
      } else {
        result.quality = 'unstable';
        result.mirror_recommended = true;
      }
    } else {
      result.quality = 'unreachable';
      result.proxy_recommended = true;
      result.mirror_recommended = true;
    }
  } catch (e) {
    result.quality = 'unreachable';
  }

  return result;
}

async function checkNetworkConnectivity() {
  const checks = [
    { name: 'GitHub', url: 'https://github.com', critical: true },
    { name: 'GitHub API', url: 'https://api.github.com', critical: true },
    { name: 'npm Registry', url: 'https://registry.npmjs.org', critical: false },
    { name: 'PyPI', url: 'https://pypi.org', critical: false },
    { name: 'Docker Hub', url: 'https://hub.docker.com', critical: false },
    { name: '国内镜像 npmmirror', url: 'https://registry.npmmirror.com', critical: false },
  ];
  const results = await Promise.all(checks.map(async (c) => {
    const r = await checkUrl(c.url);
    return { ...c, ...r };
  }));
  const criticalFailed = results.filter(r => r.critical && !r.ok);
  const suggestions = [];
  const gh = results.find(r => r.name === 'GitHub');
  const npm = results.find(r => r.name === 'npm Registry');
  const mirror = results.find(r => r.name === '国内镜像 npmmirror');
  if (gh && !gh.ok) suggestions.push('⚠️ GitHub 无法访问，克隆仓库会失败。建议检查网络或配置代理（如 ghproxy.com）');
  if (npm && !npm.ok && mirror && mirror.ok) suggestions.push('💡 npm Registry 不可达，但国内镜像可用。建议：npm config set registry https://registry.npmmirror.com');
  if (gh && gh.ok && gh.latency > 3000) suggestions.push(`⚡ GitHub 延迟较高 (${gh.latency}ms)，建议配置加速代理`);
  return {
    results,
    all_ok: results.every(r => r.ok),
    critical_ok: criticalFailed.length === 0,
    critical_failed: criticalFailed.map(r => r.name),
    suggestions,
  };
}

async function checkAIKey(baseURL, apiKey) {
  if (!apiKey) return { ok: false, error: 'API Key 未配置' };
  const start = Date.now();
  return new Promise((resolve) => {
    const modelsUrl = (baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/models';
    let url;
    try { url = new URL(modelsUrl); } catch (_) {
      return resolve({ ok: false, error: '无效的 Base URL' });
    }
    const mod = modelsUrl.startsWith('https') ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: TIMEOUT,
    };
    const req = mod.request(options, (res) => {
      const latency = Date.now() - start;
      res.resume();
      if (res.statusCode === 200 || res.statusCode === 404) {
        resolve({ ok: true, latency, status: res.statusCode });
      } else if (res.statusCode === 401 || res.statusCode === 403) {
        resolve({ ok: false, error: 'API Key 无效或已过期', status: res.statusCode, latency });
      } else {
        resolve({ ok: true, latency, status: res.statusCode, warning: `HTTP ${res.statusCode}（可能仍可用）` });
      }
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: '请求超时，检查 Base URL 是否可达' }); });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.end();
  });
}

async function checkAllAIProviders() {
  let providers = {};
  try {
    const ai = require('./ai');
    const allP = ai.getAllProviders ? ai.getAllProviders() : {};
    providers = allP;
  } catch (_) {}

  const results = [];
  for (const [key, cfg] of Object.entries(providers)) {
    if (!cfg.apiKey) {
      results.push({ provider: key, name: cfg.name || key, ok: false, error: 'API Key 未配置', configured: false });
      continue;
    }
    const r = await checkAIKey(cfg.baseURL, cfg.apiKey);
    results.push({ provider: key, name: cfg.name || key, configured: true, ...r });
  }
  const anyOk = results.some(r => r.ok);
  return { results, any_ok: anyOk, total: results.length };
}

module.exports = { checkNetworkConnectivity, checkAIKey, checkAllAIProviders, checkGitHubNetwork };
