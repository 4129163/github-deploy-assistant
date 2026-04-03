const fs = require('fs-extra');
const path = require('path');
const BaseDetector = require('../BaseDetector');

class DependencyDetector extends BaseDetector {
  constructor() {
    super();
    this.name = '依赖检测器';
    this.description = '检测项目依赖是否过时、存在安全漏洞';
  }

  async detect(repoPath, repoInfo) {
    const issues = [];

    // 检测Node.js项目依赖
    const packageJsonPath = path.join(repoPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        const dependencies = packageJson.dependencies || {};
        const devDependencies = packageJson.devDependencies || {};

        // 检查过时的依赖版本（只检查大版本落后的情况）
        const outdatedDeps = [];
        for (const [name, version] of Object.entries({...dependencies, ...devDependencies})) {
          if (version.startsWith('^0.') || version.startsWith('~0.') || version === 'latest' || version === '*') {
            continue;
          }
          // 简单检测版本号是否太旧（比如主版本号小于当前主流版本）
          const majorVersion = version.match(/^[\^~]?(\d+)\./)?.[1];
          if (majorVersion && parseInt(majorVersion) < 1) {
            outdatedDeps.push(name);
          }
        }

        if (outdatedDeps.length > 0) {
          issues.push({
            type: 'dependency_outdated',
            name: '存在过时依赖',
            description: `以下依赖版本过旧：${outdatedDeps.join('、')}`,
            severity: 'medium',
            solution: '升级依赖到最新稳定版本，避免安全漏洞和兼容性问题'
          });
        }

        // 检查是否有lock文件
        const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
        let hasLockFile = false;
        for (const lockFile of lockFiles) {
          if (await fs.pathExists(path.join(repoPath, lockFile))) {
            hasLockFile = true;
            break;
          }
        }
        if (!hasLockFile) {
          issues.push({
            type: 'missing_lock_file',
            name: '缺失依赖锁定文件',
            description: '项目没有lock文件，可能导致不同环境依赖版本不一致',
            severity: 'low',
            solution: '执行npm install / yarn install生成对应的lock文件'
          });
        }
      } catch (e) {}
    }

    return issues;
  }
}

module.exports = DependencyDetector;
