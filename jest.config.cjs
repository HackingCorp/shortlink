/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // TypeScript avec ts-jest
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Racines des tests
  roots: ['<rootDir>/__tests__'],
  
  // Dossiers à ignorer
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/out/',
    '/coverage/',
  ],
  
  // Extensions de fichiers à traiter
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Mappage des alias d'import
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/config$': '<rootDir>/config',
    '^@/prisma/(.*)$': '<rootDir>/prisma/$1',
    '^@/tests/(.*)$': '<rootDir>/__tests__/$1',
  },
  
  // Configuration de la couverture de code
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  
  // Configuration des transformations
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/__tests__/setupTests.ts'],
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
  
  // Timeout des tests
  testTimeout: 10000,
};
