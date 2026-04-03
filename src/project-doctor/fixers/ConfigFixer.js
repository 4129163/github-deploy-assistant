const fs = require('fs-extra');
const path = require('path');
const BaseFixer = require('../BaseFixer');

class ConfigFixer extends BaseFixer {
  constructor() {
    super();
    this.name = '配置问题修复器';
    this.description = '修复配置缺失、无效配置等问题，支持自然语言修改配置';
  }

  async fix(problem, project) {
    switch (problem.type) {
      case 'missing_env_file':
        return this.fixMissingEnvFile(project);
      case 'missing_required_config':
        return this.fixMissingConfig(project, problem.configKey);
      case 'invalid_openai_key':
      case 'invalid_port_config':
        return this.fixInvalidConfig(project, problem.configKey);
      default:
        return false;
    }
  }

  async fixMissingEnvFile(project) {
    try {
      // 复制.env.example为.env
      const examplePath = path.join(project.local_path, '.env.example');
      const envPath = path.join(project.local_path, '.env');
      if (await fs.pathExists(examplePath)) {
        await fs.copy(examplePath, envPath);
        return true;
      }
      // 没有example文件，创建基础.env
      await fs.writeFile(envPath, `# 项目配置文件
PORT=3000
OPENAI_API_KEY=
`);
      return true;
    } catch (e) {
      return false;
    }
  }

  async fixMissingConfig(project, configKey) {
    try {
      const envPath = path.join(project.local_path, '.env');
      let envContent = await fs.readFile(envPath, 'utf8');
      // 添加缺失的配置项
      if (!envContent.includes(configKey)) {
        envContent += `\\n${configKey}=\\n`;
        await fs.writeFile(envPath, envContent);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  async fixInvalidConfig(project, configKey, newValue = null) {
    try {
      const envPath = path.join(project.local_path, '.env');
      let envContent = await fs.readFile(envPath, 'utf8');
      
      if (newValue) {
        // 直接替换为新值
        const regex = new RegExp(`^${configKey}=.*$`, 'm');
        envContent = envContent.replace(regex, `${configKey}=${newValue}`);
        await fs.writeFile(envPath, envContent);
        return true;
      }
      
      // 没有新值的情况，先留空让用户填写
      const regex = new RegExp(`^${configKey}=.*$`, 'm');
      envContent = envContent.replace(regex, `${configKey}=`);
      await fs.writeFile(envPath, envContent);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 通过自然语言修改配置
   * @param {Object} project 项目信息
   * @param {string} userQuery 用户的自然语言请求
   * @returns {Promise<Object>} 修改结果
   */
  async updateConfigByNaturalLanguage(project, userQuery) {
    // 解析用户意图，提取配置项和新值
    const configMap = {
      'openai key': 'OPENAI_API_KEY',
      'openai api key': 'OPENAI_API_KEY',
      '密钥': 'OPENAI_API_KEY',
      'api密钥': 'OPENAI_API_KEY',
      '端口': 'PORT',
      '服务端口': 'PORT',
      '访问端口': 'PORT',
      '邮箱': 'MAIL_USER',
      '邮箱密码': 'MAIL_PASS',
      'smtp服务器': 'MAIL_HOST',
      '邮件通知': 'MAIL_ENABLE'
    };

    // 匹配配置项
    let targetKey = null;
    for (const [keyword, key] of Object.entries(configMap)) {
      if (userQuery.toLowerCase().includes(keyword)) {
        targetKey = key;
        break;
      }
    }

    if (!targetKey) {
      return { success: false, message: '没有识别到你要修改的配置项，请明确说明要修改什么配置哦~' };
    }

    // 提取新值
    let newValue = null;
    // 提取sk-开头的OpenAI密钥
    if (targetKey === 'OPENAI_API_KEY') {
      const skMatch = userQuery.match(/sk-[a-zA-Z0-9_\-]+/);
      if (skMatch) {
        newValue = skMatch[0];
      }
    }
    // 提取端口号
    if (targetKey === 'PORT') {
      const portMatch = userQuery.match(/(\d{2,5})/);
      if (portMatch) {
        const port = parseInt(portMatch[1]);
        if (port >= 1 && port <= 65535) {
          newValue = port.toString();
        }
      }
    }
    // 提取邮箱
    if (targetKey === 'MAIL_USER') {
      const emailMatch = userQuery.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        newValue = emailMatch[0];
      }
    }
    // 开关类配置
    if (['MAIL_ENABLE', 'DEBUG'].includes(targetKey)) {
      if (userQuery.includes('开启') || userQuery.includes('打开') || userQuery.includes('启用')) {
        newValue = 'true';
      } else if (userQuery.includes('关闭') || userQuery.includes('禁用')) {
        newValue = 'false';
      }
    }

    if (!newValue) {
      return { success: false, message: `我没听懂你要把${targetKey}改成什么，请告诉我具体的数值哦~` };
    }

    // 执行修改
    const success = await this.fixInvalidConfig(project, targetKey, newValue);
    if (success) {
      return { 
        success: true, 
        message: `✅ 配置修改成功！已经把${targetKey}设置为${newValue}，重启项目后生效~` 
      };
    } else {
      return { success: false, message: '修改配置失败，请检查文件权限~' };
    }
  }

  getManualFixSteps(problem, project) {
    switch (problem.type) {
      case 'missing_env_file':
        return '在项目根目录创建.env文件，参考.env.example填写配置内容';
      case 'missing_required_config':
        return `在.env文件中填写${problem.configKey}配置项的值`;
      case 'invalid_openai_key':
        return '检查OpenAI API密钥是否正确，是否有余额，在.env文件中更新为有效的密钥';
      case 'invalid_port_config':
        return '修改.env文件中的PORT为1-65535之间的有效端口号';
      default:
        return '请参考官方文档排查问题';
    }
  }
}

module.exports = ConfigFixer;
