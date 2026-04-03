// 本地仓库备份与部署功能
const simpleGit = require('simple-git')
const fs = require('fs-extra')
const path = require('path')

class LocalBackupManager {
  async backupRepo(repoUrl, savePath) {
    await fs.ensureDir(savePath)
    const git = simpleGit()
    await git.clone(repoUrl, savePath, { '--mirror': false })
    // 完整克隆所有分支
    const repoGit = simpleGit(savePath)
    await repoGit.fetch('--all')
    return true
  }

  async listBackups(backupDir) {
    const dirs = await fs.readdir(backupDir)
    const backups = []
    for (const dir of dirs) {
      const fullPath = path.join(backupDir, dir)
      if (await fs.pathExists(path.join(fullPath, '.git'))) {
        const git = simpleGit(fullPath)
        const log = await git.log({ maxCount: 1 })
        backups.push({
          name: dir,
          path: fullPath,
          lastCommit: log.latest ? log.latest.message : '',
          lastUpdate: log.latest ? log.latest.date : ''
        })
      }
    }
    return backups
  }

  async deployLocalProject(localPath) {
    // 复用现有部署逻辑
    const { deployProject } = require('../deploy-service')
    return await deployProject(localPath, { local: true })
  }
}

module.exports = new LocalBackupManager()
