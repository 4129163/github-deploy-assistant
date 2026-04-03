// 系统资源监控与动态保护功能
const os = require('os')
const si = require('systeminformation')
const EventEmitter = require('events')

class ResourceMonitor extends EventEmitter {
  constructor() {
    super()
    this.threshold = 85 // 默认阈值85%
    this.running = false
  }

  setThreshold(value) {
    this.threshold = value
  }

  async getCurrentUsage() {
    const cpu = await si.currentLoad()
    const mem = await si.mem()
    return {
      cpu: cpu.currentLoad,
      memory: (mem.used / mem.total) * 100,
      timestamp: Date.now()
    }
  }

  startMonitor() {
    if (this.running) return
    this.running = true
    setInterval(async () => {
      const usage = await this.getCurrentUsage()
      if (usage.cpu > this.threshold || usage.memory > this.threshold) {
        this.emit('threshold-reached', usage)
      }
    }, 1000)
  }
}

module.exports = new ResourceMonitor()
