/**
 * 系统环境检测路由
 * 安全增强版 - 防止命令注入
 */

const express = require('express');
const router = express.Router();
const { safeExec } = require('../utils/security');

async function checkTool(cmd, versionFlag = '--version') {
  try {
    // 构建安全的命令
    const command = `${cmd} ${versionFlag}`;
    const result = await safeExec(command);
    
    if (result.success) {
      return { installed: true, version: result.stdout.trim().split('\n')[0] };
    } else {
      return { installed: false, version: null };
    }
  } catch (_) {
    return { installed: false, version: null };
  }
}

/**
 * 获取系统环境状态
 * GET /api/system/env
 */
router.get('/env', async (req, res) => {
  const [node, npm, git, python, python3, docker] = await Promise.all([
    checkTool('node'),
    checkTool('npm'),
    checkTool('git'),
    checkTool('python'),
    checkTool('python3'),
    checkTool('docker'),
  ]);

  const env = {
    node: { ...node, required: true, installUrl: 'https://nodejs.org/zh-cn/download/' },
    npm: { ...npm, required: true, installUrl: 'https://nodejs.org/zh-cn/download/' },
    git: { ...git, required: true, installUrl: 'https://git-scm.com/downloads' },
    python: {
      installed: python.installed || python3.installed,
      version: python3.version || python.version,
      required: false,
      installUrl: 'https://www.python.org/downloads/'
    },
    docker: { ...docker, required: false, installUrl: 'https://www.docker.com/get-started/' },
  };

  const allRequired = Object.values(env).filter(e => e.required).every(e => e.installed);

  res.json({ success: true, data: { env, ready: allRequired } });
});

/**
 * 获取所有项目健康状态
 * GET /api/system/health
 */
router.get('/health', (req, res) => {
  try {
    const { getAllHealthStatus } = require('../services/health-checker');
    res.json({ success: true, data: getAllHealthStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
