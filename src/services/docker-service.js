/**
 * Docker 容器化服务
 * - 检测项目是否已有 Dockerfile / docker-compose.yml
 * - AI 生成 Dockerfile
 * - 构建镜像
 * - 运行/停止/删除容器
 * - 查看容器日志
 */

const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const { logger } = require('../utils/logger');
const { WORK_DIR } = require('../config');

/**
 * 检测项目容器化状态
 */
async function detectContainerStatus(localPath) {
  const hasDockerfile = await fs.pathExists(path.join(localPath, 'Dockerfile'));
  const hasCompose = await fs.pathExists(path.join(localPath, 'docker-compose.yml')) ||
                     await fs.pathExists(path.join(localPath, 'docker-compose.yaml')) ||
                     await fs.pathExists(path.join(localPath, 'compose.yml'));
  const hasDockerIgnore = await fs.pathExists(path.join(localPath, '.dockerignore'));
  return { hasDockerfile, hasCompose, hasDockerIgnore };
}

/**
 * 读取项目信息用于 AI 生成 Dockerfile
 */
async function collectProjectInfo(localPath, types) {
  const info = { types, files: [] };
  const checks = [
    'package.json', 'requirements.txt', 'pyproject.toml',
    'Pipfile', 'go.mod', 'Cargo.toml', 'pom.xml',
    'build.gradle', '.nvmrc', '.python-version',
  ];
  for (const f of checks) {
    if (await fs.pathExists(path.join(localPath, f))) {
      info.files.push(f);
      if (f === 'package.json') {
        try {
          const pkg = await fs.readJson(path.join(localPath, f));
          info.packageJson = {
            name: pkg.name,
            main: pkg.main,
            scripts: pkg.scripts,
            engines: pkg.engines,
          };
        } catch (_) {}
      }
    }
  }
  // 列出顶层目录结构
  try {
    const entries = await fs.readdir(localPath);
    info.topLevel = entries.filter(e => !e.startsWith('.')).slice(0, 20);
  } catch (_) {}
  return info;
}

/**
 * 调用 AI 生成 Dockerfile
 */
async function generateDockerfile(project, aiConfig) {
  const { local_path, name, project_type } = project;
  const types = project_type ? project_type.split(',') : [];
  const info = await collectProjectInfo(local_path, types);

  const prompt = `你是 Docker 专家。请根据以下项目信息生成一个生产就绪的 Dockerfile。

项目名称: ${name}
项目类型: ${types.join(', ') || '未知'}
检测到的文件: ${info.files.join(', ') || '无'}
顶层目录: ${(info.topLevel || []).join(', ')}
${info.packageJson ? `package.json 信息: ${JSON.stringify(info.packageJson, null, 2)}` : ''}

要求：
1. 使用多阶段构建（如适用）减小镜像大小
2. 使用官方基础镜像，选择 slim/alpine 变体
3. 以非 root 用户运行
4. 正确设置 WORKDIR、COPY、RUN、EXPOSE、CMD
5. 添加 .dockerignore 内容建议（作为注释）
6. 只输出 Dockerfile 内容，不要任何解释

直接输出 Dockerfile，不要 Markdown 代码块包裹。`;

  const { chat } = require('./ai');
  const result = await chat([{ role: 'user', content: prompt }]);
  return result.trim();
}

/**
 * 生成 docker-compose.yml
 */
async function generateDockerCompose(project, port, aiConfig) {
  const { name, project_type } = project;
  const types = project_type ? project_type.split(',') : [];

  const prompt = `生成一个 docker-compose.yml 用于本地开发和部署。

项目名称: ${name}
项目类型: ${types.join(', ')}
对外端口: ${port || 3000}

要求：
1. service 名称使用项目名
2. 挂载 .env 文件（如存在）
3. 设置重启策略 unless-stopped
4. 正确映射端口
5. 只输出 docker-compose.yml 内容，不要任何解释，不要 Markdown 代码块包裹。`;

  const { chat } = require('./ai');
  const result = await chat([{ role: 'user', content: prompt }]);
  return result.trim();
}

/**
 * 将生成的文件写入项目目录
 */
