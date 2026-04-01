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

/**
 * 获取最优克隆策略
 * @param {string} originalUrl 原始 GitHub URL
 */
async function getBestCloneStrategy(originalUrl) {
  const net = await checkGitHubNetwork();
  
  // 策略 1: 直接访问 (网络极佳)
  if (net.quality === 'smooth') {
    return { 
      url: originalUrl, 
      mode: 'direct', 
      note: '网络环境优秀，正在通过 GitHub 官方渠道极速下载...' 
    };
  }

  // 策略 2: 镜像加速 (网络不稳定或较慢)
  if (net.quality === 'unstable') {
    const mirrorUrl = GITHUB_MIRRORS[0] + originalUrl.split('github.com')[1];
    return { 
      url: mirrorUrl, 
      mode: 'mirror', 
      note: '官方链接有点卡，已为你自动切换到专属加速通道，保证下载不中断。' 
    };
  }

  // 策略 3: 强制代理/代下载 (完全无法访问)
  return { 
    url: GITHUB_MIRRORS[1] + originalUrl.split('github.com')[1], 
    mode: 'proxy', 
    note: '检测到当前网络无法直连 GitHub，已开启「强力破壁」模式，正在通过中转下载项目。' 
  };
}

module.exports = { getBestCloneStrategy };