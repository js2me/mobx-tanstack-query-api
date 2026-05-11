/** @vitest-environment node */

import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateApi } from '../../src/codegen/index.js';
import { defineConfig } from '../../src/cli/utils/define-config.js';

const INPUT_FILE = path.resolve(__dirname, './fixtures/zod-wrong-imports.yaml');
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/zod-wrong-imports',
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

describe('zod wrong imports test', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });


  it('emits parseable TS: Group enum for numeric path segments and zod imports for query $ref', async () => {
    await generateApi(
      defineConfig({
        cleanOutput: true,
        noBarrelFiles: true,
        outputType: 'one-endpoint-per-file',
        otherCodegenParams: { silent: true },
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        chooseServer: () => false,
        endpoint: 'builtin',
        groupBy: 'path-segment-1',
        zodContracts: true,
      }),
    );

    const meta = await fs.readFile(
      path.join(OUTPUT_DIR, 'meta-info.ts'),
      'utf8',
    );
    expect(meta).toContain('_1 = "1"');
    expect(meta).toContain('_10 = "10"');
    expect(meta).not.toMatch(/^\s+\d+\s*=/m);

    const getTg01 = await fs.readFile(
      path.join(OUTPUT_DIR, '1', 'endpoints', 'get-tg-01.ts'),
      'utf8',
    );
    expect(getTg01).toMatch(/group:\s*Group\._1\b/);

    const getTg042 = await fs.readFile(
      path.join(OUTPUT_DIR, '8', 'endpoints', 'get-tg-042.ts'),
      'utf8',
    );
    expect(getTg042).toMatch(/group:\s*Group\._8\b/);
    expect(getTg042).toContain('schRightReporter95Dc');
    expect(getTg042).toMatch(
      /import\s*\{[^}]*\bschRightReporter95Dc\b[^}]*\}\s*from\s*["']\.\.\/\.\.\/contracts["']/,
    );

    const tsFiles = await collectAllTsFiles(OUTPUT_DIR);
    const bundle = tsFiles
      .map((file) =>
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
