/**
 * GADA 全身功能自检服务
 * 检查所有关键子系统，发现问题自动修复并记录
 */

const path = require('path');
const fs = require('fs-extra');
const { execSync, exec } = require('child_process');

// ── 结果收集器 ──────────────────────────────────────
const results = [];

function pass(module, item, detail = '') {
  results.push({ status: 'PASS', module, item, detail });
}

function warn(module, item, detail = '', fix = '') {
  results.push({ status: 'WARN', module, item, detail, fix });
}

function fail(module, item, detail = '', fix = '') {
  results.push({ status: 'FAIL', module, item, detail, fix });
}

function fixed(module, item, detail = '') {
  results.push({ status: 'FIXED', module, item, detail });
}

// ── 1. 配置层 ────────────────────────────────────────
async function checkConfig() {
  const cfg = require('../config');

  // PORT
  if (cfg.PORT > 0 && cfg.PORT < 65536) {
    pass('Config', 'PORT', `${cfg.PORT}`);
  } else {
    fail('Config', 'PORT', `非法端口值: ${cfg.PORT}`);
  }

  // WORK_DIR
  try {
    await fs.ensureDir(cfg.WORK_DIR);
    await fs.access(cfg.WORK_DIR, fs.constants.W_OK);
    pass('Config', 'WORK_DIR', cfg.WORK_DIR);
  } catch (e) {
    try {
      await fs.mkdirp(cfg.WORK_DIR);
      fixed('Config', 'WORK_DIR', `已创建 ${cfg.WORK_DIR}`);
    } catch (e2) {
      fail('Config', 'WORK_DIR', `无法创建/写入: ${e2.message}`);
    }
  }

  // LOGS_DIR
  try {
    await fs.ensureDir(cfg.LOGS_DIR);
    await fs.access(cfg.LOGS_DIR, fs.constants.W_OK);
    pass('Config', 'LOGS_DIR', cfg.LOGS_DIR);
  } catch (e) {
    try {
      await fs.mkdirp(cfg.LOGS_DIR);
      fixed('Config', 'LOGS_DIR', `已创建 ${cfg.LOGS_DIR}`);
    } catch (e2) {
      fail('Config', 'LOGS_DIR', `无法创建/写入: ${e2.message}`);
    }
  }

  // DB 目录
  const dbDir = path.dirname(cfg.DB_PATH);
  try {
    await fs.ensureDir(dbDir);
    await fs.access(dbDir, fs.constants.W_OK);
    pass('Config', 'DB_DIR', dbDir);
  } catch (e) {
    try {
      await fs.mkdirp(dbDir);
      fixed('Config', 'DB_DIR', `已创建 ${dbDir}`);
    } catch (e2) {
      fail('Config', 'DB_DIR', `无法创建: ${e2.message}`);
    }
  }
}

// ── 2. 依赖层 ────────────────────────────────────────
async function checkDependencies() {
  const pkgPath = path.join(__dirname, '../../package.json');
  const nodeModules = path.join(__dirname, '../../node_modules');

  let pkg;
  try {
    pkg = await fs.readJson(pkgPath);
    pass('Dependencies', 'package.json', '可读');
  } catch (e) {
    fail('Dependencies', 'package.json', `读取失败: ${e.message}`);
    return;
  }

  const missing = [];
  for (const dep of Object.keys(pkg.dependencies || {})) {
    const depPath = path.join(nodeModules, dep);
    if (!await fs.pathExists(depPath)) {
      missing.push(dep);
    }
  }

  if (missing.length === 0) {
    pass('Dependencies', 'node_modules', `所有 ${Object.keys(pkg.dependencies).length} 个依赖已安装`);
  } else {
    warn('Dependencies', 'node_modules', `缺失: ${missing.join(', ')}`, '建议运行 npm install');
    // 自动修复：npm install
    try {
      execSync('npm install --loglevel=error', {
        cwd: path.join(__dirname, '../..'),
        timeout: 120000,
        stdio: 'pipe'
      });
      fixed('Dependencies', 'node_modules', `npm install 成功，修复了 ${missing.join(', ')}`);
    } catch (e) {
      fail('Dependencies', 'node_modules', `npm install 失败: ${e.message}`);
    }
  }
}

