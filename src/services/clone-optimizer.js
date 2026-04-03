/**
 * 智能网络加速与克隆优化服务
 */

const { logger } = require('../utils/logger');
const { checkGitHubNetwork } = require('./network-checker');

const GITHUB_MIRRORS = [
  'https://kgithub.com',
  'https://github.moeyy.xyz/https://github.com',
  'https://ghproxy.com/https://github.com',
  'https://mirror.ghproxy.com/https://github.com', // 备用镜像 1
  'https://gh-proxy.com/https://github.com'       // 备用镜像 2
];

/**
 * 智能备份/批量任务调度
 * 参考 git-sync 和 octarchive 的逻辑：
 * 1. 支持全量克隆用户所有公开仓库
 * 2. 自动分类归档
 */
async function batchBackupUserRepos(username) {
  const { githubAxios } = require('./github');
  try {
    const res = await githubAxios.get(`https://api.github.com/users/${username}/repos?per_page=100`);
    const repos = res.data.map(r => r.clone_url);
    logger.info(`Found ${repos.length} repos for user: ${username}`);
    // 批量触发智能克隆
    return repos;
  } catch (e) {
    throw new Error(`无法获取用户仓库列表: ${e.message}`);
  }
}

const { checkUrl } = require('./network-checker');

/**
 * 检测所有镜像的连通性，返回最快的可用镜像
 */
async function getFastestMirror() {
  const mirrorChecks = await Promise.all(
    GITHUB_MIRRORS.map(async (mirror) => {
      const check = await checkUrl(mirror, 5000);
      return { mirror, ok: check.ok, latency: check.latency };
    })
  );

  const availableMirrors = mirrorChecks.filter(m => m.ok);
  if (availableMirrors.length === 0) return null;

  // 按延迟排序，取最快的
  availableMirrors.sort((a, b) => a.latency - b.latency);
  return availableMirrors[0].mirror;
}

/**
 * 获取最优克隆策略
 * @param {string} originalUrl 原始 GitHub URL
 */
async function getBestCloneStrategy(originalUrl) {
  const net = await checkGitHubNetwork();
  const pathSuffix = originalUrl.split('github.com')[1];
  
  // 策略 1: 直接访问 (网络极佳)
  if (net.quality === 'smooth') {
    return { 
      url: originalUrl, 
      mode: 'direct', 
      quality: net.quality,
      latency: net.latency_ms,
      note: '网络环境优秀，正在通过 GitHub 官方渠道极速下载...' 
    };
  }

  // 查找最快可用镜像
  const fastestMirror = await getFastestMirror();

  // 策略 2: 镜像加速 (网络不稳定或较慢，但有可用镜像)
  if (fastestMirror && net.quality === 'unstable') {
    const mirrorUrl = fastestMirror + pathSuffix;
    return { 
      url: mirrorUrl, 
      mode: 'mirror', 
      quality: net.quality,
      latency: net.latency_ms,
      note: `官方链接延迟较高 (${net.latency_ms}ms)，已自动切换到最快镜像通道，保证下载不中断。` 
    };
  }

  // 策略 3: 强制代理/代下载 (完全无法访问官方，但有可用镜像)
  if (fastestMirror && net.quality === 'unreachable') {
    const mirrorUrl = fastestMirror + pathSuffix;
    return { 
      url: mirrorUrl, 
      mode: 'proxy', 
      quality: net.quality,
      note: '检测到当前网络无法直连 GitHub，已通过最快中转镜像下载项目。' 
    };
  }

  // 策略 4: 所有方式都失败，提示手动上传
  return {
    url: null,
    mode: 'manual',
    quality: net.quality,
    note: '当前网络无法访问 GitHub 及所有镜像站点，请选择手动上传项目压缩包。'
  };
}

module.exports = { getBestCloneStrategy };