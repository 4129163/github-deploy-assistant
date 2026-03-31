/**
 * 简单的 exec Promise 封装（供 updater.js 使用）
 */
const { exec } = require('child_process');

function execPromise(command, cwd) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

module.exports = { execPromise };