// ── 3. 模块加载层 ────────────────────────────────────
async function checkModules() {
  const modules = [
    ['Services/database', '../services/database'],
    ['Services/ai', '../services/ai'],
    ['Services/deploy', '../services/deploy'],
    ['Services/github', '../services/github'],
    ['Services/health-checker', '../services/health-checker'],
    ['Services/process-manager', '../services/process-manager'],
    ['Utils/logger', '../utils/logger'],
    ['Utils/port', '../utils/port'],
    ['Routes/ai', '../routes/ai'],
    ['Routes/config', '../routes/config'],
    ['Routes/deploy', '../routes/deploy'],
    ['Routes/process', '../routes/process'],
    ['Routes/project', '../routes/project'],
    ['Routes/repo', '../routes/repo'],
    ['Routes/scan', '../routes/scan'],
    ['Routes/settings', '../routes/settings'],
    ['Routes/system', '../routes/system'],
  ];

  for (const [label, modPath] of modules) {
    try {
      require(modPath);
      pass('Modules', label, '加载正常');
    } catch (e) {
      fail('Modules', label, `加载失败: ${e.message}`);
    }
  }
}

// ── 4. 数据库层 ──────────────────────────────────────
async function checkDatabase() {
  const { initDatabase, getDb, ProjectDB, DeployLogDB, ConfigDB, ConversationDB } = require('../services/database');

  // 初始化
  try {
    await initDatabase();
    pass('Database', 'init', 'initDatabase() 成功');
  } catch (e) {
    fail('Database', 'init', `initDatabase() 失败: ${e.message}`);
    return;
  }

  // getDb
  try {
    const db = getDb();
    if (!db) throw new Error('返回 null');
    pass('Database', 'getDb', '句柄可用');
  } catch (e) {
    fail('Database', 'getDb', e.message);
  }

  // 表结构检查
  const expectedTables = ['projects', 'deploy_logs', 'configs', 'conversations'];
  for (const table of expectedTables) {
    await new Promise((resolve) => {
      getDb().get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table], (err, row) => {
        if (err || !row) {
          fail('Database', `table:${table}`, err ? err.message : '表不存在');
        } else {
          pass('Database', `table:${table}`, '表存在');
        }
        resolve();
      });
    });
  }

  // projects 字段完整性
  const expectedCols = ['id', 'name', 'repo_url', 'local_path', 'status', 'project_type', 'config', 'notes', 'tags', 'port', 'health_url', 'created_at', 'updated_at'];
  await new Promise((resolve) => {
    getDb().all(`PRAGMA table_info(projects)`, (err, rows) => {
      if (err) {
        fail('Database', 'projects.columns', err.message);
        resolve();
        return;
      }
      const cols = (rows || []).map(r => r.name);
      const missing = expectedCols.filter(c => !cols.includes(c));
      if (missing.length === 0) {
        pass('Database', 'projects.columns', `所有 ${expectedCols.length} 个字段存在`);
      } else {
        // 尝试自动修复：ALTER TABLE
        let repaired = [];
        let failed = [];
        const defaults = { notes: 'TEXT DEFAULT ""', tags: 'TEXT DEFAULT ""', port: 'INTEGER', health_url: 'TEXT' };
        for (const col of missing) {
          const def = defaults[col] || 'TEXT';
          try {
            getDb().run(`ALTER TABLE projects ADD COLUMN ${col} ${def}`, (e) => {
              if (e) failed.push(col); else repaired.push(col);
            });
          } catch (_) {
            failed.push(col);
          }
        }
        setTimeout(() => {
          if (repaired.length) fixed('Database', 'projects.columns', `已补全字段: ${repaired.join(', ')}`);
          if (failed.length) fail('Database', 'projects.columns', `无法补全字段: ${failed.join(', ')}`);
          resolve();
        }, 200);
        return;
      }
      resolve();
    });
  });

  // ProjectDB 方法
  const dbMethods = [
    [ProjectDB, ['create', 'getAll', 'getById', 'update', 'delete'], 'ProjectDB'],
    [DeployLogDB, ['create', 'getByProjectId'], 'DeployLogDB'],
    [ConfigDB, ['get', 'set'], 'ConfigDB'],
    [ConversationDB, ['create', 'getByProjectId', 'getRecentByProjectId', 'clearByProjectId'], 'ConversationDB'],
  ];
  for (const [obj, methods, label] of dbMethods) {
    const missing = methods.filter(m => typeof obj[m] !== 'function');
    if (missing.length === 0) {
      pass('Database', `${label}.methods`, `所有方法存在`);
    } else {
      fail('Database', `${label}.methods`, `缺失方法: ${missing.join(', ')}`);
    }
  }
}

