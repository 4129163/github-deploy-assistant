const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const BaseDetector = require('../BaseDetector');

class ConfigDetector extends BaseDetector {
  constructor() {
    super();
    this.name = '配置检测器';
    this.description = '检测项目配置文件、API密钥有效性等问题';
  }

  async detect(project) {
    const issues = [];
    const projectPath = project.local_path;

    // 1. 检测.env配置文件是否存在
    const envPath = path.join(projectPath, '.env');
    if (!await fs.pathExists(envPath)) {
      issues.push({
        type: 'missing_env_file',
        severity: 'high',
        name: '缺失配置文件',
        description: '项目根目录缺失.env配置文件',
        fixable: true
      });
      return issues;
    }

    // 2. 读取配置文件内容
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (e) {
      issues.push({
        type: 'env_file_read_error',
        severity: 'high',
        name: '配置文件读取失败',
        description: '.env配置文件无法读取，请检查权限',
        fixable: false
      });
      return issues;
    }

    // 3. 解析配置项
    const config = {};
    envContent.split('\\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const [key, ...valueParts] = line.split('=');
      if (key) {
        config[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
      }
    });

    // 4. 检测必填配置项是否存在
    const requiredConfigs = ['OPENAI_API_KEY', 'API_KEY', 'TOKEN', 'PASSWORD', 'PORT'];
    for (const key of requiredConfigs) {
      if (envContent.includes(key) && !config[key]) {
        issues.push({
          type: 'missing_required_config',
          severity: 'high',
          name: `缺失必填配置项${key}`,
          description: `配置文件中${key}项为空，会导致功能无法正常使用`,
          fixable: true,
          configKey: key
        });
      }
    }

    // 5. 检测API密钥有效性
    if (config.OPENAI_API_KEY && config.OPENAI_API_KEY.startsWith('sk-')) {
      try {
        await axios.get('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` },
          timeout: 5000
        });
      } catch (e) {
        issues.push({
          type: 'invalid_openai_key',
          severity: 'high',
          name: 'OpenAI API密钥无效',
          description: '配置的OpenAI API密钥无效或余额不足',
          fixable: true,
          configKey: 'OPENAI_API_KEY'
        });
      }
    }

    // 6. 检测端口配置是否合法
    if (config.PORT) {
      const port = parseInt(config.PORT);
      if (isNaN(port) || port < 1 || port > 65535) {
        issues.push({
          type: 'invalid_port_config',
          severity: 'high',
          name: '端口配置不合法',
          description: `配置的端口${config.PORT}不是有效的端口号`,
          fixable: true,
          configKey: 'PORT'
        });
      }
    }

    return issues;
  }
}

module.exports = ConfigDetector;
