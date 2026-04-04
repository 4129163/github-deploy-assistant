#!/usr/bin/env node
/**
 * 安全存储迁移脚本
 * 帮助用户从环境变量迁移敏感信息到安全存储
 */

const readline = require('readline');
const fs = require('fs-extra');
const path = require('path');
const secureStorage = require('../src/utils/secure-storage');

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// 日志函数
function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 错误日志
function error(message) {
  log('red', `❌ ${message}`);
}

// 成功日志
function success(message) {
  log('green', `✅ ${message}`);
}

// 信息日志
function info(message) {
  log('cyan', `ℹ️ ${message}`);
}

// 警告日志
function warn(message) {
  log('yellow', `⚠️ ${message}`);
}

// 标题
function title(message) {
  console.log('\n' + '='.repeat(60));
  log('magenta', ` ${message}`);
  console.log('='.repeat(60) + '\n');
}

// 询问用户输入
function question(query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

// 安全输入密码
function secureQuestion(query) {
  return new Promise((resolve) => {
    const stdin = process.openStdin();
    const listener = (chunk) => {
      const char = chunk.toString();
      if (char === '\r' || char === '\n') {
        process.stdout.write('\n');
        stdin.removeListener('data', listener);
        resolve();
      } else {
        process.stdout.write('*');
      }
    };
    
    process.stdout.write(query);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', listener);
  });
}

// 加载环境变量
function loadEnvVariables() {
  const envVars = {};
  
  // 从process.env获取
  for (const [key, value] of Object.entries(process.env)) {
    if (value && typeof value === 'string') {
      envVars[key] = value;
    }
  }
  
  // 尝试从.env文件加载
  try {
    const envFile = path.join(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"]|['"]$/g, '');
            if (value && !envVars[key]) {
              envVars[key] = value;
            }
          }
        }
      }
    }
  } catch (err) {
    warn(`无法读取.env文件: ${err.message}`);
  }
  
  return envVars;
}

// 检测敏感信息
function detectSensitiveInfo(envVars) {
  const sensitivePatterns = [
    { pattern: /_TOKEN$/i, name: 'API令牌' },
    { pattern: /_KEY$/i, name: 'API密钥' },
    { pattern: /_SECRET$/i, name: '密钥' },
    { pattern: /_PASSWORD$/i, name: '密码' },
    { pattern: /_CREDENTIALS$/i, name: '凭据' },
    { pattern: /^API_KEY$/i, name: 'API密钥' },
    { pattern: /^SECRET_/i, name: '秘密' },
    { pattern: /_ACCESS_KEY$/i, name: '访问密钥' },
    { pattern: /_PRIVATE_KEY$/i, name: '私钥' },
    { pattern: /_ENCRYPTION_KEY$/i, name: '加密密钥' }
  ];
  
  const sensitiveVars = [];
  
  for (const [key, value] of Object.entries(envVars)) {
    for (const { pattern, name } of sensitivePatterns) {
      if (pattern.test(key)) {
        sensitiveVars.push({
          key,
          value: value.length > 20 ? `${value.substring(0, 20)}...` : value,
          type: name,
          length: value.length
        });
        break;
      }
    }
  }
  
  return sensitiveVars;
}

// 显示检测结果
function displaySensitiveInfo(sensitiveVars) {
  if (sensitiveVars.length === 0) {
    info('未检测到敏感环境变量');
    return false;
  }
  
  title('检测到的敏感信息');
  
  console.log(`${colors.yellow}以下敏感信息将被迁移到安全存储:${colors.reset}\n`);
  
  const table = [];
  table.push(['变量名', '类型', '长度', '值预览']);
  table.push(['──────', '────', '────', '──────────']);
  
  for (const item of sensitiveVars) {
    table.push([
      item.key,
      item.type,
      item.length.toString(),
      item.value
    ]);
  }
  
  // 简单表格显示
  const colWidths = [30, 15, 8, 25];
  
  for (const row of table) {
    let line = '';
    for (let i = 0; i < row.length; i++) {
      const cell = row[i] || '';
      const width = colWidths[i] || 15;
      line += cell.padEnd(width, ' ');
    }
    console.log(line);
  }
  
  console.log();
  return true;
}

