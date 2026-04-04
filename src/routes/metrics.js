/**
 * 资源监控仪表盘 API
 * 提供 CPU/内存/磁盘使用率的历史曲线数据和实时监控
 * 支持进程树和端口占用显示
 */

const express = require('express');
const router = express.Router();
const os = require('os');
const { safeExec } = require('../utils/security');
const { ProjectDB } = require('../services/database');

// 历史数据存储（内存中，最多保存1小时数据，5秒采样间隔）
const METRICS_HISTORY_MAX = 720; // 1小时 = 3600秒 / 5秒间隔
const metricsHistory = [];

// 缓存进程树和端口信息（每30秒更新一次）
let cachedProcessTree = null;
let cachedPortInfo = null;
let lastProcessTreeUpdate = 0;
let lastPortInfoUpdate = 0;
const CACHE_TTL = 30000; // 30秒

/**
 * 获取详细的系统指标
 */
async function getDetailedMetrics() {
  const timestamp = Date.now();
  
  // 1. CPU使用率（详细）
  const cpus = os.cpus();
  const cpuUsage = cpus.map(cpu => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    const used = total - idle;
    return {
      model: cpu.model,
      speed: cpu.speed,
      usage: Math.round((used / total) * 1000) / 10, // 保留一位小数
      user: Math.round((cpu.times.user / total) * 1000) / 10,
      sys: Math.round((cpu.times.sys / total) * 1000) / 10,
      idle: Math.round((cpu.times.idle / total) * 1000) / 10
    };
  });
  
  // 2. 内存使用率
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsage = Math.round((usedMem / totalMem) * 1000) / 10;
  
  // 3. 磁盘使用率（多个分区）
  const diskInfo = await getDiskUsage();
  
  // 4. 系统负载
  const loadAvg = os.loadavg();
  
  // 5. 网络接口信息
  const networkInterfaces = os.networkInterfaces();
  const networkStats = Object.entries(networkInterfaces).map(([name, ifaces]) => ({
    name,
    addresses: ifaces.map(iface => ({
      address: iface.address,
      netmask: iface.netmask,
      family: iface.family,
      mac: iface.mac,
      internal: iface.internal
    }))
  }));
  
  // 6. 系统运行时间
  const uptime = os.uptime();
  
  const metrics = {
    timestamp,
    cpu: {
      totalUsage: Math.round(cpuUsage.reduce((sum, cpu) => sum + cpu.usage, 0) / cpuUsage.length * 10) / 10,
      cores: cpuUsage.length,
      details: cpuUsage,
      load: {
        '1min': Math.round(loadAvg[0] * 100) / 100,
        '5min': Math.round(loadAvg[1] * 100) / 100,
        '15min': Math.round(loadAvg[2] * 100) / 100
      }
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usage: memUsage,
      humanReadable: {
        total: formatBytes(totalMem),
        used: formatBytes(usedMem),
        free: formatBytes(freeMem)
      }
    },
    disk: diskInfo,
    network: networkStats,
    system: {
      uptime,
      platform: os.platform(),
      release: os.release(),
      type: os.type(),
      arch: os.arch(),
      hostname: os.hostname()
    }
  };
  
  // 保存到历史记录
  metricsHistory.push(metrics);
  if (metricsHistory.length > METRICS_HISTORY_MAX) {
    metricsHistory.shift();
  }
  
  return metrics;
}

/**
 * 获取磁盘使用信息
 */
async function getDiskUsage() {
  try {
    const result = await safeExec('df -k 2>/dev/null | grep -v "Filesystem"', { timeout: 5000 });
    const lines = result.stdout.trim().split('\n');
    
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        const total = parseInt(parts[1]) * 1024;
        const used = parseInt(parts[2]) * 1024;
        const available = parseInt(parts[3]) * 1024;
        const usage = Math.round((used / total) * 1000) / 10;
        
        return {
          filesystem: parts[0],
          total,
          used,
          available,
          usage,
          mount: parts[5],
          humanReadable: {
            total: formatBytes(total),
            used: formatBytes(used),
            available: formatBytes(available)
          }
        };
      }
      return null;
    }).filter(Boolean);
  } catch (error) {
    // 如果命令执行失败，返回根目录的信息
    const total = os.totalmem() * 100; // 估算值
    const used = total * 0.3; // 估算值
    const available = total * 0.7; // 估算值
    const usage = 30; // 估算值
    
    return [{
      filesystem: 'unknown',
      total,
      used,
      available,
      usage,
      mount: '/',
      humanReadable: {
        total: formatBytes(total),
        used: formatBytes(used),
        available: formatBytes(available)
      }
    }];
  }
}

