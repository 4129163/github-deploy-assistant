const fs = require('fs-extra');
const path = require('path');
const BaseDetector = require('../BaseDetector');

// 常见敏感信息正则
const sensitivePatterns = [
  { pattern: /(secret|key|token|password|pwd|auth|credential)[^=]*=[\'\"]?[a-zA-Z0-9_\-+\/]{20,}[\'\"]?/i, description: '硬编码密钥/令牌' },
  { pattern: /(AKIA|ASIA)[A-Z0-9]{16}/, description: 'AWS访问密钥' },
  { pattern: /gh[pousr]_[A-Za-z0-9_]{36,251}/, description: 'GitHub令牌' },
  { pattern: /sk_[a-zA-Z0-9]{32,}/, description: 'API私钥' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b.*@/, description: '邮箱地址泄露' },
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/, description: 'IP地址泄露' }
];

class SecurityDetector extends BaseDetector {
  constructor() {
    super();
    this.name = '安全问题检测器';
    this.description = '检测仓库中的安全漏洞、敏感信息泄露等问题';
  }

  async detect(repoPath, repoInfo) {
    const issues = [];

    // 扫描代码文件中的敏感信息
    const codeExts = ['.js', '.py', '.java', '.go', '.php', '.ts', '.cpp', '.c', '.rb', '.env', '.config', '.json'];
    const files = await this.scanFiles(repoPath, codeExts);

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        for (const pattern of sensitivePatterns) {
          const matches = content.match(pattern.pattern);
          if (matches) {
            issues.push({
              type: 'security_risk',
              name: pattern.description,
              description: `在文件 ${path.relative(repoPath, file)} 中发现${pattern.description}`,
              severity: 'critical',
              solution: '立即删除硬编码的敏感信息，使用环境变量或配置中心管理密钥'
            });
            break;
          }
        }
      } catch (e) {
        // 忽略二进制文件等无法读取的文件
      }
    }

    // 检查是否有.env文件被提交到Git
    const envFile = path.join(repoPath, '.env');
    if (await fs.pathExists(envFile)) {
      const gitignore = await fs.readFile(path.join(repoPath, '.gitignore'), 'utf8').catch(() => '');
      if (!gitignore.includes('.env')) {
        issues.push({
          type: 'security_risk',
          name: '.env文件被提交到Git',
          description: '包含敏感配置的.env文件被提交到了Git仓库',
          severity: 'critical',
          solution: '将.env添加到.gitignore文件，并且从Git历史中删除.env文件'
        });
      }
    }

    return issues;
  }

  async scanFiles(dir, exts, result = []) {
    const files = await fs.readdir(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        // 跳过node_modules、.git等目录
        if (['node_modules', '.git', 'dist', 'build', 'venv', 'env'].includes(file)) continue;
        await this.scanFiles(fullPath, exts, result);
      } else {
        if (exts.includes(path.extname(file))) {
          result.push(fullPath);
        }
      }
    }
    return result;
  }
}

module.exports = SecurityDetector;
