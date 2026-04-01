/**
 * 设备兼容性检测服务
 * 将项目需求与本地设备硬件进行对比，给出小白易懂的运行建议
 */

const { logger } = require('../utils/logger');
const { runDeviceScan } = require('./device-scan');
const { chat } = require('./ai');

/**
 * 评估运行流畅度
 * @param {Object} projectRequirements 项目需求 (cpu, memory_gb, disk_gb)
 * @param {Object} deviceStats 设备现状
 */
async function evaluateCompatibility(projectRequirements, deviceStats) {
  const { cpu, memory, disk } = deviceStats;
  const req = projectRequirements || { cpu: 1, memory_gb: 2, disk_gb: 1 };

  // 内存对比 (最关键)
  const freeMemGB = memory.free_bytes / (1024 ** 3);
  const totalMemGB = memory.total_bytes / (1024 ** 3);
  const memRatio = totalMemGB / (req.memory_gb || 2);

  // CPU 核心对比
  const cpuRatio = cpu.cores / (req.cpu || 1);

  // 磁盘空间对比
  const freeDiskGB = disk.main_partition?.free_bytes / (1024 ** 3) || 0;
  const diskNeeded = req.disk_gb || 2;

  let score = 'ok';
  let level = '正好可以运行';
  let color = 'blue';

  if (totalMemGB < (req.memory_gb || 1) * 0.8 || freeDiskGB < diskNeeded) {
    score = 'incompatible';
    level = '不能够运行';
    color = 'red';
  } else if (memRatio >= 2 && cpuRatio >= 2) {
    score = 'smooth';
    level = '运行得很流畅';
    color = 'green';
  } else if (memRatio < 1.2 || cpuRatio < 1.1) {
    score = 'struggling';
    level = '勉强运行';
    color = 'orange';
  }

  // 使用 AI 生成小白能读懂的专业描述
  const prompt = `
    你是一个专业的电脑硬件专家，现在要给一个电脑小白解释为什么他的电脑运行某个项目会 "${level}"。
    项目需求：CPU ${req.cpu}核, 内存 ${req.memory_gb}GB, 磁盘 ${req.disk_gb}GB。
    设备现状：CPU ${cpu.cores}核 (${cpu.model}), 总内存 ${totalMemGB.toFixed(1)}GB, 剩余空间 ${freeDiskGB.toFixed(1)}GB。
    
    请给出以下内容（使用大白话，语气友好）：
    1. 流畅度评价：一句话概括运行感觉。
    2. 瓶颈分析：哪个硬件是短板？
    3. 升级建议：如果想运行更顺畅，该怎么做？（如买内存条、清磁盘、换CPU等）。
    
    请直接输出 JSON 格式：
    {
      "summary": "...",
      "bottleneck": "...",
      "upgrade_advice": "..."
    }
  `;

  try {
    const aiResponse = await chat([{ role: 'user', content: prompt }], { jsonMode: true });
    const aiReport = JSON.parse(aiResponse);
    
    return {
      score,
      level,
      color,
      requirements: req,
      device: {
        cpu: cpu.cores,
        memory: totalMemGB.toFixed(1),
        disk: freeDiskGB.toFixed(1)
      },
      report: aiReport
    };
  } catch (err) {
    logger.error('Compatibility AI evaluation failed:', err);
    return {
      score,
      level,
      color,
      report: {
        summary: `根据硬件参数，你的设备${level}。`,
        bottleneck: score === 'incompatible' ? '内存或磁盘空间不足' : '暂无明显瓶颈',
        upgrade_advice: score === 'incompatible' ? '建议增加内存或清理磁盘空间后再尝试。' : '当前配置基本满足需求。'
      }
    };
  }
}

module.exports = { evaluateCompatibility };