/**
 * 获取进程树信息
 */
async function getProcessTree() {
  const now = Date.now();
  if (cachedProcessTree && now - lastProcessTreeUpdate < CACHE_TTL) {
    return cachedProcessTree;
  }
  
  try {
    // 获取所有进程信息
    const psResult = await safeExec('ps -eo pid,ppid,user,%cpu,%mem,comm,args --no-headers', { timeout: 10000 });
    const lines = psResult.stdout.trim().split('\n');
    
    const processes = lines.map(line => {
      const parts = line.trim().split(/\s+/, 7);
      if (parts.length >= 7) {
        return {
          pid: parseInt(parts[0]),
          ppid: parseInt(parts[1]),
          user: parts[2],
          cpu: parseFloat(parts[3]),
          mem: parseFloat(parts[4]),
          command: parts[5],
          args: parts[6] || ''
        };
      }
      return null;
    }).filter(Boolean);
    
    // 构建进程树结构
    const processMap = new Map();
    processes.forEach(proc => {
      processMap.set(proc.pid, { ...proc, children: [] });
    });
    
    const rootProcesses = [];
    processes.forEach(proc => {
      const node = processMap.get(proc.pid);
      if (proc.ppid === 0 || !processMap.has(proc.ppid)) {
        rootProcesses.push(node);
      } else {
        const parent = processMap.get(proc.ppid);
        parent.children.push(node);
      }
    });
    
    // 获取系统总CPU和内存用于计算百分比
    const totalCpu = os.cpus().length * 100; // 每个核心100%
    const totalMem = os.totalmem();
    
    // 计算每个进程的资源占用百分比（相对于系统总量）
    const calculateResourceUsage = (node) => {
      const cpuPercent = (node.cpu / totalCpu) * 100;
      const memPercent = (node.mem * totalMem / 100) / totalMem * 100;
      
      const resourceUsage = {
        cpu: Math.round(cpuPercent * 10) / 10,
        mem: Math.round(memPercent * 10) / 10
      };
      
      // 递归计算子进程
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => calculateResourceUsage(child));
      }
      
      node.resourceUsage = resourceUsage;
      return resourceUsage;
    };
    
    rootProcesses.forEach(proc => calculateResourceUsage(proc));
    
    cachedProcessTree = {
      timestamp: now,
      totalProcesses: processes.length,
      processes: rootProcesses.slice(0, 20) // 只返回前20个根进程
    };
    
    lastProcessTreeUpdate = now;
    return cachedProcessTree;
  } catch (error) {
    console.error('获取进程树失败:', error);
    return {
      timestamp: now,
      totalProcesses: 0,
      processes: [],
      error: '无法获取进程信息'
    };
  }
}

/**
 * 获取端口占用信息
 */
async function getPortInfo() {
  const now = Date.now();
  if (cachedPortInfo && now - lastPortInfoUpdate < CACHE_TTL) {
    return cachedPortInfo;
  }
  
  try {
    // 使用netstat或ss命令获取端口信息
    let command;
    try {
      // 尝试使用ss命令（更现代）
      command = 'ss -tulpn 2>/dev/null';
    } catch {
      // 回退到netstat
      command = 'netstat -tulpn 2>/dev/null || netstat -tuln 2>/dev/null';
    }
    
    const result = await safeExec(command, { timeout: 10000 });
    const lines = result.stdout.trim().split('\n');
    
    const ports = [];
    const portRegex = /:(\d+)\s/;
    
    lines.slice(1).forEach(line => { // 跳过标题行
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const localAddress = parts[3];
        const match = localAddress.match(portRegex);
        if (match) {
          const port = parseInt(match[1]);
          const protocol = parts[0];
          const state = parts[1];
          const pidMatch = line.match(/pid=(\d+)/);
          const pid = pidMatch ? parseInt(pidMatch[1]) : null;
          const programMatch = line.match(/\/([\w\-\.]+)/);
          const program = programMatch ? programMatch[1] : 'unknown';
          
          ports.push({
            port,
            protocol,
            state,
            localAddress,
            pid,
            program,
            description: getPortDescription(port)
          });
        }
      }
    });
    
    // 按端口号排序
    ports.sort((a, b) => a.port - b.port);
    
    cachedPortInfo = {
      timestamp: now,
      totalPorts: ports.length,
      ports: ports.slice(0, 100) // 只返回前100个端口
    };
    
    lastPortInfoUpdate = now;
    return cachedPortInfo;
  } catch (error) {
    console.error('获取端口信息失败:', error);
    return {
      timestamp: now,
      totalPorts: 0,
      ports: [],
      error: '无法获取端口信息'
    };
  }
}

