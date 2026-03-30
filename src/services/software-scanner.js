/**
 * 软件与环境扫描服务
 * 扫描设备上所有已安装的软件、开发环境、包管理器全局包
 * 支持：APT/DPKG、Snap、npm 全局、pip、系统命令行工具、GADA 自身
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('../utils/logger');

const execAsync = promisify(exec);

async function run(cmd, timeout = 10000) {
  try {
    const { stdout } = await execAsync(cmd, { timeout });
    return stdout.trim();
  } catch (_) { return null; }
}

// ── 1. 开发环境工具 ───────────────────────────────────
const ENV_TOOLS = [
  { id: 'node',    name: 'Node.js',    cmd: 'node',    vFlag: '--version',   category: '运行环境', uninstallHint: 'apt remove nodejs' },
  { id: 'npm',     name: 'npm',        cmd: 'npm',     vFlag: '--version',   category: '包管理器', uninstallHint: 'apt remove npm' },
  { id: 'git',     name: 'Git',        cmd: 'git',     vFlag: '--version',   category: '版本控制', uninstallHint: 'apt remove git' },
  { id: 'python3', name: 'Python 3',   cmd: 'python3', vFlag: '--version',   category: '运行环境', uninstallHint: 'apt remove python3' },
  { id: 'pip3',    name: 'pip3',       cmd: 'pip3',    vFlag: '--version',   category: '包管理器', uninstallHint: 'apt remove python3-pip' },
  { id: 'docker',  name: 'Docker',     cmd: 'docker',  vFlag: '--version',   category: '容器', uninstallHint: 'apt remove docker.io docker-ce' },
  { id: 'nginx',   name: 'Nginx',      cmd: 'nginx',   vFlag: '-v',          category: 'Web服务器', uninstallHint: 'apt remove nginx' },
  { id: 'go',      name: 'Go',         cmd: 'go',      vFlag: 'version',     category: '运行环境', uninstallHint: 'apt remove golang-go' },
  { id: 'rust',    name: 'Rust',       cmd: 'rustc',   vFlag: '--version',   category: '运行环境', uninstallHint: 'apt remove rustc' },
  { id: 'cargo',   name: 'Cargo',      cmd: 'cargo',   vFlag: '--version',   category: '包管理器', uninstallHint: 'apt remove cargo' },
  { id: 'java',    name: 'Java',       cmd: 'java',    vFlag: '-version',    category: '运行环境', uninstallHint: 'apt remove default-jdk' },
  { id: 'mvn',     name: 'Maven',      cmd: 'mvn',     vFlag: '--version',   category: '构建工具', uninstallHint: 'apt remove maven' },
  { id: 'gradle',  name: 'Gradle',     cmd: 'gradle',  vFlag: '--version',   category: '构建工具', uninstallHint: 'apt remove gradle' },
  { id: 'ruby',    name: 'Ruby',       cmd: 'ruby',    vFlag: '--version',   category: '运行环境', uninstallHint: 'apt remove ruby' },
  { id: 'gem',     name: 'RubyGems',   cmd: 'gem',     vFlag: '--version',   category: '包管理器', uninstallHint: 'apt remove rubygems' },
  { id: 'php',     name: 'PHP',        cmd: 'php',     vFlag: '--version',   category: '运行环境', uninstallHint: 'apt remove php' },
  { id: 'composer',name: 'Composer',   cmd: 'composer',vFlag: '--version',   category: '包管理器', uninstallHint: 'curl removal' },
  { id: 'gcc',     name: 'GCC',        cmd: 'gcc',     vFlag: '--version',   category: '编译工具', uninstallHint: 'apt remove gcc' },
  { id: 'make',    name: 'Make',       cmd: 'make',    vFlag: '--version',   category: '构建工具', uninstallHint: 'apt remove make' },
  { id: 'cmake',   name: 'CMake',      cmd: 'cmake',   vFlag: '--version',   category: '构建工具', uninstallHint: 'apt remove cmake' },
  { id: 'curl',    name: 'curl',       cmd: 'curl',    vFlag: '--version',   category: '网络工具', uninstallHint: 'apt remove curl' },
  { id: 'wget',    name: 'wget',       cmd: 'wget',    vFlag: '--version',   category: '网络工具', uninstallHint: 'apt remove wget' },
  { id: 'pm2',     name: 'PM2',        cmd: 'pm2',     vFlag: '--version',   category: '进程管理', uninstallHint: 'npm uninstall -g pm2' },
  { id: 'redis',   name: 'Redis',      cmd: 'redis-cli',vFlag: '--version',  category: '数据库', uninstallHint: 'apt remove redis-server' },
  { id: 'mysql',   name: 'MySQL',      cmd: 'mysql',   vFlag: '--version',   category: '数据库', uninstallHint: 'apt remove mysql-server' },
  { id: 'psql',    name: 'PostgreSQL', cmd: 'psql',    vFlag: '--version',   category: '数据库', uninstallHint: 'apt remove postgresql' },
  { id: 'sqlite3', name: 'SQLite3',    cmd: 'sqlite3', vFlag: '--version',   category: '数据库', uninstallHint: 'apt remove sqlite3' },
  { id: 'nvm',     name: 'nvm',        cmd: 'nvm',     vFlag: '--version',   category: '版本管理', uninstallHint: 'rm -rf ~/.nvm && 删除 .bashrc 中的 nvm 初始化代码' },
  { id: 'pyenv',   name: 'pyenv',      cmd: 'pyenv',   vFlag: '--version',   category: '版本管理', uninstallHint: 'rm -rf ~/.pyenv && 删除 .bashrc 中的 pyenv 初始化代码' },
  { id: 'conda',   name: 'Conda',      cmd: 'conda',   vFlag: '--version',   category: '版本管理', uninstallHint: 'conda init --reverse && rm -rf ~/miniconda3' },
  { id: 'yarn',    name: 'Yarn',       cmd: 'yarn',    vFlag: '--version',   category: '包管理器', uninstallHint: 'npm uninstall -g yarn' },
  { id: 'pnpm',    name: 'pnpm',       cmd: 'pnpm',    vFlag: '--version',   category: '包管理器', uninstallHint: 'npm uninstall -g pnpm' },
  { id: 'bun',     name: 'Bun',        cmd: 'bun',     vFlag: '--version',   category: '运行环境', uninstallHint: 'rm ~/.bun/bin/bun' },
  { id: 'deno',    name: 'Deno',       cmd: 'deno',    vFlag: '--version',   category: '运行环境', uninstallHint: 'rm ~/.deno/bin/deno' },
];

async function scanEnvTools() {
  const results = [];
  await Promise.all(ENV_TOOLS.map(async tool => {
    const which = await run(`which ${tool.cmd} 2>/dev/null`);
    if (!which) return;
    const verRaw = await run(`${tool.cmd} ${tool.vFlag} 2>&1 | head -1`, 5000);
    const version = (verRaw || '').replace(/[\r\n]+/g, '').slice(0, 80);
    const aptPkg = await getAptPackage(tool.cmd);
    results.push({
      id: tool.id,
      name: tool.name,
      category: tool.category,
      version,
      path: which,
      install_manager: aptPkg ? 'apt' : (which.includes('.npm') || which.includes('npm-global') ? 'npm' : 'system'),
      apt_package: aptPkg,
      uninstall_hint: tool.uninstallHint,
      removable: tool.id !== 'gada', // GADA 自身单独处理
    });
  }));
  return results.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

async function getAptPackage(cmd) {
  const out = await run(`dpkg -S $(which ${cmd} 2>/dev/null) 2>/dev/null | head -1`);
  if (!out) return null;
  return out.split(':')[0] || null;
}

// ── 2. APT 已安装包（用户主动安装，非系统基础包）────────
async function scanAptPackages() {
  const out = await run('apt-mark showmanual 2>/dev/null | sort', 15000);
  if (!out) return [];
  const names = out.split('\n').filter(Boolean);
  // 批量获取版本
  const results = [];
  // 分批处理，每批 50 个
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const verOut = await run(`dpkg-query -W -f='\${Package}|\${Version}|\${Description}\n' ${batch.join(' ')} 2>/dev/null`);
    if (verOut) {
      verOut.split('\n').filter(Boolean).forEach(line => {
        const parts = line.split('|');
        if (parts.length >= 2) {
          results.push({
            name: parts[0],
            version: parts[1],
            description: (parts[2] || '').slice(0, 80),
            manager: 'apt',
            uninstall_cmd: `sudo apt remove ${parts[0]}`,
          });
        }
      });
    }
  }
  return results;
}

// ── 3. Snap 包 ───────────────────────────────────────
async function scanSnapPackages() {
  const out = await run('snap list 2>/dev/null');
  if (!out) return [];
  return out.split('\n').slice(1).filter(Boolean).map(line => {
    const parts = line.trim().split(/\s+/);
    return {
      name: parts[0],
      version: parts[1],
      manager: 'snap',
      uninstall_cmd: `sudo snap remove ${parts[0]}`,
    };
  });
}

// ── 4. npm 全局包 ────────────────────────────────────
async function scanNpmGlobal() {
  const out = await run('npm list -g --depth=0 --json 2>/dev/null', 15000);
  if (!out) return [];
  try {
    const json = JSON.parse(out);
    const deps = json.dependencies || {};
    return Object.entries(deps).map(([name, info]) => ({
      name,
      version: info.version,
      manager: 'npm-global',
      uninstall_cmd: `npm uninstall -g ${name}`,
    }));
  } catch (_) { return []; }
}

// ── 5. pip 全局包 ────────────────────────────────────
async function scanPipPackages() {
  const out = await run('pip3 list --format=json 2>/dev/null', 15000);
  if (!out) return [];
  try {
    return JSON.parse(out).map(p => ({
      name: p.name,
      version: p.version,
      manager: 'pip3',
      uninstall_cmd: `pip3 uninstall -y ${p.name}`,
    }));
  } catch (_) { return []; }
}

// ── 6. GADA 通过 workspace 安装的项目 ────────────────
async function scanGadaProjects() {
  const { ProjectDB } = require('./database');
  try {
    const projects = await ProjectDB.getAll();
    return projects.map(p => ({
      id: p.id,
      name: p.name,
      path: p.local_path,
      status: p.status,
      type: p.project_type,
      manager: 'gada',
      uninstall_cmd: `GADA 内置卸载（项目管理页面操作）`,
    }));
  } catch (_) { return []; }
}

// ── 7. GADA 自身 ─────────────────────────────────────
async function getGadaInfo() {
  const pkg = await fs.readJson(path.join(__dirname, '../../package.json')).catch(() => ({}));
  return {
    name: 'GitHub Deploy Assistant (GADA)',
    version: pkg.version || 'unknown',
    path: path.join(__dirname, '../..'),
    manager: 'gada-self',
    uninstall_cmd: 'GADA 自卸载（在设置页面操作）',
  };
}

// ── 主扫描入口 ────────────────────────────────────────
async function runSoftwareScan() {
  const start = Date.now();
  logger.info('[SoftwareScan] Starting...');

  const [env_tools, apt_packages, snap_packages, npm_global, pip_packages, gada_projects, gada_self] = await Promise.all([
    scanEnvTools(),
    scanAptPackages(),
    scanSnapPackages(),
    scanNpmGlobal(),
    scanPipPackages(),
    scanGadaProjects(),
    getGadaInfo(),
  ]);

  return {
    scanned_at: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    scan_duration_ms: Date.now() - start,
    summary: {
      env_tools: env_tools.length,
      apt_packages: apt_packages.length,
      snap_packages: snap_packages.length,
      npm_global: npm_global.length,
      pip_packages: pip_packages.length,
      gada_projects: gada_projects.length,
    },
    env_tools,
    apt_packages,
    snap_packages,
    npm_global,
    pip_packages,
    gada_projects,
    gada_self,
  };
}

// ── 卸载执行 ─────────────────────────────────────────
async function uninstallSoftware({ manager, name, apt_package, uninstall_cmd }) {
  const steps = [];
  const log = msg => { steps.push(msg); logger.info(`[Uninstall] ${msg}`); };

  log(`开始卸载: ${name} (管理器: ${manager})`);

  if (manager === 'apt') {
    const pkg = apt_package || name;
    const r1 = await run(`sudo apt remove -y ${pkg} 2>&1`, 60000);
    log(r1 ? r1.slice(0, 200) : `apt remove ${pkg} 执行完毕`);
    const r2 = await run(`sudo apt autoremove -y 2>&1`, 30000);
    if (r2) log('autoremove: ' + r2.slice(0, 100));
  } else if (manager === 'snap') {
    const r = await run(`sudo snap remove ${name} 2>&1`, 30000);
    log(r || `snap remove ${name} 执行完毕`);
  } else if (manager === 'npm-global') {
    const r = await run(`npm uninstall -g ${name} 2>&1`, 30000);
    log(r || `npm uninstall -g ${name} 执行完毕`);
  } else if (manager === 'pip3') {
    const r = await run(`pip3 uninstall -y ${name} 2>&1`, 30000);
    log(r || `pip3 uninstall -y ${name} 执行完毕`);
  } else {
    log(`不支持自动卸载 manager=${manager}，请手动执行: ${uninstall_cmd}`);
    return { success: false, steps, message: `请手动执行: ${uninstall_cmd}` };
  }

  log(`✅ ${name} 卸载完成`);
  return { success: true, steps, message: `${name} 已卸载` };
}

// GADA 自卸载
async function selfUninstall({ keep_data = false } = {}) {
  const steps = [];
  const log = msg => { steps.push(msg); logger.info(`[SelfUninstall] ${msg}`); };
  const gadaDir = path.join(__dirname, '../..');

  log('🗑️ 开始 GADA 自卸载...');

  // 1. 停止所有运行中的项目进程
  try {
    const { getAllProcesses, stopProject } = require('./process-manager');
    const procs = getAllProcesses();
    for (const [id, info] of Object.entries(procs)) {
      if (info.status === 'running') {
        await stopProject(id).catch(() => {});
        log(`停止项目进程 #${id}`);
      }
    }
  } catch (_) {}

  // 2. 删除 workspace 项目目录（可选）
  const { WORK_DIR } = require('../config');
  if (!keep_data) {
    const workDirExists = await fs.pathExists(WORK_DIR);
    if (workDirExists) {
      await fs.remove(WORK_DIR).catch(() => {});
      log(`已删除 workspace 目录: ${WORK_DIR}`);
    }
  } else {
    log(`保留 workspace 数据: ${WORK_DIR}`);
  }

  // 3. 删除数据库
  const { DB_PATH } = require('../config');
  await fs.remove(DB_PATH).catch(() => {});
  log(`已删除数据库: ${DB_PATH}`);

  // 4. 删除日志
  const { LOGS_DIR } = require('../config');
  await fs.remove(LOGS_DIR).catch(() => {});
  log(`已删除日志目录: ${LOGS_DIR}`);

  // 5. 删除 search-records
  const searchDir = path.join(gadaDir, 'search-records');
  await fs.remove(searchDir).catch(() => {});
  log('已删除搜索记录目录');

  log('✅ GADA 卸载完成。主程序目录需手动删除: ' + gadaDir);
  log('  rm -rf ' + gadaDir);

  return { success: true, steps, gada_dir: gadaDir };
}

module.exports = { runSoftwareScan, uninstallSoftware, selfUninstall };
