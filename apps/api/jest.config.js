/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/jest-setup.ts'],
  globalSetup: '<rootDir>/test/jest.global-setup.js',
  // Serialize suites so the shared Postgres/Redis and per-IP rate limits don't
  // collide across the two e2e suites.
  maxWorkers: 1,
  testTimeout: 30000,
};
