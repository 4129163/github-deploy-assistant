/**
 * 智能网络加速与克隆优化服务
 */

const { logger } = require('../utils/logger');
const { checkGitHubNetwork } = require('./network-checker');

const GITHUB_MIRRORS = [
  'https://kgithub.com',
  'https://github.moeyy.xyz/https://github.com',
  'https://ghproxy.com/https://github.com'
];

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