async function writeDockerFiles(localPath, dockerfile, compose, overwrite = false) {
  const written = [];
  const dockerfilePath = path.join(localPath, 'Dockerfile');
  const composePath = path.join(localPath, 'docker-compose.yml');
  const ignorePath = path.join(localPath, '.dockerignore');

  if (dockerfile && (overwrite || !(await fs.pathExists(dockerfilePath)))) {
    await fs.writeFile(dockerfilePath, dockerfile, 'utf8');
    written.push('Dockerfile');
  }
  if (compose && (overwrite || !(await fs.pathExists(composePath)))) {
    await fs.writeFile(composePath, compose, 'utf8');
    written.push('docker-compose.yml');
  }
  // 生成基础 .dockerignore
  if (overwrite || !(await fs.pathExists(ignorePath))) {
    const defaultIgnore = `node_modules\n.npm\ndist\nbuild\n.env\n.env.*\n*.log\n.git\n.gitignore\n__pycache__\n*.pyc\nvenv\n.venv\n`;
    await fs.writeFile(ignorePath, defaultIgnore, 'utf8');
    written.push('.dockerignore');
  }
  return written;
}

/**
 * 执行 Docker 命令（返回 Promise，流式输出到 onLog）
 */
function runDockerCmd(args, cwd, onLog) {
  return new Promise((resolve, reject) => {
    logger.info(`[Docker] docker ${args.join(' ')}`);
    const proc = spawn('docker', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const handle = (data) => {
      const line = data.toString();
      output += line;
      if (onLog) onLog(line.trim());
      logger.info(`[Docker] ${line.trim()}`);
    };
    proc.stdout.on('data', handle);
    proc.stderr.on('data', handle);
    proc.on('close', (code) => {
      if (code === 0) resolve({ success: true, output });
      else reject(new Error(`docker ${args[0]} 失败 (exit ${code})\n${output.slice(-500)}`));
    });
    proc.on('error', (err) => reject(new Error(`无法执行 docker 命令: ${err.message}`)));
  });
}

/**
 * 构建 Docker 镜像
 */
async function buildImage(project, onLog) {
  const { local_path, name } = project;
  const tag = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (onLog) onLog(`🔨 构建镜像 ${tag}:latest ...`);
  await runDockerCmd(['build', '-t', `${tag}:latest`, '.'], local_path, onLog);
  if (onLog) onLog(`✅ 镜像构建成功: ${tag}:latest`);
  return { tag: `${tag}:latest` };
}

/**
 * 用 docker run 启动容器（如已存在则先删除）
 */
async function runContainer(project, port, onLog) {
  const { name } = project;
  const tag = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const containerName = `gada-${tag}`;

  // 清理旧容器
  try {
    await runDockerCmd(['rm', '-f', containerName], process.cwd(), null);
  } catch (_) {}

  const hostPort = port || 3000;
  if (onLog) onLog(`🚀 启动容器 ${containerName} (port ${hostPort})...`);
  await runDockerCmd([
    'run', '-d',
    '--name', containerName,
    '--restart', 'unless-stopped',
    '-p', `${hostPort}:${hostPort}`,
    '--env-file', '.env',
    `${tag}:latest`,
  ], project.local_path, onLog);
  if (onLog) onLog(`✅ 容器已启动: ${containerName}`);
  return { containerName, hostPort };
}

/**
 * 停止并删除容器
 */
async function stopContainer(project, onLog) {
  const tag = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const containerName = `gada-${tag}`;
  if (onLog) onLog(`🛑 停止容器 ${containerName}...`);
  try {
    await runDockerCmd(['stop', containerName], process.cwd(), null);
    await runDockerCmd(['rm', containerName], process.cwd(), null);
    if (onLog) onLog('✅ 容器已停止并删除');
    return { success: true };
  } catch (err) {
    if (onLog) onLog(`⚠️ ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * 获取容器日志
 */
async function getContainerLogs(project, lines = 100) {
  const tag = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const containerName = `gada-${tag}`;
  const logs = [];
  await runDockerCmd(['logs', '--tail', String(lines), containerName], process.cwd(), l => logs.push(l));
  return logs.join('\n');
}

/**
 * 列出 GADA 管理的容器
 */
async function listContainers() {
  const result = await runDockerCmd(
    ['ps', '-a', '--filter', 'name=gada-', '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}'],
    process.cwd(), null
  );
  return (result.output || '').trim().split('\n').filter(Boolean).map(line => {
    const [name, status, ports] = line.split('\t');
    return { name, status, ports };
  });
}

module.exports = {
  detectContainerStatus,
  generateDockerfile,
  generateDockerCompose,
  writeDockerFiles,
  buildImage,
  runContainer,
  stopContainer,
  getContainerLogs,
  listContainers,
};
