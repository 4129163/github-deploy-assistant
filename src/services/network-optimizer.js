/**
 * 国内网络优化服务
 * - Git clone 加速（ghproxy.com 镜像）
 * - npm 镜像自动切换
 * - pip 镜像自动切换
 * - Docker Hub 镜像
 * - 自动检测并应用最优配置
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const { logger } = require('../utils/logger');
execAsync = promisify(exec);

async function run(cmd, timeout = 8000) {
  try { const { stdout } = await execAsync(cmd, { timeout }); return stdout.trim(); }
  catch (_) { return ''; }
}

const CN_MIRRORS = {
  npm: [
    { name: '淘宝 npmmirror', url: 'https://registry.npmmirror.com' },
    { name: 'CNPM', url: 'https://r.cnpmjs.org' },
    { name: '官方 npm', url: 'https://registry.npmjs.org' },
  ],
  pip: [
    { name: '清华 TUNA', url: 'https://pypi.tuna.tsinghua.edu.cn/simple' },
    { name: '阿里云', url: 'https://mirrors.aliyun.com/pypi/simple' },
    { name: '豆瓣', url: 'https://pypi.douban.com/simple' },
  ],
  github: [
    { name: 'ghproxy.com', prefix: 'https://ghproxy.com/' },
    { name: 'gh.con.sh', prefix: 'https://gh.con.sh/' },
    { name: '直连', prefix: '' },
  ],
};

/**
 * 检测当前 npm registry
 */
async function getNpmRegistry() {
  return await run('npm config get registry') || 'https://registry.npmjs.org';
}

/**
 * 设置 npm registry
 */
async function setNpmRegistry(url) {
  await execAsync(`npm config set registry ${url}`, { timeout: 5000 });
  return { success: true, url };
}

/**
 * 检测当前 pip mirror
 */
async function getPipMirror() {
  return await run('pip3 config get global.index-url') ||
         await run('pip config get global.index-url') || '';
}

/**
 * 设置 pip mirror
 */
async function setPipMirror(url) {
  const cmd = `pip3 config set global.index-url ${url} 2>/dev/null || pip config set global.index-url ${url}`;
  await execAsync(cmd, { timeout: 8000 });
  return { success: true, url };
}

/**
 * 测试镜像延迟
 */
const http = require('http');
const https = require('https');
function pingUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      res.resume();
      resolve({ ok: true, latency: Date.now() - start });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, latency: timeout }); });
    req.on('error', () => resolve({ ok: false, latency: Date.now() - start }));
  });
}

/**
 * 自动选择最快的 npm registry
 */
async function autoSelectNpmRegistry() {
  const results = await Promise.all(
    CN_MIRRORS.npm.map(async (m) => {
      const r = await pingUrl(m.url);
      return { ...m, ...r };
    })
  );
  const best = results.filter(r => r.ok).sort((a, b) => a.latency - b.latency)[0];
  return { results, best };
}

/**
 * 自动选择最快的 pip mirror
 */
async function autoSelectPipMirror() {
  const results = await Promise.all(
    CN_MIRRORS.pip.map(async (m) => {
      const r = await pingUrl(m.url);
      return { ...m, ...r };
    })
  );
  const best = results.filter(r => r.ok).sort((a, b) => a.latency - b.latency)[0];
  return { results, best };
}

/**
 * 将 GitHub URL 转换为加速 URL
 */
function applyGitHubProxy(url, proxy = 'https://ghproxy.com/') {
  if (!proxy) return url;
  if (url.startsWith('https://github.com')) {
    return proxy + url;
  }
  return url;
}

/**
 * 获取当前优化状态
 */
async function getOptimizationStatus() {
  const [npmRegistry, pipMirror] = await Promise.all([
    getNpmRegistry(),
    getPipMirror(),
  ]);

  const isCNNpm = CN_MIRRORS.npm.slice(0, 2).some(m => npmRegistry.includes(m.url.replace('https://', '')));
  const isCNPip = pipMirror && CN_MIRRORS.pip.some(m => pipMirror.includes(m.url.replace('https://', '')));

  return {
    npm: { current: npmRegistry, is_cn_mirror: isCNNpm },
    pip: { current: pipMirror || '（默认）', is_cn_mirror: isCNPip },
    suggestions: [
      ...(!isCNNpm ? ['npm 未使用国内镜像，在中国大陆安装依赖可能较慢'] : []),
      ...(!isCNPip ? ['pip 未使用国内镜像，在中国大陆安装 Python 依赖可能较慢'] : []),
    ],
  };
}

/**
 * 一键优化（自动选最快镜像并应用）
 */
async function applyOptimization(onLog) {
  const results = {};
  const log = (msg) => { if (onLog) onLog(msg); logger.info(`[NetworkOptimize] ${msg}`); };

  log('🔍 测试 npm 镜像速度...');
  const npmResult = await autoSelectNpmRegistry();
  if (npmResult.best) {
    log(`✅ 最快 npm 镜像: ${npmResult.best.name} (${npmResult.best.latency}ms)`);
    await setNpmRegistry(npmResult.best.url);
    results.npm = { applied: npmResult.best.url, name: npmResult.best.name };
  } else {
    log('⚠️ 所有 npm 镜像均不可达，保持原设置');
  }

  log('🔍 测试 pip 镜像速度...');
  const pipResult = await autoSelectPipMirror();
  if (pipResult.best) {
    log(`✅ 最快 pip 镜像: ${pipResult.best.name} (${pipResult.best.latency}ms)`);
    try {
      await setPipMirror(pipResult.best.url);
      results.pip = { applied: pipResult.best.url, name: pipResult.best.name };
    } catch (_) {
      log('⚠️ pip 镜像设置失败（可能未安装 pip）');
    }
  }

  log('🎉 优化完成！');
  return results;
}

module.exports = {
  getOptimizationStatus, applyOptimization,
  autoSelectNpmRegistry, autoSelectPipMirror,
  setNpmRegistry, setPipMirror,
  applyGitHubProxy, CN_MIRRORS,
};
