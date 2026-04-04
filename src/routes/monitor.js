/**
 * 资源监控路由（持续采样，供前端图表使用）
 * GET /api/monitor/snapshot    — 当前资源快照（CPU/内存/磁盘/进程）
 * GET /api/monitor/history     — 最近 N 条历史快照
 * GET /api/monitor/stream      — SSE 实时推送
 * GET /api/monitor/project/:id — 项目进程资源占用
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const { safeExec } = require('../utils/security');
const { ProjectDB } = require('../services/database');

// 内存中保存最近 60 条快照（约 5 分钟）
const HISTORY_MAX = 60;
const snapHistory = [];

async function run(cmd) {
  try { 
    const result = await safeExec(cmd, { timeout: 5000 }); 
    return result.stdout.trim(); 
  }
  catch (_) { 
    return ''; 
  }
}

async function takeCPUSnapshot() {
  // 两次采样计算 CPU 使用率
  const cpus1 = os.cpus();
  await new Promise(r => setTimeout(r, 500));
  const cpus2 = os.cpus();
  let totalIdle = 0, totalTick = 0;
  cpus1.forEach((cpu, i) => {
    const c1 = cpu.times, c2 = cpus2[i].times;
    const idle = c2.idle - c1.idle;
    const total = Object.values(c2).reduce((a,b)=>a+b,0) - Object.values(c1).reduce((a,b)=>a+b,0);
    totalIdle += idle; totalTick += total;
  });
  return Math.round((1 - totalIdle / totalTick) * 100);
}

async function takeSnapshot() {
  const [cpuPct, loadAvg] = await Promise.all([
    takeCPUSnapshot(),
    Promise.resolve(os.loadavg()),
  ]);
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // 磁盘使用（仅 /）
  let diskUsed = 0, diskTotal = 0;
  const dfOut = await run('df -k / | tail -1');
  if (dfOut) {
    const parts = dfOut.split(/\s+/);
    diskTotal = parseInt(parts[1]) * 1024 || 0;
    diskUsed = parseInt(parts[2]) * 1024 || 0;
  }

  const snap = {
    ts: Date.now(),
    cpu_pct: cpuPct,
    load_1: Math.round(loadAvg[0] * 100) / 100,
    load_5: Math.round(loadAvg[1] * 100) / 100,
    mem_total: totalMem,
    mem_used: usedMem,
    mem_pct: Math.round((usedMem / totalMem) * 100),
    disk_total: diskTotal,
    disk_used: diskUsed,
    disk_pct: diskTotal ? Math.round((diskUsed / diskTotal) * 100) : 0,
  };
  snapHistory.push(snap);
  if (snapHistory.length > HISTORY_MAX) snapHistory.shift();
  return snap;
}

// 启动后台采样（每 5 秒）
const samplerInterval = setInterval(async () => {
  try { await takeSnapshot(); } catch (_) {}
}, 5000);
if (samplerInterval.unref) samplerInterval.unref();

// 当前快照
router.get('/snapshot', async (req, res) => {
  try {
    const snap = await takeSnapshot();
    res.json({ success: true, data: snap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 历史快照
router.get('/history', (req, res) => {
  const n = Math.min(parseInt(req.query.n) || 60, HISTORY_MAX);
  res.json({ success: true, data: { history: snapHistory.slice(-n), interval_ms: 5000 } });
});

// SSE 实时推送
router.get('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 立即推送最新快照
  const first = await takeSnapshot();
  res.write(`data: ${JSON.stringify(first)}\n\n`);

  const iv = setInterval(async () => {
    try {
      const snap = await takeSnapshot();
      res.write(`data: ${JSON.stringify(snap)}\n\n`);
    } catch (_) {}
  }, 5000);

  req.on('close', () => clearInterval(iv));
});

// 项目进程资源
router.get('/project/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const pm = require('../services/process-manager');
    const proc = pm.getProcessStatus ? pm.getProcessStatus(String(project.id)) : null;
    if (!proc?.pid) return res.json({ success: true, data: { running: false } });

    const pidStat = await run(`ps -p ${proc.pid} -o pid,%cpu,%mem,vsz,rss --no-headers 2>/dev/null`);
    let cpu = 0, mem = 0, rss = 0;
    if (pidStat) {
      const parts = pidStat.trim().split(/\s+/);
      cpu = parseFloat(parts[1]) || 0;
      mem = parseFloat(parts[2]) || 0;
      rss = parseInt(parts[4]) * 1024 || 0;
    }
    res.json({ success: true, data: { running: true, pid: proc.pid, cpu_pct: cpu, mem_pct: mem, rss_bytes: rss } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
