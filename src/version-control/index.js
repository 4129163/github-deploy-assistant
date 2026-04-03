// 版本管理与回退功能
const simpleGit = require('simple-git')
const fs = require('fs-extra')

class VersionManager {
  async checkUpdates(repoPath, repoUrl) {
    const git = simpleGit(repoPath)
    await git.fetch()
    const localHash = await git.revparse('HEAD')
    const remoteHash = await git.revparse('origin/main')
    return { hasUpdate: localHash !== remoteHash, localHash, remoteHash }
  }

  async getVersionList(repoPath) {
    const git = simpleGit(repoPath)
    const log = await git.log({ maxCount: 20 })
    return log.all.map(commit => ({
      hash: commit.hash,
      message: commit.message,
      date: commit.date,
      author: commit.author_name
    }))
  }

  async switchVersion(repoPath, targetHash) {
    const git = simpleGit(repoPath)
    await git.checkout(targetHash)
    // 自动重新安装依赖
    const { execSync } = require('child_process')
    if (fs.existsSync(path.join(repoPath, 'package.json'))) {
      execSync('npm install', { cwd: repoPath })
    }
    return true
  }
}

module.exports = new VersionManager()
