/**
 * 加密工具模块
 * 使用Node.js内置crypto模块提供AES-256-GCM加密
 */

const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

class CryptoUtils {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256位
    this.ivLength = 16; // 128位
    this.authTagLength = 16;
  }

  /**
   * 生成加密密钥
   * @param {string} password - 用户密码
   * @param {string} salt - 盐值
   * @returns {Buffer} - 加密密钥
   */
  generateKey(password, salt) {
    return crypto.pbkdf2Sync(
      password,
      salt,
      100000, // 迭代次数
      this.keyLength,
      'sha256'
    );
  }

  /**
   * 生成随机盐值
   * @returns {string} - 16字节十六进制盐值
   */
  generateSalt() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 加密数据
   * @param {string} data - 要加密的数据
   * @param {string} password - 密码
   * @param {string} salt - 盐值（可选）
   * @returns {Object} - 包含加密数据、盐值、IV和认证标签的对象
   */
  encrypt(data, password, salt = null) {
    // 生成盐值（如果未提供）
    const usedSalt = salt || this.generateSalt();
    
    // 生成密钥
    const key = this.generateKey(password, usedSalt);
    
    // 生成随机IV
    const iv = crypto.randomBytes(this.ivLength);
    
    // 创建加密器
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    // 加密数据
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 获取认证标签
    const authTag = cipher.getAuthTag().toString('hex');
    
    return {
      encrypted,
      salt: usedSalt,
      iv: iv.toString('hex'),
      authTag
    };
  }

  /**
   * 解密数据
   * @param {Object} encryptedData - 加密数据对象
   * @param {string} password - 密码
   * @returns {string} - 解密后的数据
   */
  decrypt(encryptedData, password) {
    const { encrypted, salt, iv, authTag } = encryptedData;
    
    // 生成密钥
    const key = this.generateKey(password, salt);
    
    // 创建解密器
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, 'hex')
    );
    
    // 设置认证标签
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    // 解密数据
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * 验证数据完整性
   * @param {Object} encryptedData - 加密数据对象
   * @param {string} password - 密码
   * @returns {boolean} - 数据是否完整
   */
  verify(encryptedData, password) {
    try {
      this.decrypt(encryptedData, password);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成安全的主密钥文件
   * @param {string} filePath - 密钥文件路径
   * @param {string} masterPassword - 主密码
   * @returns {Object} - 生成的密钥信息
   */
  generateMasterKey(filePath, masterPassword) {
    // 生成随机主密钥
    const masterKey = crypto.randomBytes(32).toString('hex');
    
    // 生成随机盐值
    const salt = this.generateSalt();
    
    // 加密主密钥
    const encryptedMasterKey = this.encrypt(masterKey, masterPassword, salt);
    
    // 保存到文件
    fs.writeJsonSync(filePath, {
      masterKey: encryptedMasterKey,
      createdAt: new Date().toISOString(),
      algorithm: this.algorithm
    }, { spaces: 2 });
    
    return {
      masterKey,
      salt,
      filePath
    };
  }

  /**
   * 加载主密钥
   * @param {string} filePath - 密钥文件路径
   * @param {string} masterPassword - 主密码
   * @returns {string} - 解密后的主密钥
   */
  loadMasterKey(filePath, masterPassword) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`密钥文件不存在: ${filePath}`);
    }
    
    const keyData = fs.readJsonSync(filePath);
    return this.decrypt(keyData.masterKey, masterPassword);
  }

  /**
   * 加密JSON对象
   * @param {Object} data - JSON对象
   * @param {string} password - 密码
   * @returns {Object} - 加密后的数据
   */
  encryptObject(data, password) {
    const jsonString = JSON.stringify(data);
    return this.encrypt(jsonString, password);
  }

  /**
   * 解密JSON对象
   * @param {Object} encryptedData - 加密数据对象
   * @param {string} password - 密码
   * @returns {Object} - 解密后的JSON对象
   */
  decryptObject(encryptedData, password) {
    const jsonString = this.decrypt(encryptedData, password);
    return JSON.parse(jsonString);
  }

  /**
   * 生成安全令牌
   * @param {number} length - 令牌长度
   * @returns {string} - 安全令牌
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 计算数据的哈希值
   * @param {string} data - 数据
   * @param {string} algorithm - 哈希算法（默认sha256）
   * @returns {string} - 哈希值
   */
  hash(data, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * 比较哈希值
   * @param {string} data - 数据
   * @param {string} hash - 哈希值
   * @param {string} algorithm - 哈希算法
   * @returns {boolean} - 是否匹配
   */
  compareHash(data, hash, algorithm = 'sha256') {
    return this.hash(data, algorithm) === hash;
  }
}

module.exports = new CryptoUtils();