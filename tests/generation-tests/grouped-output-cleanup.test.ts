import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(
  __dirname,
  './fluffy-duplicate-data-types.swagger2.json',
);
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/grouped-output-cleanup',
);

describe('grouped output cleanup', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('removes stale flat endpoints folder when groupBy is enabled', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
      }),
    );

    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        groupBy: 'path-segment-2',
      }),
    );

    await expect(
      fs.stat(path.resolve(OUTPUT_DIR, 'endpoints')),
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });

    await expect(
      fs.stat(path.resolve(OUTPUT_DIR, 'fluffies', 'endpoints', 'merge-fluffy.ts')),
    ).resolves.toBeTruthy();
  });
});
