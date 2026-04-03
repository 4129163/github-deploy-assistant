// 项目环境预检测功能
const os = require('os')
const fs = require('fs-extra')
const { execSync } = require('child_process')

class EnvChecker {
  async checkProjectEnv(projectInfo, projectPath) {
    const result = {
      score: 100,
      level: '流畅运行',
      issues: [],
      suggestions: []
    }
    // 检测CPU
    const cpuCount = os.cpus().length
    const cpuUsage = os.loadavg()[0] / cpuCount * 100
    if (cpuUsage > 80) {
      result.score -= 20
      result.issues.push('CPU使用率过高')
      result.suggestions.push('建议关闭部分闲置应用释放CPU资源')
    }
    // 检测内存
    const freeMem = os.freemem() / 1024 / 1024 / 1024
    if (freeMem < projectInfo.minMemory) {
      result.score -= 30
      result.issues.push(`内存不足，最小需要${projectInfo.minMemory}GB，当前可用${freeMem.toFixed(1)}GB`)
      result.suggestions.push('建议升级内存或关闭其他应用')
    }
    // 检测依赖
    for (const dep of projectInfo.requiredDeps) {
      try {
        execSync(`${dep} --version`, { stdio: 'ignore' })
      } catch (e) {
        result.score -= 20
        result.issues.push(`缺少必要依赖：${dep}`)
        result.suggestions.push(`一键安装依赖：${dep}`)
      }
    }
    // 判定等级
    if (result.score >= 90) result.level = '流畅运行'
    else if (result.score >= 70) result.level = '正常运行'
    else if (result.score >= 50) result.level = '勉强运行'
    else result.level = '无法运行'
    return result
  }
}

module.exports = new EnvChecker()