// 主迁移函数
async function migrate() {
  try {
    title('GitHub Deploy Assistant - 安全存储迁移工具');
    
    // 检查是否已初始化
    if (secureStorage.isInitialized()) {
      info('安全存储已初始化');
      const shouldContinue = await question('是否重新初始化安全存储? (y/N): ');
      if (shouldContinue.toLowerCase() !== 'y') {
        info('迁移已取消');
        rl.close();
        return;
      }
    }
    
    // 设置主密码
    info('请设置安全存储的主密码（至少8个字符）:');
    let masterPassword;
    let confirmPassword;
    
    do {
      masterPassword = await question('主密码: ');
      confirmPassword = await question('确认主密码: ');
      
      if (masterPassword.length < 8) {
        error('密码必须至少8个字符');
      } else if (masterPassword !== confirmPassword) {
        error('两次输入的密码不一致');
      } else {
        success('密码设置成功');
      }
    } while (masterPassword.length < 8 || masterPassword !== confirmPassword);
    
    // 初始化安全存储
    info('正在初始化安全存储...');
    await secureStorage.initialize(masterPassword);
    success('安全存储初始化完成');
    
    // 加载环境变量
    info('正在扫描环境变量...');
    const envVars = loadEnvVariables();
    const sensitiveVars = detectSensitiveInfo(envVars);
    
    // 显示检测结果
    const hasSensitiveInfo = displaySensitiveInfo(sensitiveVars);
    
    if (!hasSensitiveInfo) {
      warn('未找到需要迁移的敏感信息');
      const shouldContinue = await question('是否继续设置安全存储? (y/N): ');
      if (shouldContinue.toLowerCase() !== 'y') {
        info('迁移已取消');
        rl.close();
        return;
      }
    }
    
    // 确认迁移
    if (sensitiveVars.length > 0) {
      const confirm = await question(`是否迁移以上 ${sensitiveVars.length} 个敏感变量到安全存储? (y/N): `);
      if (confirm.toLowerCase() !== 'y') {
        info('迁移已取消');
        rl.close();
        return;
      }
    }
    
    // 执行迁移
    if (sensitiveVars.length > 0) {
      info('正在迁移敏感信息到安全存储...');
      
      let migrated = 0;
      let failed = 0;
      
      for (const item of sensitiveVars) {
        try {
          await secureStorage.save(
            item.key,
            envVars[item.key],
            masterPassword,
            {
              description: `从环境变量迁移: ${item.key}`,
              tags: ['env-migration', 'sensitive', item.type.toLowerCase()],
              source: 'env'
            }
          );
          
          success(`已迁移: ${item.key}`);
          migrated++;
        } catch (err) {
          error(`迁移失败 ${item.key}: ${err.message}`);
          failed++;
        }
      }
      
      // 显示迁移结果
      title('迁移完成');
      console.log(`${colors.green}成功迁移: ${migrated} 个${colors.reset}`);
      if (failed > 0) {
        console.log(`${colors.red}失败: ${failed} 个${colors.reset}`);
      }
      
      // 建议清理环境变量
      if (migrated > 0) {
        console.log(`\n${colors.yellow}建议:${colors.reset}`);
        console.log('1. 从.env文件中删除已迁移的敏感变量');
        console.log('2. 在代码中使用安全存储API获取敏感信息');
        console.log('3. 运行以下命令测试安全存储:');
        console.log(`   ${colors.cyan}node -e "const storage = require('./src/utils/secure-storage'); console.log('安全存储状态:', storage.isInitialized());"${colors.reset}`);
      }
    }
    
    // 显示安全存储信息
    title('安全存储信息');
    console.log(`存储位置: ${colors.cyan}${secureStorage.storageDir}${colors.reset}`);
    console.log(`加密算法: ${colors.cyan}AES-256-GCM${colors.reset}`);
    console.log(`密钥派生: ${colors.cyan}PBKDF2-SHA256 (100,000次迭代)${colors.reset}`);
    console.log(`最大尝试次数: ${colors.cyan}5次${colors.reset}`);
    console.log(`锁定时间: ${colors.cyan}15分钟${colors.reset}`);
    
    // 显示使用示例
    title('使用示例');
    console.log(`${colors.yellow}如何在代码中使用安全存储:${colors.reset}\n`);
    
    console.log(`${colors.green}// 1. 导入模块${colors.reset}`);
    console.log(`const secureStorage = require('./src/utils/secure-storage');\n`);
    
    console.log(`${colors.green}// 2. 保存敏感信息${colors.reset}`);
    console.log(`await secureStorage.save('github_token', 'your_token_here', 'your_master_password', {`);
    console.log(`  description: 'GitHub Personal Access Token',`);
    console.log(`  tags: ['github', 'api']`);
    console.log(`});\n`);
    
    console.log(`${colors.green}// 3. 获取敏感信息${colors.reset}`);
    console.log(`const result = await secureStorage.get('github_token', 'your_master_password');`);
    console.log(`console.log('令牌:', result.value);\n`);
    
    console.log(`${colors.green}// 4. API调用示例${colors.reset}`);
    console.log(`curl -X POST http://localhost:3000/api/secure/save \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"masterPassword": "your_password", "key": "openai_key", "value": "sk-xxx"}'`);
    
    success('安全存储迁移完成！');
    
  } catch (err) {
    error(`迁移失败: ${err.message}`);
    console.error(err.stack);
  } finally {
    rl.close();
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case '--help':
  case '-h':
    title('帮助信息');
    console.log(`${colors.cyan}使用方式:${colors.reset}`);
    console.log(`  node scripts/migrate-secure.js         运行交互式迁移工具`);
    console.log(`  node scripts/migrate-secure.js --dry   预览将要迁移的内容`);
    console.log(`  node scripts/migrate-secure.js --help  显示帮助信息`);
    console.log(`\n${colors.cyan}功能:${colors.reset}`);
    console.log('  1. 扫描环境变量中的敏感信息');
    console.log('  2. 初始化安全存储系统');
    console.log('  3. 迁移敏感信息到安全存储');
    console.log('  4. 提供安全存储使用示例');
    console.log('\n安全特性:');
    console.log('  🔒 AES-256-GCM 加密');
    console.log('  🔑 PBKDF2 密钥派生');
    console.log('  🛡️ 5次失败锁定');
    console.log('  📊 完整审计日志');
    break;
  
  case '--dry':
  case '--dry-run':
    title('预览模式');
    const envVars = loadEnvVariables();
    const sensitiveVars = detectSensitiveInfo(envVars);
    displaySensitiveInfo(sensitiveVars);
    console.log(`${colors.yellow}注意: 这是预览模式，不会执行实际迁移。${colors.reset}`);
    break;
  
  default:
    if (command) {
      error(`未知参数: ${command}`);
      console.log(`使用 ${colors.cyan}--help${colors.reset} 查看帮助信息`);
      process.exit(1);
    } else {
      migrate().catch(err => {
        error(`迁移过程出错: ${err.message}`);
        process.exit(1);
      });
    }
}

// 处理退出
process.on('exit', (code) => {
  if (code === 0) {
    success('迁移工具执行完成');
  } else {
    error(`迁移工具执行失败 (退出码: ${code})`);
  }
});