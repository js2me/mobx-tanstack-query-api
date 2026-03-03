import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'istanbul', // or 'v8'
      include: ['src'],
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
