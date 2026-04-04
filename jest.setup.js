// Jest setup file
// This file runs before each test file

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Keep error and warn for actual errors
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Clean up after tests
afterEach(async () => {
  // Clean up any temporary files or mocks
  jest.clearAllMocks();
});