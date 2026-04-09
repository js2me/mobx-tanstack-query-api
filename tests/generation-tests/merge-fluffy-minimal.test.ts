import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(
  __dirname,
  './merge-fluffy-minimal.swagger2.json',
);
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/merge-fluffy-minimal',
);
const GET_ENDPOINT_FILE = path.resolve(
  OUTPUT_DIR,
  'endpoints',
  'get-fluffies-to-merge.ts',
);
const MERGE_ENDPOINT_FILE = path.resolve(
  OUTPUT_DIR,
  'endpoints',
  'merge-fluffy.ts',
);

describe('generateApi merge-fluffy minimal', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('generates GET getFluffiesToMerge and POST mergeFluffy', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        filterEndpoints: [/^(getFluffiesToMerge|mergeFluffy)$/i],
      }),
    );

    const getContent = (
      await fs.readFile(GET_ENDPOINT_FILE, 'utf-8')
    ).replaceAll('\r\n', '\n');
    const mergeContent = (
      await fs.readFile(MERGE_ENDPOINT_FILE, 'utf-8')
    ).replaceAll('\r\n', '\n');

    expect(getContent).toMatchSnapshot();
    expect(mergeContent).toMatchSnapshot();
  });
});
