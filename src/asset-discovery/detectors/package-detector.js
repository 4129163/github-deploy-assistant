/**
 * 包管理器检测器
 * 检测通过包管理器安装的非安装式程序
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const os = require('os');

class PackageDetector {
  constructor() {
    this.platform = os.platform();
    this.packageManagers = this.getAvailablePackageManagers();
  }

  /**
   * 获取可用的包管理器
   */
  getAvailablePackageManagers() {
    const managers = [];
    
    // 系统包管理器
    if (this.platform === 'win32') {
      managers.push(
        { name: 'winget', command: 'winget list', type: 'system' },
        { name: 'chocolatey', command: 'choco list --local-only', type: 'system' },
        { name: 'scoop', command: 'scoop list', type: 'system' }
      );
    } else if (this.platform === 'darwin') {
      managers.push(
        { name: 'homebrew', command: 'brew list', type: 'system' },
        { name: 'macports', command: 'port installed', type: 'system' }
      );
    } else {
      managers.push(
        { name: 'apt', command: 'apt list --installed', type: 'system' },
        { name: 'yum', command: 'yum list installed', type: 'system' },
        { name: 'dnf', command: 'dnf list installed', type: 'system' },
        { name: 'pacman', command: 'pacman -Q', type: 'system' },
        { name: 'zypper', command: 'zypper packages --installed-only', type: 'system' }
      );
    }
    
    // 语言包管理器（跨平台）
    managers.push(
      { name: 'npm', command: 'npm list -g --depth=0', type: 'language' },
      { name: 'yarn', command: 'yarn global list', type: 'language' },
      { name: 'pip', command: 'pip list --format=json', type: 'language' },
      { name: 'pip3', command: 'pip3 list --format=json', type: 'language' },
      { name: 'conda', command: 'conda list', type: 'language' },
      { name: 'cargo', command: 'cargo install --list', type: 'language' },
      { name: 'go', command: 'go list ...', type: 'language' },
      { name: 'composer', command: 'composer global show', type: 'language' },
      { name: 'gem', command: 'gem list', type: 'language' }
    );
    
    // 容器和虚拟化
    managers.push(
      { name: 'docker', command: 'docker ps --all', type: 'container' },
      { name: 'podman', command: 'podman ps --all', type: 'container' },
      { name: 'kubectl', command: 'kubectl get pods --all-namespaces', type: 'container' }
    );
    
    return managers;
  }

  /**
   * 检测通过包管理器安装的程序
   */
  async detectNonInstalledPrograms(fingerprints) {
    const results = [];
    const availableManagers = await this.checkAvailablePackageManagers();
    
    console.log(`📦 检查 ${availableManagers.length} 个包管理器...`);
    
    // 并行检查所有可用的包管理器
    const detectionPromises = availableManagers.map(async manager => {
      try {
        const installedPackages = await this.getInstalledPackages(manager);
        const detected = this.findProgramsInPackages(installedPackages, fingerprints, manager);
        
        return detected;
      } catch (error) {
        console.warn(`⚠️ ${manager.name} 检查失败: ${error.message}`);
        return [];
      }
    });
    
    const allDetected = await Promise.all(detectionPromises);
    
    // 合并结果
    allDetected.flat().forEach(detected => {
      results.push(detected);
    });
    
    return results;
  }

  /**
   * 检查可用的包管理器
   */
  async checkAvailablePackageManagers() {
    const available = [];
    
    for (const manager of this.packageManagers) {
      try {
        // 简单检查命令是否存在
        const checkCommand = this.platform === 'win32' ? 'where' : 'which';
        const { stdout } = await execPromise(`${checkCommand} ${manager.name.split(' ')[0]}`, {
          timeout: 3000
        }).catch(() => ({ stdout: '' }));
        
        if (stdout.trim()) {
          available.push(manager);
        }
      } catch (error) {
        // 管理器不可用
      }
    }
    
    return available;
  }

  /**
   * 获取已安装的包
   */
  async getInstalledPackages(manager) {
    try {
      const { stdout, stderr } = await execPromise(manager.command, {
        timeout: 10000,
        maxBuffer: 10 * 1024 * 1024 // 10MB缓冲区
      });
      
      return {
        manager: manager.name,
        type: manager.type,
        rawOutput: stdout,
        error: stderr,
        packages: this.parsePackageOutput(stdout, manager.name)
      };
      
    } catch (error) {
      // 有些包管理器在无输出时返回非零退出码
      if (error.stdout) {
        return {
          manager: manager.name,
          type: manager.type,
          rawOutput: error.stdout,
          error: error.stderr,
          packages: this.parsePackageOutput(error.stdout, manager.name)
        };
      }
      
      throw error;
    }
  }

  /**
   * 解析包管理器输出
   */
  parsePackageOutput(output, managerName) {
    const packages = [];
    
    if (!output || typeof output !== 'string') {
      return packages;
    }
    
    const lines = output.split('\n').filter(line => line.trim());
    
    switch (managerName) {
      case 'apt':
        // apt list --installed 格式
        for (const line of lines.slice(1)) { // 跳过标题行
          const parts = line.split('/');
          if (parts.length > 0) {
            packages.push(parts[0].trim());
          }
        }
        break;
        
      case 'yum':
      case 'dnf':
        // yum/dnf list installed 格式
        for (const line of lines.slice(1)) { // 跳过标题行
          const parts = line.split(/\s+/);
          if (parts.length > 0 && !parts[0].includes('.') && parts[0] !== 'Installed') {
            packages.push(parts[0].split('.')[0]); // 去除架构后缀
          }
        }
        break;
        
      case 'pacman':
        // pacman -Q 格式
        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length > 0) {
            packages.push(parts[0]);
          }
        }
        break;
        
      case 'homebrew':
        // brew list 格式
        lines.forEach(line => packages.push(line.trim()));
        break;
        
      case 'npm':
        try {
          // npm list -g --depth=0 返回JSON
          const json = JSON.parse(output);
          if (json.dependencies) {
            packages.push(...Object.keys(json.dependencies));
          }
        } catch (e) {
          // 如果不是JSON，按行解析
          lines.forEach(line => {
            const match = line.match(/^[├└─]\s+([^@]+)@/);
            if (match) packages.push(match[1]);
          });
        }
        break;
        
      case 'pip':
      case 'pip3':
        try {
          // pip list --format=json
          const json = JSON.parse(output);
          json.forEach(pkg => packages.push(pkg.name));
        } catch (e) {
          // 如果不是JSON，按表格解析
          for (const line of lines.slice(2)) { // 跳过标题行
            const parts = line.split(/\s+/);
            if (parts.length > 0) {
              packages.push(parts[0]);
            }
          }
        }
        break;
        
      case 'docker':
        // docker ps --all
        for (const line of lines.slice(1)) { // 跳过标题行
          const parts = line.split(/\s+/);
          if (parts.length > 0 && parts[parts.length - 1]) {
            packages.push(parts[parts.length - 1]);
          }
        }
        break;
        
      default:
        // 通用解析：每行第一个单词
        lines.forEach(line => {
          const firstWord = line.split(/\s+/)[0];
          if (firstWord && firstWord.length > 1) {
            packages.push(firstWord);
          }
        });
    }
    
    return [...new Set(packages)]; // 去重
  }

  /**
   * 在包列表中查找程序
   */
  findProgramsInPackages(packageData, fingerprints, manager) {
    const results = [];
    const packages = packageData.packages || [];
    
    for (const [programName, fingerprint] of Object.entries(fingerprints)) {
      // 构建搜索词列表
      const searchTerms = [
        programName.toLowerCase(),
        ...(fingerprint.processNames || []).map(name => name.toLowerCase())
      ];
      
      // 在包列表中搜索
      for (const searchTerm of searchTerms) {
        const matchingPackages = packages.filter(pkg => 
          pkg.toLowerCase().includes(searchTerm)
        );
        
        if (matchingPackages.length > 0) {
          results.push({
            program: programName,
            confidence: '中',
            detectedBy: [`${manager.name}包管理器`],
            details: {
              packageManager: manager.name,
              managerType: manager.type,
              matchingPackages: matchingPackages,
              installationMethod: '包管理器安装',
              note: `通过${manager.name}发现，包名包含"${searchTerm}"`
            }
          });
          break; // 找到一个匹配就停止搜索当前程序
        }
      }
    }
    
    return results;
  }

  /**
   * 获取包管理器详情
   */
  async getPackageManagerInfo(managerName) {
    const manager = this.packageManagers.find(m => m.name === managerName);
    if (!manager) return null;
    
    try {
      // 获取版本信息
      let versionCommand;
      if (managerName.includes(' ')) {
        versionCommand = managerName.split(' ')[0] + ' --version';
      } else {
        versionCommand = managerName + ' --version';
      }
      
      const { stdout } = await execPromise(versionCommand, { timeout: 3000 });
      
      return {
        name: managerName,
        type: manager.type,
        available: true,
        version: stdout.split('\n')[0].trim(),
        command: manager.command
      };
      
    } catch (error) {
      return {
        name: managerName,
        type: manager.type,
        available: false,
        error: error.message
      };
    }
  }

  /**
   * 检查包的健康状态
   */
  async checkPackageHealth(packageName, managerName) {
    try {
      let healthCommand;
      let parseFunction;
      
      switch (managerName) {
        case 'npm':
          healthCommand = `npm view ${packageName} version`;
          parseFunction = (output) => ({ version: output.trim() });
          break;
          
        case 'pip':
        case 'pip3':
          healthCommand = `pip show ${packageName}`;
          parseFunction = (output) => {
            const lines = output.split('\n');
            const info = {};
            lines.forEach(line => {
              const [key, value] = line.split(':').map(s => s.trim());
              if (key && value) info[key] = value;
            });
            return info;
          };
          break;
          
        case 'docker':
          healthCommand = `docker inspect ${packageName}`;
          parseFunction = (output) => {
            try {
              const json = JSON.parse(output);
              if (json && json.length > 0) {
                return {
                  state: json[0].State?.Status || 'unknown',
                  created: json[0].Created || 'unknown',
                  image: json[0].Config?.Image || 'unknown'
                };
              }
            } catch (e) {
              return { error: '解析失败' };
            }
          };
          break;
          
        default:
          return {
            status: '未知',
            note: `不支持${managerName}的健康检查`
          };
      }
      
      const { stdout } = await execPromise(healthCommand, { timeout: 5000 });
      const info = parseFunction(stdout);
      
      return {
        status: '正常',
        details: info,
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: '异常',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * 获取所有包管理器的统计信息
   */
  async getPackageManagerStats() {
    const availableManagers = await this.checkAvailablePackageManagers();
    const stats = {
      totalManagers: this.packageManagers.length,
      availableManagers: availableManagers.length,
      managers: []
    };
    
    for (const manager of availableManagers.slice(0, 5)) { // 限制检查数量
      try {
        const packageData = await this.getInstalledPackages(manager);
        stats.managers.push({
          name: manager.name,
          type: manager.type,
          packageCount: packageData.packages.length,
          samplePackages: packageData.packages.slice(0, 5)
        });
      } catch (error) {
        stats.managers.push({
          name: manager.name,
          type: manager.type,
          error: error.message
        });
      }
    }
    
    return stats;
  }

  /**
   * 查找特定程序的安装信息
   */
  async findProgramInstallation(programName) {
    const availableManagers = await this.checkAvailablePackageManagers();
    const installations = [];
    
    for (const manager of availableManagers) {
      try {
        const packageData = await this.getInstalledPackages(manager);
        const searchName = programName.toLowerCase();
        
        const matchingPackages = packageData.packages.filter(pkg => 
          pkg.toLowerCase().includes(searchName)
        );
        
        if (matchingPackages.length > 0) {
          installations.push({
            manager: manager.name,
            managerType: manager.type,
            packages: matchingPackages,
            totalPackages: packageData.packages.length
          });
        }
      } catch (error) {
        // 忽略单个管理器错误
      }
    }
    
    return installations;
  }
}

module.exports = PackageDetector;