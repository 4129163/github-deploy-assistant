/**
 * 设备全身扫描服务
 * 覆盖：CPU、内存、磁盘、网络、系统信息、进程、环境、网速测试、优化建议
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('../utils/logger');

const execAsync = promisify(exec);

async function run(cmd, timeout = 8000) {
  try {
    const { stdout } = await execAsync(cmd, { timeout });
    return stdout.trim();
  } catch (e) {
    return null;
  }
}

// ── 1. 系统基本信息 ───────────────────────────────────
async function getSystemInfo() {
  const cpus = os.cpus();
  const uptime = os.uptime();
  const uptimeDays = Math.floor(uptime / 86400);
  const uptimeHours = Math.floor((uptime % 86400) / 3600);
  const uptimeMins = Math.floor((uptime % 3600) / 60);

  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  const release = os.release();
  const nodeVersion = process.version;

  // 检测设备类型
  const isVM = await detectVirtualization();
  const osType = await run('lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d"=" -f2 | tr -d \'"\' || echo Unknown');
  const kernel = await run('uname -r');
  const hostname2 = await run('hostname -f 2>/dev/null || hostname');

  return {
    hostname: hostname2 || hostname,
    platform,
    arch,
    os: osType || `${platform} ${release}`,
    kernel,
    uptime: `${uptimeDays}天 ${uptimeHours}小时 ${uptimeMins}分钟`,
    uptime_seconds: uptime,
    node_version: nodeVersion,
    virtualization: isVM,
    boot_time: new Date(Date.now() - uptime * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
  };
}

async function detectVirtualization() {
  const dmi = await run('systemd-detect-virt 2>/dev/null || cat /proc/cpuinfo | grep hypervisor | head -1');
  if (!dmi) return '物理机';
  if (dmi.includes('kvm') || dmi.includes('KVM')) return '云服务器 (KVM)';
  if (dmi.includes('vmware') || dmi.includes('VMware')) return '虚拟机 (VMware)';
  if (dmi.includes('docker')) return '容器 (Docker)';
  if (dmi.includes('hypervisor')) return '虚拟化环境';
  if (dmi === 'none') return '物理机';
  return dmi;
}

// ── 2. CPU ───────────────────────────────────────────
async function getCPUInfo() {
  const cpus = os.cpus();
  const model = cpus[0]?.model || 'Unknown';
  const cores = cpus.length;
  const speed = cpus[0]?.speed;

  // CPU 使用率（读两次 /proc/stat 间隔 1 秒）
  const usage = await getCPUUsage();

  // 负载
  const loadAvg = os.loadavg();
  const loadRaw = await run('cat /proc/loadavg');
  const loadParts = (loadRaw || '').split(' ');

  // 温度（部分系统有）
  const temp = await run('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null');
  const tempC = temp ? (parseInt(temp) / 1000).toFixed(1) + '°C' : '不支持读取';

  const issues = [];
  if (usage > 90) issues.push({ level: 'warn', msg: `CPU 使用率过高 (${usage}%)，建议检查是否有异常进程` });
  if (loadAvg[0] > cores * 2) issues.push({ level: 'warn', msg: `系统负载过高 (${loadAvg[0].toFixed(2)})，超过核数的2倍` });

  return {
    model,
    cores,
    threads: cores,
    speed_mhz: speed,
    usage_percent: usage,
    load_1m: loadAvg[0].toFixed(2),
    load_5m: loadAvg[1].toFixed(2),
    load_15m: loadAvg[2].toFixed(2),
    temperature: tempC,
    issues,
  };
}

async function getCPUUsage() {
  try {
    const read = () => {
      const data = require('fs').readFileSync('/proc/stat', 'utf8').split('\n')[0].split(/\s+/).slice(1).map(Number);
      return { idle: data[3], total: data.reduce((a, b) => a + b, 0) };
    };
    const t1 = read();
    await new Promise(r => setTimeout(r, 500));
    const t2 = read();
    const idleDiff = t2.idle - t1.idle;
    const totalDiff = t2.total - t1.total;
    return Math.round((1 - idleDiff / totalDiff) * 100);
  } catch (_) { return 0; }
}

// ── 3. 内存 ──────────────────────────────────────────
async function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usedPct = Math.round((used / total) * 100);

  // 包含 buff/cache 详情
  const freeOut = await run('free -b');
  let buffCache = 0, available = free;
  if (freeOut) {
    const lines = freeOut.split('\n');
    const memLine = lines.find(l => l.startsWith('Mem:'))?.split(/\s+/);
    if (memLine) {
      buffCache = parseInt(memLine[5] || 0) + parseInt(memLine[6] || 0);
      available = parseInt(memLine[6] || free);
    }
    const swapLine = lines.find(l => l.startsWith('Swap:'))?.split(/\s+/);
    var swapTotal = parseInt(swapLine?.[1] || 0);
    var swapUsed = parseInt(swapLine?.[2] || 0);
    var swapPct = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0;
  }

  const issues = [];
  if (usedPct > 90) issues.push({ level: 'error', msg: `内存使用率过高 (${usedPct}%)，系统可能不稳定` });
  else if (usedPct > 75) issues.push({ level: 'warn', msg: `内存使用率偏高 (${usedPct}%)，建议关闭不必要服务` });
  if (swapPct > 50) issues.push({ level: 'warn', msg: `Swap 使用率 ${swapPct}%，内存压力较大` });

  return {
    total: formatBytes(total),
    total_bytes: total,
    used: formatBytes(used),
    free: formatBytes(free),
    available: formatBytes(available),
    used_percent: usedPct,
    buff_cache: formatBytes(buffCache),
    swap_total: formatBytes(swapTotal || 0),
    swap_used: formatBytes(swapUsed || 0),
    swap_percent: swapPct || 0,
    issues,
  };
}

// ── 4. 磁盘 ──────────────────────────────────────────
async function getDiskInfo() {
  const dfOut = await run('df -B1 -x tmpfs -x devtmpfs -x overlay 2>/dev/null || df -B1');
  const disks = [];
  const issues = [];

  if (dfOut) {
    const lines = dfOut.split('\n').slice(1).filter(l => l.trim() && !l.startsWith('tmpfs'));
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 6) continue;
      const total = parseInt(parts[1]);
      const used = parseInt(parts[2]);
      const avail = parseInt(parts[3]);
      const usedPct = parseInt(parts[4]);
      const mount = parts[5];
      if (isNaN(total) || total === 0) continue;
      disks.push({
        filesystem: parts[0],
        mount,
        total: formatBytes(total),
        used: formatBytes(used),
        available: formatBytes(avail),
        used_percent: usedPct,
      });
      if (usedPct >= 90) issues.push({ level: 'error', msg: `磁盘 ${mount} 使用率危险 (${usedPct}%)，需要立即清理` });
      else if (usedPct >= 75) issues.push({ level: 'warn', msg: `磁盘 ${mount} 使用率偏高 (${usedPct}%)` });
    }
  }

  // IO 统计
  const ioRaw = await run('cat /proc/diskstats 2>/dev/null | head -5');

  return { disks, issues };
}

// ── 5. 网络 ──────────────────────────────────────────
async function getNetworkInfo() {
  const ifaces = os.networkInterfaces();
  const interfaces = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.internal) continue;
      interfaces.push({
        name,
        address: addr.address,
        family: addr.family,
        netmask: addr.netmask,
        mac: addr.mac,
      });
    }
  }

  // 网络流量统计
  const netStat = await run('cat /proc/net/dev 2>/dev/null');
  const traffic = [];
  if (netStat) {
    const lines = netStat.split('\n').slice(2);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const iface = parts[0].replace(':', '');
      if (iface === 'lo') continue;
      traffic.push({
        interface: iface,
        rx_bytes: formatBytes(parseInt(parts[1])),
        rx_packets: parseInt(parts[2]),
        tx_bytes: formatBytes(parseInt(parts[9])),
        tx_packets: parseInt(parts[10]),
      });
    }
  }

  // 公网 IP
  const publicIP = await run('curl -s --connect-timeout 5 https://api.ipify.org 2>/dev/null || curl -s --connect-timeout 5 http://ifconfig.me 2>/dev/null');

  // DNS
  const dns = await run('cat /etc/resolv.conf | grep ^nameserver | awk \'{print $2}\' | head -3');

  return {
    interfaces,
    traffic,
    public_ip: publicIP || '获取失败',
    dns_servers: dns ? dns.split('\n').filter(Boolean) : [],
  };
}

// ── 6. 网速测试（不依赖 speedtest-cli） ──────────────
async function getNetworkSpeed() {
  const results = { download_mbps: null, latency_ms: null, status: 'testing' };
  try {
    // 延迟测试：ping 多个目标取最优
    const pingTargets = ['8.8.8.8', '1.1.1.1', 'baidu.com'];
    const latencies = [];
    for (const target of pingTargets) {
      const out = await run(`ping -c 3 -W 2 ${target} 2>/dev/null | tail -1`, 8000);
      if (out) {
        const m = out.match(/=(\d+\.?\d*)\/(\d+\.?\d*)/);
        if (m) latencies.push(parseFloat(m[2]));
      }
    }
    if (latencies.length > 0) results.latency_ms = Math.min(...latencies).toFixed(1);

    // 下载速度：从 fast.com 镜像或 GitHub 测试
    const start = Date.now();
    const out = await run('curl -s -o /dev/null -w "%{speed_download}" --connect-timeout 8 --max-time 10 https://speed.cloudflare.com/__down?bytes=5000000 2>/dev/null', 15000);
    if (out && !isNaN(parseFloat(out))) {
      const elapsed = (Date.now() - start) / 1000;
      const bytes = 5000000;
      results.download_mbps = ((bytes / elapsed) / 1024 / 1024 * 8).toFixed(1);
    }
    results.status = 'ok';
  } catch (e) {
    results.status = 'error';
    results.error = e.message;
  }
  return results;
}

// ── 7. 进程信息 ────────────────────────────────────────
async function getProcessInfo() {
  const totalMem = os.totalmem();
  // Top 10 CPU 进程
  const cpuProcs = await run('ps aux --sort=-%cpu | head -11 | tail -10');
  // Top 10 MEM 进程
  const memProcs = await run('ps aux --sort=-%mem | head -11 | tail -10');
  // 总进程数
  const procCount = await run('ps aux | wc -l');

  function parsePS(out) {
    if (!out) return [];
    return out.split('\n').filter(Boolean).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        pid: parts[1],
        cpu: parts[2] + '%',
        mem: parts[3] + '%',
        command: parts.slice(10).join(' ').slice(0, 60),
      };
    });
  }

  const issues = [];
  const top = parsePS(cpuProcs);
  if (top.length > 0 && parseFloat(top[0].cpu) > 80) {
    issues.push({ level: 'warn', msg: `进程 ${top[0].command.split('/').pop()} CPU 占用 ${top[0].cpu}，建议检查` });
  }

  return {
    total_processes: parseInt(procCount || 0) - 1,
    top_cpu: parsePS(cpuProcs),
    top_mem: parsePS(memProcs),
    issues,
  };
}

// ── 8. 环境检测 ───────────────────────────────────────
async function getEnvInfo() {
  async function checkTool(cmd, flag = '--version') {
    const out = await run(`${cmd} ${flag} 2>&1 | head -1`, 5000);
    return { installed: !!out, version: out ? out.trim() : null };
  }

  const [node, npm, git, python3, docker, nginx, pm2, redis, mysql, postgres] = await Promise.all([
    checkTool('node'),
    checkTool('npm'),
    checkTool('git'),
    checkTool('python3'),
    checkTool('docker'),
    checkTool('nginx', '-v'),
    checkTool('pm2'),
    checkTool('redis-cli'),
    checkTool('mysql', '--version'),
    checkTool('psql', '--version'),
  ]);

  return {
    node, npm, git, python3, docker, nginx, pm2, redis, mysql, postgres,
  };
}

// ── 9. 安全检查 ───────────────────────────────────────
async function getSecurityInfo() {
  const issues = [];
  const info = {};

  // 开放端口
  const ports = await run('ss -tlnp 2>/dev/null | grep LISTEN || netstat -tlnp 2>/dev/null | grep LISTEN');
  info.open_ports = ports ? ports.split('\n').filter(Boolean).map(l => {
    const m = l.match(/:(\d+)\s/);
    return m ? m[1] : null;
  }).filter(Boolean) : [];

  // 防火墙状态
  const ufw = await run('ufw status 2>/dev/null | head -1');
  const iptables = await run('iptables -L INPUT --line-numbers 2>/dev/null | wc -l');
  info.firewall = ufw || (iptables && parseInt(iptables) > 2 ? 'iptables 已配置' : '未检测到防火墙');

  // 最后登录
  const lastLogin = await run('last -n 3 2>/dev/null | head -3');
  info.last_logins = lastLogin ? lastLogin.split('\n').filter(Boolean) : [];

  // 检查高危端口是否暴露（不含 localhost）
  const dangerPorts = ['3306', '5432', '6379', '27017', '11211', '9200'];
  const exposed = info.open_ports.filter(p => dangerPorts.includes(p));
  if (exposed.length > 0) {
    issues.push({ level: 'warn', msg: `检测到高风险端口开放: ${exposed.join(', ')}，建议确认是否需要对外暴露` });
  }

  // 检查 root 运行
  if (process.getuid && process.getuid() === 0) {
    issues.push({ level: 'warn', msg: 'GADA 正以 root 用户运行，建议使用普通用户' });
  }

  return { ...info, issues };
}

// ── 10. 系统优化建议整合 ──────────────────────────────
function buildOptimizationTips(all) {
  const tips = [];
  const allIssues = [
    ...(all.cpu?.issues || []),
    ...(all.memory?.issues || []),
    ...(all.disk?.issues || []),
    ...(all.processes?.issues || []),
    ...(all.security?.issues || []),
  ];
  for (const issue of allIssues) {
    tips.push({ level: issue.level, message: issue.msg });
  }
  // 通用建议
  if (all.memory?.swap_percent > 30) {
    tips.push({ level: 'info', message: '建议增加物理内存或优化内存使用，当前 Swap 使用较高' });
  }
  if (!tips.length) {
    tips.push({ level: 'ok', message: '系统运行状态良好，暂无优化建议 🎉' });
  }
  return tips;
}

// ── 主入口 ────────────────────────────────────────────
async function runDeviceScan(includeSpeedTest = false) {
  const start = Date.now();
  logger.info('[DeviceScan] Starting full device scan...');

  const [system, cpu, memory, disk, network, processes, env, security] = await Promise.all([
    getSystemInfo(),
    getCPUInfo(),
    getMemoryInfo(),
    getDiskInfo(),
    getNetworkInfo(),
    getProcessInfo(),
    getEnvInfo(),
    getSecurityInfo(),
  ]);

  let networkSpeed = { status: 'skipped', note: '网速测试已跳过（避免增加等待时间），可单独触发' };
  if (includeSpeedTest) {
    networkSpeed = await getNetworkSpeed();
  }

  const result = { system, cpu, memory, disk, network, network_speed: networkSpeed, processes, env, security };
  result.optimization_tips = buildOptimizationTips(result);
  result.scan_duration_ms = Date.now() - start;
  result.scanned_at = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  logger.info(`[DeviceScan] Done in ${result.scan_duration_ms}ms`);
  return result;
}

async function runSpeedTestOnly() {
  return getNetworkSpeed();
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = { runDeviceScan, runSpeedTestOnly };
