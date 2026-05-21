/** @vitest-environment node */

import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(__dirname, './fixtures/enum-style.openapi.json');

const normalizeNewlines = (value: string) => value.replaceAll('\r\n', '\n');

async function generateAndReadDataContracts(
  enumStyle: 'union' | 'const' | 'enum',
): Promise<string> {
  const outputDir = path.resolve(
    __dirname,
    `./__generated__/enum-style-${enumStyle}`,
  );

  await generateApi(
    defineConfig({
      cleanOutput: true,
      noBarrelFiles: true,
      removeUnusedTypes: false,
      outputType: 'one-endpoint-per-file',
      input: INPUT_FILE,
      output: outputDir,
      chooseServer: () => false,
      endpoint: 'builtin',
      filterEndpoints: [/^listPets$/i],
      otherCodegenParams: {
        silent: true,
        enumStyle,
      },
    }),
  );

  return normalizeNewlines(
    await fs.readFile(path.join(outputDir, 'data-contracts.ts'), 'utf-8'),
  );
}

describe('generateApi snapshot enumStyle (otherCodegenParams)', () => {
  beforeEach(async () => {
    await fs.rm(path.resolve(__dirname, './__generated__/enum-style-union'), {
      recursive: true,
      force: true,
    });
    await fs.rm(path.resolve(__dirname, './__generated__/enum-style-const'), {
      recursive: true,
      force: true,
    });
    await fs.rm(path.resolve(__dirname, './__generated__/enum-style-enum'), {
      recursive: true,
      force: true,
    });
  });

  it('generates data-contracts with otherCodegenParams.enumStyle: union', async () => {
    expect(await generateAndReadDataContracts('union')).toMatchSnapshot();
  });

  it('generates data-contracts with otherCodegenParams.enumStyle: const', async () => {
    expect(await generateAndReadDataContracts('const')).toMatchSnapshot();
  });

  it('generates data-contracts with otherCodegenParams.enumStyle: enum', async () => {
    expect(await generateAndReadDataContracts('enum')).toMatchSnapshot();
  });
});