// ── 5. AI 提供商层 ───────────────────────────────────
async function checkAI() {
  let aiModule;
  try {
    aiModule = require('../services/ai');
    pass('AI', 'module', '加载正常');
  } catch (e) {
    fail('AI', 'module', `加载失败: ${e.message}`);
    return;
  }

  const requiredFns = ['getAIStatus', 'getAvailableProviders', 'getAllProviders', 'addCustomProvider', 'removeCustomProvider', 'chat', 'answerQuestion', 'parseAIConfig', 'loadCustomProviders'];
  const missing = requiredFns.filter(f => typeof aiModule[f] !== 'function');
  if (missing.length === 0) {
    pass('AI', 'exports', `所有 ${requiredFns.length} 个函数导出正常`);
  } else {
    fail('AI', 'exports', `缺失函数: ${missing.join(', ')}`);
  }

  // 检查可用提供商
  try {
    const providers = aiModule.getAvailableProviders();
    if (Array.isArray(providers)) {
      pass('AI', 'providers', `可用提供商数量: ${providers.length}`);
    } else {
      warn('AI', 'providers', 'getAvailableProviders() 未返回数组');
    }
  } catch (e) {
    warn('AI', 'providers', `调用失败: ${e.message}`);
  }
}

// ── 6. 进程管理层 ────────────────────────────────────
async function checkProcessManager() {
  let pm;
  try {
    pm = require('../services/process-manager');
    pass('ProcessManager', 'module', '加载正常');
  } catch (e) {
    fail('ProcessManager', 'module', `加载失败: ${e.message}`);
    return;
  }

  const fns = ['startProject', 'stopProject', 'restartProject', 'getProcessStatus', 'getAllProcesses', 'recoverProcessState'];
  const missing = fns.filter(f => typeof pm[f] !== 'function');
  if (missing.length === 0) {
    pass('ProcessManager', 'exports', '所有函数导出正常');
  } else {
    fail('ProcessManager', 'exports', `缺失函数: ${missing.join(', ')}`);
  }

  // 检查 runningProcesses 一致性（内存进程是否真实存活）
  try {
    const all = pm.getAllProcesses();
    let stale = 0;
    for (const [id, info] of Object.entries(all)) {
      if (info.status === 'running' && info.pid) {
        try {
          process.kill(info.pid, 0); // 只是探测
        } catch (_) {
          stale++;
        }
      }
    }
    if (stale === 0) {
      pass('ProcessManager', 'consistency', '内存进程表无僵尸进程');
    } else {
      warn('ProcessManager', 'consistency', `发现 ${stale} 个僵尸进程条目（pid 不存在），重启后会自动清理`);
    }
  } catch (e) {
    warn('ProcessManager', 'consistency', `无法检查进程一致性: ${e.message}`);
  }
}

// ── 7. 端口层 ────────────────────────────────────────
async function checkPort() {
  const { PORT } = require('../config');
  const { isPortInUse } = require('../utils/port');
  try {
    const inUse = await isPortInUse(PORT);
    if (inUse) {
      warn('Port', `${PORT}`, `配置端口 ${PORT} 已被占用（若服务本身在跑则正常）`);
    } else {
      pass('Port', `${PORT}`, `端口 ${PORT} 可用`);
    }
  } catch (e) {
    warn('Port', `${PORT}`, `端口检测失败: ${e.message}`);
  }
}

// ── 8. 文件系统层 ────────────────────────────────────
async function checkFilesystem() {
  const rootDir = path.join(__dirname, '../..');
  const checks = [
    path.join(rootDir, 'public/index.html'),
    path.join(rootDir, 'src/server/index.js'),
    path.join(rootDir, 'package.json'),
    path.join(rootDir, '.env'),
  ];
  for (const f of checks) {
    const exists = await fs.pathExists(f);
    if (exists) {
      pass('Filesystem', path.relative(rootDir, f), '文件存在');
    } else {
      if (f.endsWith('.env')) {
        // .env 不存在自动创建空文件
        try {
          await fs.writeFile(f, '# GADA Environment Variables\n');
          fixed('Filesystem', '.env', '已自动创建空 .env 文件');
        } catch (e) {
          warn('Filesystem', '.env', `.env 不存在且无法创建: ${e.message}`);
        }
      } else {
        fail('Filesystem', path.relative(rootDir, f), '文件缺失');
      }
    }
  }
}

// ── 9. GitHub 服务层 ─────────────────────────────────
async function checkGithub() {
  let github;
  try {
    github = require('../services/github');
    pass('GitHub', 'module', '加载正常');
  } catch (e) {
    fail('GitHub', 'module', `加载失败: ${e.message}`);
    return;
  }
  const fns = ['analyzeRepository', 'cloneRepository', 'getLocalProjectInfo', 'parseGitHubUrl', 'getFileContent'];
  const missing = fns.filter(f => typeof github[f] !== 'function');
  if (missing.length === 0) {
    pass('GitHub', 'exports', '所有函数导出正常');
  } else {
    fail('GitHub', 'exports', `缺失函数: ${missing.join(', ')}`);
  }
}

