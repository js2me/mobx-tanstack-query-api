import { defineConfig } from "vitest/config";
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [swc.vite({})], 
  test: {
    globals: true,
    environment: "jsdom",
    // pool: 'forks',
    // poolOptions: {
    //   forks: {
    //     execArgv: [
    //       '--cpu-prof',
    //       '--cpu-prof-dir=test-runner-profile',
    //       '--heap-prof',
    //       '--heap-prof-dir=test-runner-profile'
    //     ],

    //     // To generate a single profile
    //     singleFork: true,
    //   },
    // },
    coverage: {
      provider: 'istanbul', // or 'v8'
      include: ['src'],
      exclude: ['src/preset'],
      reporter: [
        'text',
        'text-summary',
        'html'
      ],
      reportsDirectory: './coverage'
    },
  },
});