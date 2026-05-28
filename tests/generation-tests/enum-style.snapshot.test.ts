/** @vitest-environment node */

import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(__dirname, './fixtures/enum-style.openapi.json');

const normalizeNewlines = (value: string) => value.replaceAll('\r\n', '\n');

async function generateEnumStyleOutput(enumStyle?: 'union' | 'const' | 'enum' | 'const-enum') {
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
      groupBy: 'path-segment-0',
      input: INPUT_FILE,
      output: outputDir,
      chooseServer: () => false,
      endpoint: 'builtin',
      filterEndpoints: [/^listPets$/i],
      enumStyle,
      otherCodegenParams: { silent: true },
    }),
  );

  const read = async (fileName: string) =>
    normalizeNewlines(
      await fs.readFile(path.join(outputDir, fileName), 'utf-8'),
    );

  const endpointFiles = await fs.readdir(path.join(outputDir, 'pets', 'endpoints'));
  const endpointFile = endpointFiles.find((name) => /list-pets/i.test(name));

  if (!endpointFile) {
    throw new Error(`listPets endpoint file not found in ${outputDir}/pets/endpoints`);
  }

  return {
    dataContracts: await read('data-contracts.ts'),
    metaInfo: await read('meta-info.ts'),
    endpoint: await read(path.join('pets', 'endpoints', endpointFile)),
  };
}

describe('generateApi snapshot enumStyle', () => {
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


  it('generates data-contracts with enumStyle: <not defined>', async () => {
    const output = await generateEnumStyleOutput();
    expect(output.dataContracts).toMatchSnapshot('data-contracts');
    expect(output.metaInfo).toMatchSnapshot('meta-info');
    expect(output.endpoint).toMatchSnapshot('endpoint');
  });



  it('generates data-contracts with enumStyle: const-enum', async () => {
    const output = await generateEnumStyleOutput('const-enum');
    expect(output.dataContracts).toMatchSnapshot('data-contracts');
    expect(output.metaInfo).toMatchSnapshot('meta-info');
    expect(output.endpoint).toMatchSnapshot('endpoint');
  });


  it('generates data-contracts with enumStyle: union', async () => {
    const output = await generateEnumStyleOutput('union');
    expect(output.dataContracts).toMatchSnapshot('data-contracts');
    expect(output.metaInfo).toMatchSnapshot('meta-info');
    expect(output.endpoint).toMatchSnapshot('endpoint');
  });

  it('generates data-contracts with enumStyle: const', async () => {
    const output = await generateEnumStyleOutput('const');
    expect(output.dataContracts).toMatchSnapshot('data-contracts');
    expect(output.metaInfo).toMatchSnapshot('meta-info');
    expect(output.endpoint).toMatchSnapshot('endpoint');
  });

  it('generates data-contracts with enumStyle: enum', async () => {
    const output = await generateEnumStyleOutput('enum');
    expect(output.dataContracts).toMatchSnapshot('data-contracts');
    expect(output.metaInfo).toMatchSnapshot('meta-info');
    expect(output.endpoint).toMatchSnapshot('endpoint');
  });
});