// ── 10. 健康检查服务层 ───────────────────────────────
async function checkHealthChecker() {
  let hc;
  try {
    hc = require('../services/health-checker');
    pass('HealthChecker', 'module', '加载正常');
  } catch (e) {
    fail('HealthChecker', 'module', `加载失败: ${e.message}`);
    return;
  }
  const fns = ['startHealthChecker', 'getAllHealthStatus'];
  const missing = fns.filter(f => typeof hc[f] !== 'function');
  if (missing.length === 0) {
    pass('HealthChecker', 'exports', '所有函数导出正常');
  } else {
    fail('HealthChecker', 'exports', `缺失函数: ${missing.join(', ')}`);
  }
}

// ── 11. 路由注册完整性 ───────────────────────────────
async function checkRoutes() {
  // 通过模拟 express app 检查路由文件是否 export router
  const routeFiles = [
    ['repo', '../routes/repo'],
    ['deploy', '../routes/deploy'],
    ['ai', '../routes/ai'],
    ['project', '../routes/project'],
    ['config', '../routes/config'],
    ['process', '../routes/process'],
    ['system', '../routes/system'],
    ['scan', '../routes/scan'],
    ['settings', '../routes/settings'],
  ];
  for (const [name, modPath] of routeFiles) {
    try {
      const r = require(modPath);
      if (r && r.stack) {
        pass('Routes', name, `已注册 ${r.stack.length} 条路由`);
      } else {
        warn('Routes', name, '模块未导出 express.Router');
      }
    } catch (e) {
      fail('Routes', name, `加载失败: ${e.message}`);
    }
  }
}

// ── 12. 安全检查 ─────────────────────────────────────
async function checkSecurity() {
  const deployPath = path.join(__dirname, '../services/deploy.js');
  try {
    const content = await fs.readFile(deployPath, 'utf8');
    if (content.includes('ALLOWED_COMMANDS') && content.includes('validateCommand')) {
      pass('Security', 'command_whitelist', '命令白名单存在');
    } else {
      fail('Security', 'command_whitelist', 'deploy.js 缺少命令白名单防护');
    }
    if (content.includes('startsWith(workspaceRoot)') || content.includes('path traversal')) {
      pass('Security', 'path_traversal', '路径穿越防护存在');
    } else {
      warn('Security', 'path_traversal', 'deploy.js 未找到路径穿越防护');
    }
  } catch (e) {
    warn('Security', 'deploy.js', `无法读取: ${e.message}`);
  }

  // 检查 settings.js 敏感值是否脱敏
  const settingsPath = path.join(__dirname, '../routes/settings.js');
  try {
    const content = await fs.readFile(settingsPath, 'utf8');
    if (content.includes('****') || content.includes('masked') || content.includes('脱敏') || content.includes('sensitive')) {
      pass('Security', 'settings_masking', '敏感值脱敏逻辑存在');
    } else {
      warn('Security', 'settings_masking', 'settings.js 未找到明显的敏感值脱敏逻辑');
    }
  } catch (e) {
    warn('Security', 'settings.js', `无法读取: ${e.message}`);
  }
}

// ── 汇总报告 ─────────────────────────────────────────
function printReport() {
  const pad = (s, n) => String(s).padEnd(n);
  const statusIcon = { PASS: '✅', WARN: '⚠️ ', FAIL: '❌', FIXED: '🔧' };

  console.log('\n' + '═'.repeat(70));
  console.log('  GADA 全身自检报告');
  console.log('═'.repeat(70));

  let lastModule = '';
  for (const r of results) {
    if (r.module !== lastModule) {
      console.log(`\n── ${r.module}`);
      lastModule = r.module;
    }
    const icon = statusIcon[r.status] || '  ';
    let line = `  ${icon} ${pad(r.item, 30)} ${r.detail}`;
    if (r.fix) line += `  [建议: ${r.fix}]`;
    console.log(line);
  }

  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const fixedCount = results.filter(r => r.status === 'FIXED').length;

  console.log('\n' + '─'.repeat(70));
  console.log(`  总计: ${total}  ✅ ${passed}  ⚠️  ${warned}  ❌ ${failed}  🔧 ${fixedCount}`);
  console.log('═'.repeat(70) + '\n');

  return { total, passed, warned, failed, fixed: fixedCount };
}

// ── 主入口 ───────────────────────────────────────────
async function runSelfCheck() {
  console.log('\n开始 GADA 全身自检...');
  await checkConfig();
  await checkDependencies();
  await checkModules();
  await checkDatabase();
  await checkAI();
  await checkProcessManager();
  await checkPort();
  await checkFilesystem();
  await checkGithub();
  await checkHealthChecker();
  await checkRoutes();
  await checkSecurity();
  await checkCompatibility(); // 新增兼容性模块自检
  await checkNetworkOptimizer(); // 新增网络优化模块自检
  const summary = printReport();
  return { results, summary };
}

module.exports = { runSelfCheck };
