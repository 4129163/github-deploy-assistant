/**
 * 私有仓库支持服务（功能40）
 * 支持通过 Personal Access Token (PAT) 克隆 GitHub/GitLab 私有仓库
 * Token 加密存储在本地 SQLite，不明文暴露
 */

const crypto = require('crypto');
const { ConfigDB } = require('./database');
const { logger } = require('../utils/logger');
const path = require('path');
const simpleGit = require('simple-git');
const fs = require('fs-extra');
const { WORK_DIR } = require('../config');

// 加密密钥：从环境变量读取，检查安全性
function getEncryptionKey() {
  const raw = process.env.GADA_SECRET_KEY;
  
  if (!raw || raw === 'change-me-to-a-random-secret' || raw === 'gada-default-secret-key-change-me') {
    const { logger } = require('../utils/logger');
    const defaultWeakKey = 'gada-default-secret-key-change-me';
    
    // 只在第一次使用时警告
    if (!getEncryptionKey._warned) {
      logger.warn('⚠️  GADA_SECRET_KEY 未设置或使用默认值，私有仓库 Token 加密安全性较弱！');
      logger.warn('⚠️  请在 .env 文件中设置一个强密钥（32字节随机字符串）');
      logger.warn('⚠️  生成命令: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      getEncryptionKey._warned = true;
    }
    
    return crypto.createHash('sha256').update(defaultWeakKey).digest();
  }
  
  return crypto.createHash('sha256').update(raw).digest(); // 32 bytes
}

const ALGO = 'aes-256-gcm';

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(data) {
  const [ivHex, tagHex, encHex] = data.split(':');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

// token 存储: { id -> { id, name, provider, encryptedToken, createdAt } }
const tokenMap = {};

async function loadTokens() {
  try {
    const raw = await ConfigDB.get('private_tokens');
    if (raw) {
      Object.assign(tokenMap, JSON.parse(raw));
      logger.info(`Loaded ${Object.keys(tokenMap).length} private repo tokens`);
    }
  } catch (_) {}
}

async function saveTokens() {
  try {
    await ConfigDB.set('private_tokens', JSON.stringify(tokenMap));
  } catch (_) {}
}

loadTokens();

/**
 * 保存私有仓库访问令牌
 * @param {string} name     - 令牌名称（如 "我的 GitHub PAT"）
 * @param {string} token    - 实际 Token 值
 * @param {string} provider - 'github' | 'gitlab' | 'gitea' | 'other'
 */
async function saveToken(name, token, provider = 'github') {
  const id = `tok_${Date.now()}`;
  tokenMap[id] = {
    id,
    name,
    provider,
    encryptedToken: encrypt(token),
    createdAt: new Date().toISOString(),
  };
  await saveTokens();
  logger.info(`Private token saved: ${name} (${provider})`);
  return { id, name, provider, createdAt: tokenMap[id].createdAt };
}

/**
 * 列出所有令牌（脱敏，不返回真实 token）
 */
function listTokens() {
  return Object.values(tokenMap).map(t => ({
    id: t.id,
    name: t.name,
    provider: t.provider,
    createdAt: t.createdAt,
  }));
}

/**
 * 删除令牌
 */
async function deleteToken(tokenId) {
  if (!tokenMap[tokenId]) throw new Error('令牌不存在');
  delete tokenMap[tokenId];
  await saveTokens();
}

/**
 * 获取解密后的令牌值
 */
function getRawToken(tokenId) {
  const t = tokenMap[tokenId];
  if (!t) throw new Error('令牌不存在');
  return decrypt(t.encryptedToken);
}

/**
 * 将 clone URL 注入 token 认证信息
 * 支持 GitHub PAT 和 GitLab PAT
 */
function injectTokenToUrl(repoUrl, rawToken, provider = 'github') {
  try {
    const u = new URL(repoUrl.replace(/^\.git$/, ''));
    if (provider === 'github') {
      u.username = rawToken;
      u.password = 'x-oauth-basic';
    } else if (provider === 'gitlab') {
      u.username = 'oauth2';
      u.password = rawToken;
    } else {
      u.username = rawToken;
      u.password = '';
    }
    return u.toString();
  } catch (_) {
    // 兜底：手动注入
    return repoUrl.replace('https://', `https://${rawToken}@`);
  }
}

/**
 * 克隆私有仓库
 * @param {string} repoUrl  - 仓库地址
 * @param {string} tokenId  - 令牌ID
 * @param {string} [name]   - 本地目录名（可选）
 * @param {function} onLog  - 日志回调
 */
async function clonePrivateRepo(repoUrl, tokenId, name = null, onLog = () => {}) {
  const rawToken = getRawToken(tokenId);
  const tok = tokenMap[tokenId];
  const authenticatedUrl = injectTokenToUrl(repoUrl, rawToken, tok.provider);

  // 推断目录名
  const repoName = name || repoUrl.split('/').pop().replace(/\.git$/, '');
  const targetPath = path.join(WORK_DIR, repoName);

  if (await fs.pathExists(targetPath)) {
    throw new Error(`目录已存在: ${targetPath}，请先删除或使用其他名称`);
  }

  onLog(`🔐 使用令牌认证克隆私有仓库...`);
  onLog(`📁 目标路径: ${targetPath}`);

  const git = simpleGit();
  try {
    await git.clone(authenticatedUrl, targetPath, ['--depth', '1']);
    onLog(`✅ 私有仓库克隆成功`);
    return targetPath;
  } catch (err) {
    try { await fs.remove(targetPath); } catch (_) {}
    const safeMsg = err.message.replace(rawToken, '***');
    onLog(`❌ 克隆失败: ${safeMsg}`);
    throw new Error(`私有仓库克隆失败: ${safeMsg}`);
  }
}

/**
 * 验证令牌是否有效（尝试访问 API）
 */
async function validateToken(tokenId) {
  const rawToken = getRawToken(tokenId);
  const tok = tokenMap[tokenId];
  const axios = require('axios');
  try {
    if (tok.provider === 'github') {
      const resp = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${rawToken}` },
        timeout: 10000,
      });
      return { valid: true, user: resp.data.login, scopes: resp.headers['x-oauth-scopes'] };
    } else if (tok.provider === 'gitlab') {
      const resp = await axios.get('https://gitlab.com/api/v4/user', {
        headers: { Authorization: `Bearer ${rawToken}` },
        timeout: 10000,
      });
      return { valid: true, user: resp.data.username };
    }
    return { valid: true, user: 'unknown' };
  } catch (err) {
    return { valid: false, error: err.response?.data?.message || err.message };
  }
}

module.exports = {
  saveToken,
  listTokens,
  deleteToken,
  getRawToken,
  injectTokenToUrl,
  clonePrivateRepo,
  validateToken,
};
