/**
 * 系统环境检测路由
 */

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function checkTool(cmd, versionFlag = '--version') {
  try {
    const { stdout } = await execAsync(`${cmd} ${versionFlag}`);
    return { installed: true, version: stdout.trim().split('\n')[0] };
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

module.exports = router;
