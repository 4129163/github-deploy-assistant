/**
 * 环境检测与安装引导服务
 * 检测系统中各种运行时环境，给出安装建议
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const { logger } = require('../utils/logger');

const execAsync = promisify(exec);

async function run(cmd, timeout = 8000) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout });
    return (stdout || stderr || '').trim();
  } catch (_) { return null; }
}

const platform = process.platform; // linux / darwin / win32

// 安装命令建议（按平台）
const INSTALL_GUIDES = {
  node: {
    name: 'Node.js',
    linux: 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt install -y nodejs',
    darwin: 'brew install node  # 需要先安装 Homebrew',
    win32: '下载安装包：https://nodejs.org/zh-cn/download/',
    winget: 'winget install OpenJS.NodeJS.LTS',
    choco: 'choco install nodejs-lts',
    note: '安装完后重启终端或命令窗口'
  },
  npm: {
    name: 'npm',
    note: 'npm 随 Node.js 自动安装，无需单独安装'
  },
  git: {
    name: 'Git',
    linux: 'sudo apt install -y git',
    darwin: 'brew install git  # 或: xcode-select --install',
    win32: '下载安装包：https://git-scm.com/downloads',
    winget: 'winget install Git.Git',
    choco: 'choco install git',
    note: 'Windows 安装时选择「Git from the command line」选项'
  },
  python3: {
    name: 'Python 3',
    linux: 'sudo apt install -y python3 python3-pip',
    darwin: 'brew install python3',
    win32: '下载安装包：https://www.python.org/downloads/',
    winget: 'winget install Python.Python.3',
    choco: 'choco install python',
    note: 'Windows 安装时记得勾选「Add Python to PATH」'
  },
  pip3: {
    name: 'pip3',
    linux: 'sudo apt install -y python3-pip',
    darwin: 'python3 -m ensurepip --upgrade',
    win32: 'python -m ensurepip --upgrade',
    note: 'pip 随 Python 自动安装'
  },
  docker: {
    name: 'Docker',
    linux: 'curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER',
    darwin: '下载 Docker Desktop：https://www.docker.com/products/docker-desktop/',
    win32: '下载 Docker Desktop：https://www.docker.com/products/docker-desktop/',
    winget: 'winget install Docker.DockerDesktop',
    note: 'Linux 安装后需重新登录才能免 sudo 使用 Docker'
  },
  nginx: {
    name: 'Nginx',
    linux: 'sudo apt install -y nginx',
    darwin: 'brew install nginx',
    win32: '下载：http://nginx.org/en/download.html',
    note: '安装后运行 sudo systemctl start nginx 启动'
  },
  build_essential: {
    name: '编译工具 (build-essential)',
    linux: 'sudo apt install -y build-essential',
    darwin: 'xcode-select --install',
    win32: '安装 Visual C++ Build Tools：https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022',
    note: 'npm 安装某些包时需要编译工具（如 node-gyp）'
  },
  yarn: {
    name: 'Yarn',
    linux: 'npm install -g yarn',
    darwin: 'npm install -g yarn',
    win32: 'npm install -g yarn',
    note: '需要先安装 Node.js 和 npm'
  },
  pnpm: {
    name: 'pnpm',
    linux: 'npm install -g pnpm',
    darwin: 'npm install -g pnpm',
    win32: 'npm install -g pnpm',
    note: '需要先安装 Node.js 和 npm'
  },
  pm2: {
    name: 'PM2',
    linux: 'npm install -g pm2',
    darwin: 'npm install -g pm2',
    win32: 'npm install -g pm2',
    note: 'Node.js 进程管理器，需要先安装 Node.js'
  },
};

/**
 * 检测单个工具
 */
async function detectTool(id) {
  const guide = INSTALL_GUIDES[id] || {};
  let installed = false;
  let version = null;

  const cmds = {
    node: 'node --version',
    npm: 'npm --version',
    git: 'git --version',
    python3: 'python3 --version 2>&1 || python --version 2>&1',
    pip3: 'pip3 --version 2>&1 || pip --version 2>&1',
    docker: 'docker --version',
    nginx: 'nginx -v 2>&1',
    build_essential: platform === 'linux' ? 'dpkg -s build-essential 2>/dev/null | grep Status' : 'xcode-select -p 2>/dev/null',
    yarn: 'yarn --version',
    pnpm: 'pnpm --version',
    pm2: 'pm2 --version',
  };

  const raw = await run(cmds[id] || `${id} --version`);
  if (raw) {
    installed = true;
    version = raw.split('\n')[0].trim().slice(0, 60);
  }

  // 安装建议
  let installCmd = null;
  if (!installed) {
    if (platform === 'linux') installCmd = guide.linux || null;
    else if (platform === 'darwin') installCmd = guide.darwin || null;
    else if (platform === 'win32') installCmd = guide.winget || guide.win32 || null;
  }

  return {
    id,
    name: guide.name || id,
    installed,
    version,
    install_cmd: installCmd,
    install_note: guide.note || null,
    platform,
  };
}

/**
 * 根据项目类型检测所需环境
 */
async function detectForProject(types = []) {
  const needed = new Set(['git']); // git 是所有项目必需的

  if (types.includes('nodejs')) {
    ['node', 'npm'].forEach(t => needed.add(t));
    // 检测是否需要编译工具
    needed.add('build_essential');
  }
  if (types.includes('python')) {
    ['python3', 'pip3'].forEach(t => needed.add(t));
  }
  if (types.includes('docker')) {
    needed.add('docker');
  }

  const results = await Promise.all([...needed].map(detectTool));
  const missing = results.filter(r => !r.installed);
  const all_ok = missing.length === 0;

  return { results, missing, all_ok, platform };
}

/**
 * 全量扫描（所有工具）
 */
async function detectAll() {
  const all = Object.keys(INSTALL_GUIDES);
  const results = await Promise.all(all.map(detectTool));
  const missing = results.filter(r => !r.installed);
  return { results, missing, all_ok: missing.length === 0, platform };
}

/**
 * 执行安装命令（Linux/macOS，仅 apt/brew/npm install 类）
 * Windows 用户需要手动操作
 */
async function installTool(id) {
  if (platform === 'win32') {
    const guide = INSTALL_GUIDES[id];
    return {
      success: false,
      message: `Windows 暂不支持自动安装，请手动执行: ${guide?.winget || guide?.win32 || '参见环境指南'}`,
      manual: true
    };
  }

  const tool = await detectTool(id);
  if (tool.installed) {
    return { success: true, message: `${tool.name} 已安装 (${tool.version})`, skipped: true };
  }
  if (!tool.install_cmd) {
    return { success: false, message: `暂无自动安装方案，请参考环境指南手动安装 ${tool.name}` };
  }

  logger.info(`[EnvInstall] Installing ${id}: ${tool.install_cmd}`);
  try {
    const out = await execAsync(tool.install_cmd, { timeout: 120000 });
    const verify = await detectTool(id);
    return {
      success: verify.installed,
      message: verify.installed ? `✅ ${tool.name} 安装成功 (${verify.version})` : `⚠️ 命令执行完毕，但未检测到 ${tool.name}，请重启终端后重试`,
      output: (out.stdout || out.stderr || '').slice(0, 500)
    };
  } catch (err) {
    return { success: false, message: `安装失败: ${err.message.slice(0, 200)}` };
  }
}

module.exports = { detectTool, detectForProject, detectAll, installTool, INSTALL_GUIDES };
