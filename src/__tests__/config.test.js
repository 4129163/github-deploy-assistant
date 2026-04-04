const config = require('../config');

describe('Configuration Module', () => {
  test('should have all required configuration properties', () => {
    expect(config).toHaveProperty('PORT');
    expect(config).toHaveProperty('WORK_DIR');
    expect(config).toHaveProperty('ALLOW_AUTO_EXEC');
    expect(config).toHaveProperty('LOG_LEVEL');
    expect(config).toHaveProperty('DEFAULT_AI_PROVIDER');
    expect(config).toHaveProperty('DB_PATH');
    expect(config).toHaveProperty('LOGS_DIR');
    expect(config).toHaveProperty('GADA_SECRET_KEY');
    expect(config).toHaveProperty('LOG_CACHE_SIZE');
    expect(config).toHaveProperty('LOG_CACHE_TTL');
    expect(config).toHaveProperty('PROCESS_RESTART_MAX_WAIT');
    expect(config).toHaveProperty('PROCESS_RESTART_DELAY');
  });

  test('should have correct default values', () => {
    expect(config.PORT).toBe(3456);
    expect(config.ALLOW_AUTO_EXEC).toBe(true);
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.DEFAULT_AI_PROVIDER).toBe('openai');
    expect(config.LOG_CACHE_SIZE).toBe(200);
    expect(config.LOG_CACHE_TTL).toBe(3600000);
    expect(config.PROCESS_RESTART_MAX_WAIT).toBe(10000);
    expect(config.PROCESS_RESTART_DELAY).toBe(500);
  });

  test('WORK_DIR should be a string', () => {
    expect(typeof config.WORK_DIR).toBe('string');
    expect(config.WORK_DIR).toContain('workspace');
  });

  test('DB_PATH should be a string', () => {
    expect(typeof config.DB_PATH).toBe('string');
    expect(config.DB_PATH).toContain('database');
  });

  test('LOGS_DIR should be a string', () => {
    expect(typeof config.LOGS_DIR).toBe('string');
    expect(config.LOGS_DIR).toContain('logs');
  });
});