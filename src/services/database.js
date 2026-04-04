/**
 * SQLite 数据库服务
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { DB_PATH } = require('../config');

let db = null;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // 开启 WAL 模式（提升并发写入性能，防止 SQLITE_BUSY）
      db.run('PRAGMA journal_mode = WAL;');
      // 设置忙等超时 5 秒，高并发时自动重试而非立即报错
      db.run('PRAGMA busy_timeout = 5000;');
      // 提升写入安全性
      db.run('PRAGMA synchronous = NORMAL;');
      db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          repo_url TEXT NOT NULL,
          local_path TEXT,
          status TEXT DEFAULT 'pending',
          project_type TEXT,
          config TEXT,
          notes TEXT DEFAULT '',
          tags TEXT DEFAULT '',
          port INTEGER,
          health_url TEXT,
          cpu_limit REAL DEFAULT NULL,
          memory_limit_mb INTEGER DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // 迁移：为旧数据库添加新字段（忽略已存在错误）
      ['notes TEXT DEFAULT \"\"', 'tags TEXT DEFAULT \"\"', 'port INTEGER', 'health_url TEXT', 'cpu_limit REAL DEFAULT NULL', 'memory_limit_mb INTEGER DEFAULT NULL'].forEach(col => {
        db.run(`ALTER TABLE projects ADD COLUMN ${col}`, () => {});
      });
      
      // 创建部署日志表
      db.run(`
        CREATE TABLE IF NOT EXISTS deploy_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          mode TEXT,
          status TEXT,
          output TEXT,
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);
      
      // 创建配置表
      db.run(`
        CREATE TABLE IF NOT EXISTS configs (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // 创建对话记录表
      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          role TEXT,
          content TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);
      
      // 创建部署诊断表（AI智能诊断闭环功能）
      db.run(`
        CREATE TABLE IF NOT EXISTS deployment_diagnoses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          deployment_id INTEGER,
          error_log TEXT NOT NULL,
          failed_command TEXT NOT NULL,
          ai_diagnosis TEXT NOT NULL,
          applied_fix TEXT,
          fix_result TEXT,
          risk_level TEXT CHECK(risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
          status TEXT CHECK(status IN ('PENDING', 'ANALYZED', 'CONFIRMED', 'APPLIED', 'SUCCESS', 'FAILED', 'ROLLED_BACK')) DEFAULT 'PENDING',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects (id),
          FOREIGN KEY (deployment_id) REFERENCES deploy_logs (id)
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

// 项目相关操作
const ProjectDB = {
  create: (project) => {
    return new Promise((resolve, reject) => {
      const { name, repo_url, local_path, project_type, config } = project;
      db.run(
        'INSERT INTO projects (name, repo_url, local_path, project_type, config) VALUES (?, ?, ?, ?, ?)',
        [name, repo_url, local_path, project_type, JSON.stringify(config)],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...project });
        }
      );
    });
  },
  
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM projects ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => ({ ...r, config: r.config ? JSON.parse(r.config) : null })));
      });
    });
  },
  
  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM projects WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (row) {
          resolve({ ...row, config: row.config ? JSON.parse(row.config) : null });
        } else {
          resolve(null);
        }
      });
    });
  },
  
  update: (id, updates) => {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(updates)) {
        if (key === 'config') {
          fields.push(`${key} = ?`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
      
      values.push(id);
      
      db.run(
        `UPDATE projects SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },
  
  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM projects WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  getByName: (name) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM projects WHERE name = ? ORDER BY created_at DESC LIMIT 1', [name], (err, row) => {
        if (err) reject(err);
        else if (row) resolve({ ...row, config: row.config ? JSON.parse(row.config) : null });
        else resolve(null);
      });
    });
  }
};

// 部署日志相关操作
const DeployLogDB = {
  create: (log) => {
    return new Promise((resolve, reject) => {
      const { project_id, mode, status, output, error } = log;
      db.run(
        'INSERT INTO deploy_logs (project_id, mode, status, output, error) VALUES (?, ?, ?, ?, ?)',
        [project_id, mode, status, output, error],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...log });
        }
      );
    });
  },
  
  getByProjectId: (projectId) => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM deploy_logs WHERE project_id = ? ORDER BY created_at DESC',
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
};

// 配置相关操作
const ConfigDB = {
  get: (key) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT value FROM configs WHERE key = ?', [key], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
  },
  
  set: (key, value) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO configs (key, value) VALUES (?, ?)',
        [key, value],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
};

// 对话记录相关操作
const ConversationDB = {
  create: (conversation) => {
    return new Promise((resolve, reject) => {
      const { project_id, role, content } = conversation;
      db.run(
        'INSERT INTO conversations (project_id, role, content) VALUES (?, ?, ?)',
        [project_id, role, content],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...conversation });
        }
      );
    });
  },
  
  getByProjectId: (projectId) => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM conversations WHERE project_id = ? ORDER BY created_at ASC',
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
};

// 对话相关扩展（在 module.exports 之前，确保导出时已包含这些方法）
Object.assign(ConversationDB, {
  clearByProjectId: (projectId) => {
    return new Promise((resolve, reject) => {
      const d = getDb();
      d.run('DELETE FROM conversations WHERE project_id = ?', [projectId], (err) => {
        if (err) reject(err); else resolve();
      });
    });
  },
  // 只返回最近 N 条，避免历史过长
  getRecentByProjectId: (projectId, limit = 20) => {
    return new Promise((resolve, reject) => {
      const d = getDb();
      d.all(
        'SELECT * FROM (SELECT * FROM conversations WHERE project_id = ? ORDER BY created_at DESC LIMIT ?) ORDER BY created_at ASC',
        [projectId, limit],
        (err, rows) => { if (err) reject(err); else resolve(rows || []); }
      );
    });
  }
});

// 部署诊断相关操作
const DeploymentDiagnosisDB = {
  create: (diagnosis) => {
    return new Promise((resolve, reject) => {
      const {
        project_id,
        deployment_id,
        error_log,
        failed_command,
        ai_diagnosis,
        risk_level = 'MEDIUM',
        status = 'PENDING'
      } = diagnosis;
      
      db.run(
        `INSERT INTO deployment_diagnoses 
        (project_id, deployment_id, error_log, failed_command, ai_diagnosis, risk_level, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [project_id, deployment_id, error_log, failed_command, JSON.stringify(ai_diagnosis), risk_level, status],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...diagnosis });
        }
      );
    });
  },
  
  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM deployment_diagnoses WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (row) {
          resolve({
            ...row,
            ai_diagnosis: row.ai_diagnosis ? JSON.parse(row.ai_diagnosis) : null,
            applied_fix: row.applied_fix ? JSON.parse(row.applied_fix) : null,
            fix_result: row.fix_result ? JSON.parse(row.fix_result) : null
          });
        } else {
          resolve(null);
        }
      });
    });
  },
  
  getByProjectId: (projectId, limit = 20) => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM deployment_diagnoses WHERE project_id = ? ORDER BY created_at DESC LIMIT ?',
        [projectId, limit],
        (err, rows) => {
          if (err) reject(err);
          else {
            resolve(rows.map(row => ({
              ...row,
              ai_diagnosis: row.ai_diagnosis ? JSON.parse(row.ai_diagnosis) : null,
              applied_fix: row.applied_fix ? JSON.parse(row.applied_fix) : null,
              fix_result: row.fix_result ? JSON.parse(row.fix_result) : null
            })));
          }
        }
      );
    });
  },
  
  updateStatus: (id, status, data = {}) => {
    return new Promise((resolve, reject) => {
      const updates = [];
      const values = [];
      
      updates.push('status = ?');
      values.push(status);
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      
      if (data.applied_fix !== undefined) {
        updates.push('applied_fix = ?');
        values.push(JSON.stringify(data.applied_fix));
      }
      
      if (data.fix_result !== undefined) {
        updates.push('fix_result = ?');
        values.push(JSON.stringify(data.fix_result));
      }
      
      if (data.risk_level !== undefined) {
        updates.push('risk_level = ?');
        values.push(data.risk_level);
      }
      
      values.push(id);
      
      db.run(
        `UPDATE deployment_diagnoses SET ${updates.join(', ')} WHERE id = ?`,
        values,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },
  
  getRecentUnresolved: (projectId, hours = 24) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM deployment_diagnoses 
         WHERE project_id = ? 
         AND status IN ('PENDING', 'ANALYZED', 'CONFIRMED')
         AND created_at >= datetime('now', ?) 
         ORDER BY created_at DESC`,
        [projectId, `-${hours} hours`],
        (err, rows) => {
          if (err) reject(err);
          else {
            resolve(rows.map(row => ({
              ...row,
              ai_diagnosis: row.ai_diagnosis ? JSON.parse(row.ai_diagnosis) : null,
              applied_fix: row.applied_fix ? JSON.parse(row.applied_fix) : null,
              fix_result: row.fix_result ? JSON.parse(row.fix_result) : null
            })));
          }
        }
      );
    });
  }
};

module.exports = {
  initDatabase,
  getDb,
  ProjectDB,
  DeployLogDB,
  ConfigDB,
  ConversationDB,
  DeploymentDiagnosisDB
};
