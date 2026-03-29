/**
 * 端口管理工具
 */

const net = require('net');

/**
 * 检测端口是否被占用
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * 找到从 startPort 开始第一个可用端口
 */
async function findAvailablePort(startPort = 3000, maxTries = 100) {
  for (let port = startPort; port < startPort + maxTries; port++) {
    const inUse = await isPortInUse(port);
    if (!inUse) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

module.exports = { isPortInUse, findAvailablePort };
