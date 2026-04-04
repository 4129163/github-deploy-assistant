const fs = require('fs-extra');
const path = require('path');
const { execSync, spawn } = require('child_process');
const tmp = require('tmp-promise');

/**
 * 测试辅助工具类
 */
class TestHelpers {
  /**
   * 创建临时项目目录
   * @param {Object} options 配置选项
   * @returns {Promise<Object>} 临时目录信息
   */
  static async createTempProject(options = {}) {
    const {
      name = 'test-project',
      type = 'node',
      port = 3001,
      dependencies = {}
    } = options;

    // 创建临时目录
    const tmpDir = await tmp.dir({ unsafeCleanup: true });
    const projectPath = tmpDir.path;

    // 创建package.json
    const packageJson = {
      name,
      version: '1.0.0',
      description: 'Test project for integration testing',
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        test: 'echo "No tests" && exit 0'
      },
      dependencies: {
        express: '^4.18.2',
        ...dependencies
      }
    };

    await fs.writeJson(path.join(projectPath, 'package.json'), packageJson, { spaces: 2 });

    // 创建index.js文件
    const indexContent = `
const express = require('express');
const app = express();
const PORT = ${port};

app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello from test project',
    project: '${name}',
    status: 'running'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`Test project running on http://localhost:\${PORT}\`);
});
`;

    await fs.writeFile(path.join(projectPath, 'index.js'), indexContent);

    // 创建README.md
    await fs.writeFile(
      path.join(projectPath, 'README.md'),
      `# ${name}\n\nTest project for integration testing\n`
    );

    return {
      path: projectPath,
      name,
      type,
      port,
      cleanup: tmpDir.cleanup
    };
  }

  /**
   * 启动测试服务器
   * @param {number} port 端口号
   * @returns {Promise<Object>} 服务器信息
   */
  static async startTestServer(port = 3000) {
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', ['server.js'], {
        env: { ...process.env, PORT: port.toString() },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      serverProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.includes('Server running on port')) {
          resolve({
            process: serverProcess,
            port,
            stop: () => serverProcess.kill()
          });
        }
      });

      serverProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      serverProcess.on('error', reject);

      // 超时处理
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill();
          reject(new Error('Server startup timeout'));
        }
      }, 30000);
    });
  }

  /**
   * 执行命令并返回结果
   * @param {string} command 命令
   * @param {string} cwd 工作目录
   * @returns {Promise<string>} 命令输出
   */
  static async execCommand(command, cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
      try {
        const output = execSync(command, { cwd, encoding: 'utf8' });
        resolve(output);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 等待条件满足
   * @param {Function} condition 条件函数
   * @param {number} timeout 超时时间(毫秒)
   * @param {number} interval 检查间隔(毫秒)
   * @returns {Promise<void>}
   */
  static async waitFor(condition, timeout = 10000, interval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition();
        if (result) return;
      } catch (error) {
        // 忽略条件检查中的错误
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  }

  /**
   * 生成随机字符串
   * @param {number} length 长度
   * @returns {string} 随机字符串
   */
  static generateRandomString(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

module.exports = TestHelpers;