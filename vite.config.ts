import { reactRouter } from '@react-router/dev/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';
import tsconfigPaths from 'vite-tsconfig-paths';

const ignoredGeneratedPaths = [
  'node_modules/**',
  'build/**',
  '.context/**',
  '.react-router/**',
  '.sst/**',
  '.pnpm-store/**',
  'coverage/**',
  'playwright-report/**',
  'test-results/**',
];

const isTestCommand = process.env.VITE_PLUS_TEST === '1';

export default defineConfig({
  plugins: [isTestCommand ? react() : reactRouter(), tsconfigPaths()],
  fmt: {
    ignorePatterns: ignoredGeneratedPaths,
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    useTabs: false,
  },
  lint: {
    categories: {
      correctness: 'error',
      suspicious: 'error',
    },
    ignorePatterns: ignoredGeneratedPaths,
    rules: {
      'eslint/no-empty-pattern': 'off',
      'eslint/no-new': 'off',
      'eslint/no-shadow': 'off',
      'eslint/no-template-curly-in-string': 'off',
      'eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'eslint/no-useless-constructor': 'off',
      'typescript/no-explicit-any': 'off',
      'typescript/no-non-null-assertion': 'off',
      'typescript/triple-slash-reference': 'off',
      'unicorn/consistent-function-scoping': 'off',
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    environment: 'jsdom',
    exclude: ['.pnpm-store/**', 'node_modules/**'],
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
