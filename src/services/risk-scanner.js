/**
 * 代码风险检测服务
 * 检测克隆下来的仓库是否存在安全风险
 */

const path = require('path');
const fs = require('fs-extra');
const { logger } = require('../utils/logger');

// 高风险文件模式
const HIGH_RISK_FILES = [
  { pattern: /postinstall/i, file: 'package.json', field: 'scripts', desc: 'postinstall 脚本（npm 安装后自动执行）' },
  { pattern: /preinstall/i, file: 'package.json', field: 'scripts', desc: 'preinstall 脚本（npm 安装前自动执行）' },
  { pattern: /prepare/i, file: 'package.json', field: 'scripts', desc: 'prepare 脚本（自动执行）' },
];

// 可疑命令关键词
const SUSPICIOUS_CMDS = [
  { pattern: /curl.*\|.*sh/i, level: 'high', desc: '通过 curl 下载并执行脚本' },
  { pattern: /wget.*\|.*sh/i, level: 'high', desc: '通过 wget 下载并执行脚本' },
  { pattern: /eval\s*\(/i, level: 'high', desc: '动态代码执行 (eval)' },
  { pattern: /base64.*decode/i, level: 'medium', desc: 'Base64 解码执行' },
  { pattern: /\/etc\/passwd/i, level: 'high', desc: '读取系统密码文件' },
  { pattern: /\/etc\/shadow/i, level: 'high', desc: '读取系统 shadow 文件' },
  { pattern: /rm\s+-rf\s+\/(?!tmp)/i, level: 'high', desc: '危险的 rm -rf 命令' },
  { pattern: /process\.env\.[A-Z_]{4,}/i, level: 'low', desc: '读取环境变量（可能收集密钥）' },
  { pattern: /require\(['"]child_process['"]/i, level: 'low', desc: '使用子进程执行命令' },
  { pattern: /spawn|exec(?:Sync|File)?\s*\(/i, level: 'low', desc: '执行系统命令' },
  { pattern: /crypto\.randomBytes|createCipheriv/i, level: 'low', desc: '加密操作（注意用途）' },
  { pattern: /https?:\/\/(?!localhost|127\.0\.0\.1)[^\s]{30,}/i, level: 'low', desc: '硬编码的外部 URL（可能外传数据）' },
];

// 高风险文件后缀（直接可执行）
const RISKY_EXTENSIONS = [
  { ext: '.sh', level: 'medium', desc: 'Shell 脚本' },
  { ext: '.bat', level: 'medium', desc: 'Windows 批处理脚本' },
  { ext: '.ps1', level: 'medium', desc: 'PowerShell 脚本' },
  { ext: '.exe', level: 'high', desc: '可执行文件' },
  { ext: '.dll', level: 'high', desc: '动态链接库' },
];

/**
 * 扫描 package.json 的 scripts
 */
async function scanPackageScripts(localPath) {
  const findings = [];
  const pkgPath = path.join(localPath, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return findings;

  try {
    const pkg = await fs.readJson(pkgPath);
    const scripts = pkg.scripts || {};
    const autoScripts = ['postinstall', 'preinstall', 'prepare', 'prepack', 'postpack'];
    for (const s of autoScripts) {
      if (scripts[s]) {
        const cmd = scripts[s];
        let level = 'medium';
        let details = [`脚本内容: ${cmd.slice(0, 120)}`];
        // 进一步分析命令内容
        for (const sus of SUSPICIOUS_CMDS) {
          if (sus.pattern.test(cmd)) {
            level = sus.level === 'high' ? 'high' : level;
            details.push(`⚠️ ${sus.desc}`);
          }
        }
        findings.push({
          type: 'auto_script',
          level,
          file: 'package.json',
          name: s,
          desc: `npm ${s} 脚本会在 npm install 时自动执行`,
          details,
        });
      }
    }
  } catch (_) {}
  return findings;
}

/**
 * 扫描目录中的可执行文件
 */
async function scanExecutables(localPath) {
  const findings = [];
  try {
    const entries = await fs.readdir(localPath);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const fullPath = path.join(localPath, entry);
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        for (const re of RISKY_EXTENSIONS) {
          if (entry.toLowerCase().endsWith(re.ext)) {
            findings.push({
              type: 'risky_file',
              level: re.level,
              file: entry,
              desc: `${re.desc}（${entry}）`,
              details: [],
            });
          }
        }
      }
    }
  } catch (_) {}
  return findings;
}

/**
 * 扫描关键脚本文件内容（只扫描根目录 js/py/sh，不递归，控制速度）
 */
async function scanFileContents(localPath) {
  const findings = [];
  const scanExts = ['.js', '.py', '.sh', '.ts'];
  const maxFileSize = 200 * 1024; // 200KB

  try {
    const entries = await fs.readdir(localPath);
    for (const entry of entries.slice(0, 30)) { // 最多扫 30 个
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue;
      const ext = path.extname(entry).toLowerCase();
      if (!scanExts.includes(ext)) continue;
      const fullPath = path.join(localPath, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (!stat.isFile() || stat.size > maxFileSize) continue;
        const content = await fs.readFile(fullPath, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const sus of SUSPICIOUS_CMDS.filter(s => s.level === 'high')) {
            if (sus.pattern.test(line)) {
              findings.push({
                type: 'suspicious_code',
                level: sus.level,
                file: entry,
                line: i + 1,
                desc: sus.desc,
                details: [`第 ${i+1} 行: ${line.trim().slice(0, 100)}`],
              });
            }
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
  return findings;
}

/**
 * 检查 .env.example 是否有可疑的环境变量收集
 */
async function scanEnvExample(localPath) {
  const findings = [];
  const envPath = path.join(localPath, '.env.example');
  if (!(await fs.pathExists(envPath))) return findings;
  try {
    const content = await fs.readFile(envPath, 'utf8');
    const suspicious = content.split('\n').filter(l =>
      /webhook|callback|report|telemetry|analytics|tracking/i.test(l) && l.includes('=')
    );
    if (suspicious.length > 0) {
      findings.push({
        type: 'env_tracking',
        level: 'low',
        file: '.env.example',
        desc: '环境变量中存在可能的追踪/上报配置',
        details: suspicious.slice(0, 5).map(l => l.trim()),
      });
    }
  } catch (_) {}
  return findings;
}

/**
 * 主扫描入口
 */
async function scanProject(localPath) {
  const [scripts, executables, contents, envTracking] = await Promise.all([
    scanPackageScripts(localPath),
    scanExecutables(localPath),
    scanFileContents(localPath),
    scanEnvExample(localPath),
  ]);

  const all = [...scripts, ...executables, ...contents, ...envTracking];
  const high = all.filter(f => f.level === 'high');
  const medium = all.filter(f => f.level === 'medium');
  const low = all.filter(f => f.level === 'low');

  let riskLevel = 'safe';
  if (high.length > 0) riskLevel = 'high';
  else if (medium.length > 0) riskLevel = 'medium';
  else if (low.length > 0) riskLevel = 'low';

  const recommendation = {
    safe: '✅ 未发现明显风险，可以正常部署',
    low: '💡 存在低风险提示，建议了解后部署',
    medium: '⚠️ 存在中等风险，建议仔细阅读相关代码后再部署',
    high: '🚨 发现高风险项，强烈建议不部署或手动审查后再决定',
  }[riskLevel];

  return {
    risk_level: riskLevel,
    findings: all,
    summary: { high: high.length, medium: medium.length, low: low.length, total: all.length },
    recommendation,
    scanned_at: new Date().toISOString(),
  };
}

module.exports = { scanProject };
