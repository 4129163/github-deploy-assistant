#!/usr/bin/env node

/**
 * TypeScript 类型检查脚本
 * 用于在 JavaScript 项目中执行类型检查
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function info(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function warning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// 检查配置文件是否存在
function checkConfigFiles() {
  const requiredFiles = [
    'tsconfig.json',
    'jsconfig.json',
    'types/index.d.ts'
  ];
  
  const missingFiles = [];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(__dirname, '..', file))) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    error(`缺少必要的配置文件: ${missingFiles.join(', ')}`);
    process.exit(1);
  }
  
  success('所有配置文件检查通过');
}

// 运行 TypeScript 编译器进行类型检查
function runTypeCheck() {
  return new Promise((resolve, reject) => {
    info('开始类型检查...');
    
    const tsc = spawn('npx', ['tsc', '--noEmit', '--project', 'tsconfig.json'], {
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    
    let output = '';
    let errorOutput = '';
    
    tsc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    tsc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    tsc.on('close', (code) => {
      if (code === 0) {
        success('类型检查通过！');
        resolve(true);
      } else {
        error('类型检查失败！');
        
        // 格式化输出错误信息
        const lines = (output + errorOutput).split('\n');
        const errors = lines.filter(line => 
          line.includes('error') || 
          line.includes('Error') || 
          line.includes('TS')
        );
        
        if (errors.length > 0) {
          console.log('\n错误详情:');
          errors.forEach(err => {
            console.log(`${colors.red}  ${err}${colors.reset}`);
          });
        }
        
        reject(new Error('类型检查失败'));
      }
    });
    
    tsc.on('error', (err) => {
      error(`无法启动 TypeScript 编译器: ${err.message}`);
      reject(err);
    });
  });
}

// 检查 JSDoc 注释
function checkJSDoc() {
  return new Promise((resolve, reject) => {
    info('检查 JSDoc 注释...');
    
    // 需要检查的文件
    const filesToCheck = [
      'src/utils/error-handler.js',
      'src/utils/performance-monitor.js',
      'src/middleware/unified-error-handler.js',
      'src/utils/advanced-performance-monitor.js',
      'server.js'
    ];
    
    const missingJSDoc = [];
    
    for (const file of filesToCheck) {
      const filePath = path.join(__dirname, '..', file);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 检查是否包含 JSDoc 注释
        if (!content.includes('/**')) {
          missingJSDoc.push(file);
        }
      }
    }
    
    if (missingJSDoc.length > 0) {
      warning(`以下文件缺少 JSDoc 注释: ${missingJSDoc.join(', ')}`);
    } else {
      success('JSDoc 注释检查通过');
    }
    
    resolve();
  });
}

// 生成类型报告
function generateTypeReport() {
  return new Promise((resolve, reject) => {
    info('生成类型报告...');
    
    const report = {
      timestamp: new Date().toISOString(),
      files: {
        total: 0,
        withTypes: 0,
        withoutTypes: 0
      },
      types: {
        defined: 0,
        used: 0
      },
      issues: []
    };
    
    // 扫描 src 目录
    const srcDir = path.join(__dirname, '..', 'src');
    
    function scanDirectory(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        
        if (file.isDirectory()) {
          scanDirectory(fullPath);
        } else if (file.name.endsWith('.js')) {
          report.files.total++;
          
          const content = fs.readFileSync(fullPath, 'utf8');
          
          // 检查是否有类型注释
          if (content.includes('@type') || content.includes('@param') || content.includes('@returns')) {
            report.files.withTypes++;
          } else {
            report.files.withoutTypes++;
            report.issues.push({
              file: path.relative(path.join(__dirname, '..'), fullPath),
              issue: '缺少类型注释'
            });
          }
          
          // 检查类型使用
          if (content.includes('require(') && content.includes('@types/')) {
            report.types.used++;
          }
        }
      }
    }
    
    if (fs.existsSync(srcDir)) {
      scanDirectory(srcDir);
    }
    
    // 计算类型覆盖率
    const typeCoverage = report.files.total > 0 
      ? (report.files.withTypes / report.files.total) * 100 
      : 0;
    
    console.log('\n类型报告:');
    console.log(`  总文件数: ${report.files.total}`);
    console.log(`  有类型文件: ${report.files.withTypes}`);
    console.log(`  无类型文件: ${report.files.withoutTypes}`);
    console.log(`  类型覆盖率: ${typeCoverage.toFixed(2)}%`);
    
    if (report.issues.length > 0) {
      console.log('\n需要改进的文件:');
      report.issues.forEach(issue => {
        console.log(`  ${colors.yellow}${issue.file}: ${issue.issue}${colors.reset}`);
      });
    }
    
    // 保存报告
    const reportFile = path.join(__dirname, '..', 'type-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    success(`类型报告已保存到: ${reportFile}`);
    
    resolve(report);
  });
}

// 主函数
async function main() {
  try {
    log('cyan', '🚀 GitHub Deploy Assistant 类型检查工具');
    log('cyan', '========================================\n');
    
    // 检查配置文件
    checkConfigFiles();
    
    // 运行类型检查
    await runTypeCheck();
    
    // 检查 JSDoc
    await checkJSDoc();
    
    // 生成报告
    await generateTypeReport();
    
    log('green', '\n🎉 所有类型检查完成！');
    process.exit(0);
    
  } catch (err) {
    error(`类型检查失败: ${err.message}`);
    process.exit(1);
  }
}

// 处理命令行参数
const args = process.argv.slice(2);
const command = args[0];

if (command === '--help' || command === '-h') {
  console.log(`
GitHub Deploy Assistant 类型检查工具

用法:
  node scripts/type-check.js [选项]

选项:
  --help, -h     显示帮助信息
  --report       仅生成类型报告
  --check        仅检查配置文件
  --jsdoc        仅检查 JSDoc 注释

示例:
  node scripts/type-check.js           # 运行完整类型检查
  node scripts/type-check.js --report  # 仅生成类型报告
  `);
  process.exit(0);
}

if (command === '--report') {
  generateTypeReport().then(() => process.exit(0)).catch(() => process.exit(1));
} else if (command === '--check') {
  checkConfigFiles();
  process.exit(0);
} else if (command === '--jsdoc') {
  checkJSDoc().then(() => process.exit(0)).catch(() => process.exit(1));
} else {
  main();
}