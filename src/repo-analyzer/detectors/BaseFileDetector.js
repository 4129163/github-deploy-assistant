const fs = require('fs-extra');
const path = require('path');
const BaseDetector = require('../BaseDetector');

class BaseFileDetector extends BaseDetector {
  constructor() {
    super();
    this.name = '基础文件完整性检测器';
    this.description = '检测仓库必备基础文件是否存在';
  }

  async detect(repoPath, repoInfo) {
    const issues = [];
    const requiredFiles = [
      {
        name: 'README.md',
        description: '项目说明文档',
        severity: 'high',
        solution: '在项目根目录创建README.md文件，填写项目介绍、安装使用教程、功能说明等内容'
      },
      {
        name: 'LICENSE',
        description: '开源协议文件',
        severity: 'medium',
        solution: '选择合适的开源协议，在根目录创建LICENSE文件'
      },
      {
        name: '.gitignore',
        description: 'Git忽略文件',
        severity: 'medium',
        solution: '在根目录创建.gitignore文件，配置不需要提交到Git的文件类型'
      },
      {
        name: 'package.json / pom.xml / requirements.txt',
        description: '依赖声明文件',
        severity: 'high',
        solution: '创建对应语言的依赖声明文件，列出项目所有依赖'
      }
    ];

    for (const file of requiredFiles) {
      // 检查多种可能的依赖文件
      if (file.name.includes('/')) {
        const files = file.name.split(' / ');
        let exists = false;
        for (const f of files) {
          if (await fs.pathExists(path.join(repoPath, f))) {
            exists = true;
            break;
          }
        }
        if (!exists) {
          issues.push({
            type: 'missing_file',
            name: file.name,
            description: `缺失${file.description}`,
            severity: file.severity,
            solution: file.solution
          });
        }
      } else {
        if (!await fs.pathExists(path.join(repoPath, file.name))) {
          issues.push({
            type: 'missing_file',
            name: file.name,
            description: `缺失${file.description}`,
            severity: file.severity,
            solution: file.solution
          });
        }
      }
    }

    return issues;
  }
}

module.exports = BaseFileDetector;