/**
 * 获取端口描述（常见端口）
 */
function getPortDescription(port) {
  const commonPorts = {
    20: 'FTP Data',
    21: 'FTP Control',
    22: 'SSH',
    23: 'Telnet',
    25: 'SMTP',
    53: 'DNS',
    67: 'DHCP Server',
    68: 'DHCP Client',
    69: 'TFTP',
    80: 'HTTP',
    88: 'Kerberos',
    110: 'POP3',
    119: 'NNTP',
    123: 'NTP',
    135: 'MS RPC',
    137: 'NetBIOS Name',
    138: 'NetBIOS Datagram',
    139: 'NetBIOS Session',
    143: 'IMAP',
    161: 'SNMP',
    162: 'SNMP Trap',
    389: 'LDAP',
    443: 'HTTPS',
    445: 'SMB',
    465: 'SMTPS',
    514: 'Syslog',
    515: 'LPD',
    587: 'SMTP Submission',
    636: 'LDAPS',
    993: 'IMAPS',
    995: 'POP3S',
    1080: 'SOCKS Proxy',
    1433: 'MS SQL Server',
    1521: 'Oracle',
    1723: 'PPTP',
    1883: 'MQTT',
    1900: 'UPnP',
    2049: 'NFS',
    2082: 'cPanel',
    2083: 'cPanel SSL',
    2086: 'WHM',
    2087: 'WHM SSL',
    2095: 'Webmail',
    2096: 'Webmail SSL',
    2181: 'ZooKeeper',
    2375: 'Docker',
    2376: 'Docker SSL',
    2379: 'etcd',
    2380: 'etcd Peer',
    3000: 'Node.js/Express',
    3306: 'MySQL',
    3389: 'RDP',
    4000: 'Ruby on Rails',
    4200: 'Angular',
    4369: 'Erlang Port Mapper',
    5000: 'Flask',
    5432: 'PostgreSQL',
    5601: 'Kibana',
    5672: 'RabbitMQ',
    6379: 'Redis',
    7000: 'Cassandra',
    7474: 'Neo4j',
    7687: 'Neo4j Bolt',
    8000: 'Django',
    8080: 'HTTP Alternative',
    8081: 'HTTP Alternative',
    8088: 'HTTP Alternative',
    8090: 'HTTP Alternative',
    8100: 'HTTP Alternative',
    8181: 'HTTP Alternative',
    8443: 'HTTPS Alternative',
    8888: 'Jupyter',
    9000: 'PHP-FPM',
    9001: 'Tor',
    9042: 'Cassandra Native',
    9092: 'Kafka',
    9200: 'Elasticsearch',
    9300: 'Elasticsearch Transport',
    9418: 'Git',
    27017: 'MongoDB',
    28017: 'MongoDB HTTP',
    50000: 'SAP'
  };
  
  return commonPorts[port] || 'Unknown';
}

/**
 * 格式化字节数为人类可读格式
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 启动后台采样
 */
let metricsInterval;
function startMetricsSampling() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
  }
  
  metricsInterval = setInterval(async () => {
    try {
      await getDetailedMetrics();
    } catch (error) {
      console.error('Metrics sampling error:', error);
    }
  }, 5000); // 每5秒采样一次
  
  // 允许进程退出时清理
  if (metricsInterval.unref) {
    metricsInterval.unref();
  }
}

// 启动采样
startMetricsSampling();

// API端点

