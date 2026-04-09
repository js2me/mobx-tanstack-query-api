import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      'mobx-tanstack-query-api': path.resolve(rootDir, 'src/index.ts'),
      'mobx-tanstack-query-api/builtin': path.resolve(
        rootDir,
        'src/builtin/index.ts',
      ),
      'mobx-tanstack-query-api/cli': path.resolve(rootDir, 'src/cli/index.ts'),
      'mobx-tanstack-query-api/bin': path.resolve(rootDir, 'src/bin/index.ts'),
      'mobx-tanstack-query-api/testing': path.resolve(
        rootDir,
        'src/testing/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    testTimeout: 30_000,
    environment: 'jsdom',
    coverage: {
      provider: 'istanbul', // or 'v8'
      include: ['src'],
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
