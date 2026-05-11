/** @vitest-environment node */

import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(__dirname, './fixtures/gitlab_openapi_v2.yaml');
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/gitlab-v4',
);

const normalizeNewlines = (value: string) => value.replaceAll('\r\n', '\n');

async function collectEndpointTsFiles(rootDir: string): Promise<
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

describe('generateApi snapshot gitlab v4 (anonymized fixture)', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('generates data-contracts and API client in one snapshot bundle', async () => {
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
      }),
    );

    const dataContracts = normalizeNewlines(
      await fs.readFile(path.resolve(OUTPUT_DIR, 'data-contracts.ts'), 'utf-8'),
    );

    const endpointsDir = path.resolve(OUTPUT_DIR, 'endpoints');
    const endpointFiles = await collectEndpointTsFiles(endpointsDir);
    const endpointsBundle = endpointFiles
      .map(
        (file) =>
          [
            `/* --- endpoints/${file.relativePath} --- */`,
            normalizeNewlines(file.content),
            '',
          ].join('\n'),
      )
      .join('\n');

    const combined = [
      '/* --- data-contracts.ts --- */',
      dataContracts,
      '',
      '/* --- endpoints/**/*.ts --- */',
      endpointsBundle,
    ].join('\n');

    expect(combined).toMatchSnapshot();
  });
});