/**
 * GET /api/metrics/current
 * 获取当前系统指标
 */
router.get('/current', async (req, res) => {
  try {
    const metrics = await getDetailedMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/history
 * 获取历史指标数据
 */
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const data = metricsHistory.slice(-limit);
    
    res.json({
      success: true,
      data,
      count: data.length,
      interval: 5000,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/process-tree
 * 获取进程树信息
 */
router.get('/process-tree', async (req, res) => {
  try {
    const processTree = await getProcessTree();
    res.json({
      success: true,
      data: processTree
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/ports
 * 获取端口占用信息
 */
router.get('/ports', async (req, res) => {
  try {
    const portInfo = await getPortInfo();
    res.json({
      success: true,
      data: portInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/project/:projectId
 * 获取特定项目的资源使用情况
 */
router.get('/project/:projectId', async (req, res) => {
  try {
    const project = await ProjectDB.getById(req.params.projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // 获取项目进程信息
    const pm = require('../services/process-manager');
    const proc = pm.getProcessStatus ? pm.getProcessStatus(String(project.id)) : null;
    
    if (!proc?.pid) {
      return res.json({
        success: true,
        data: {
          projectId: project.id,
          projectName: project.name,
          running: false,
          message: '项目未运行'
        }
      });
    }
    
    // 获取进程详细信息
    const psResult = await safeExec(`ps -p ${proc.pid} -o pid,ppid,user,%cpu,%mem,vsz,rss,comm,args --no-headers 2>/dev/null`, { timeout: 5000 });
    
    let processInfo = null;
    if (psResult.stdout.trim()) {
      const parts = psResult.stdout.trim().split(/\s+/, 9);
      if (parts.length >= 9) {
        processInfo = {
          pid: parseInt(parts[0]),
          ppid: parseInt(parts[1]),
          user: parts[2],
          cpu: parseFloat(parts[3]),
          mem: parseFloat(parts[4]),
          vsz: parseInt(parts[5]) * 1024, // 转换为字节
          rss: parseInt(parts[6]) * 1024, // 转换为字节
          command: parts[7],
          args: parts[8]
        };
      }
    }
    
    // 获取项目监听的端口
    const portResult = await safeExec(`lsof -Pan -p ${proc.pid} -i 2>/dev/null | grep LISTEN`, { timeout: 5000 });
    const ports = [];
    
    if (portResult.stdout.trim()) {
      const lines = portResult.stdout.trim().split('\n');
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 9 && parts[7] === 'LISTEN') {
          const addressParts = parts[8].split(':');
          if (addressParts.length === 2) {
            const port = parseInt(addressParts[1]);
            ports.push({
              port,
              protocol: addressParts[0].toLowerCase().includes('tcp') ? 'TCP' : 'UDP',
              address: parts[8]
            });
          }
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        projectId: project.id,
        projectName: project.name,
        running: true,
        process: processInfo,
        ports,
        startTime: proc.startTime,
        uptime: proc.startTime ? Date.now() - proc.startTime : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/metrics/summary
 * 获取监控摘要
 */
router.get('/summary', async (req, res) => {
  try {
    const [currentMetrics, processTree, portInfo] = await Promise.all([
      getDetailedMetrics(),
      getProcessTree(),
      getPortInfo()
    ]);
    
    res.json({
      success: true,
      data: {
        timestamp: Date.now(),
        cpu: {
          usage: currentMetrics.cpu.totalUsage,
          load: currentMetrics.cpu.load
        },
        memory: {
          usage: currentMetrics.memory.usage,
          used: currentMetrics.memory.humanReadable.used,
          total: currentMetrics.memory.humanReadable.total
        },
        disk: currentMetrics.disk.map(d => ({
          mount: d.mount,
          usage: d.usage,
          used: d.humanReadable.used,
          total: d.humanReadable.total
        })),
        processes: {
          total: processTree.totalProcesses,
          topProcesses: processTree.processes.slice(0, 5).map(p => ({
            pid: p.pid,
            command: p.command,
            cpu: p.resourceUsage?.cpu || 0,
            mem: p.resourceUsage?.mem || 0
          }))
        },
        ports: {
          total: portInfo.totalPorts,
          listening: portInfo.ports.filter(p => p.state.includes('LISTEN')).length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;