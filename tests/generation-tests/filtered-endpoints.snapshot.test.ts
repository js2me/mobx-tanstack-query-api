/** @vitest-environment node */

import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(__dirname, './fixtures/big-schema.openapi.yaml');
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/filtered-endpoints-snapshot',
);

const normalizeNewlines = (value: string) => value.replaceAll('\r\n', '\n');

async function collectAllTsFiles(rootDir: string): Promise<
  { relativePath: string; content: string }[]
> {
  const results: { relativePath: string; content: string }[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        const relativePath = path.relative(rootDir, fullPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        results.push({
          relativePath: relativePath.replace(/\\/g, '/'),
          content,
        });
      }
    }
  }

  await walk(rootDir);
  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return results;
}

describe('generateApi snapshot filtered-endpoints (big-schema fixture)', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('generates filterd endpoints endpoints-per-file, data-contracts and meta in one snapshot bundle', async () => {
    await generateApi(
      defineConfig({
        cleanOutput: true,
        noBarrelFiles: true,
        removeUnusedTypes: false,
        outputType: 'endpoints-per-file',
        otherCodegenParams: { silent: true },
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        chooseServer: () => false,
        endpoint: 'builtin',
        filterEndpoints: (endpoint) => !!endpoint.raw.tags?.includes("tg19"),
      }),
    );

    const tsFiles = await collectAllTsFiles(OUTPUT_DIR);
    const bundle = tsFiles
      .map(
        (file) =>
          [
            `/* --- ${file.relativePath} --- */`,
            normalizeNewlines(file.content),
            '',
          ].join('\n'),
      )
      .join('\n');

    expect(bundle).toMatchSnapshot();
  });
});
