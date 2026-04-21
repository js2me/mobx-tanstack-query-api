import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';

const INPUT_FILE = path.resolve(
  __dirname,
  './save-response-data-type-1.swagger2.json',
);
const OUTPUT_DIR = path.resolve(
  __dirname,
  './__generated__/save-response-data-type-1',
);
const ENDPOINT_FILE = path.resolve(
  OUTPUT_DIR,
  'endpoints',
  'save-response-data-type-1.ts',
);
const DATA_CONTRACTS_FILE = path.resolve(OUTPUT_DIR, 'data-contracts.ts');

describe('generateApi saveResponseDataType1 Swagger 2 (definitions.*)', () => {
  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('keeps request/response models in data-contracts and imports them in the endpoint file', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
      }),
    );

    const endpoint = (await fs.readFile(ENDPOINT_FILE, 'utf-8')).replaceAll(
      '\r\n',
      '\n',
    );
    const dataContracts = (
      await fs.readFile(DATA_CONTRACTS_FILE, 'utf-8')
    ).replaceAll('\r\n', '\n');

    // что должно импортироваться
    expect(endpoint).toContain(`import { SaveResponseDataType1ErrorDC, SaveResponseDataType1RequestDC, SaveResponseDataType1ResponseDC } from "../data-contracts";`);

    // лишние типы которых быть не должно
    expect(endpoint).not.toContain('export type SaveResponseDataType1DataDC = SaveResponseDataType1Data;');
    expect(endpoint).not.toContain('export type SaveResponseDataType1DataDC = SaveResponseDataType1DataDC;');
    // лишние типы которых быть не должно
    expect(endpoint).not.toContain('export type SaveResponseDataType1ErrorDC = SaveResponseDataType1Fail;');
    expect(endpoint).not.toContain('export type SaveResponseDataType1ErrorDC = SaveResponseDataType1FailDC;');
  
    // этих типов вообще не должно быть в этом файле, у них нет почему то суффикса
    expect(endpoint).not.toContain('export type SaveResponseDataType1Data = SaveResponseDataType1Response;');
    expect(endpoint).not.toContain('export type SaveResponseDataType1Data = SaveResponseDataType1ResponseDC;');
    expect(endpoint).not.toContain('export type SaveResponseDataType1Fail = SaveResponseDataType1Error;');
    expect(endpoint).not.toContain('export type SaveResponseDataType1Fail = SaveResponseDataType1ErrorDC;');

    // это правильная генерация типов
    expect(endpoint).toContain(`export type SaveResponseDataType1DataDC = SaveResponseDataType1ResponseDC;`)
    expect(endpoint).toContain(`export type SaveResponseDataType1FailDC = SaveResponseDataType1ErrorDC;`)

    expect(endpoint).toContain(`export const saveResponseDataType1 = new Endpoint<`)
    expect(endpoint).toContain(`HttpResponse<SaveResponseDataType1DataDC, SaveResponseDataType1FailDC>,`)
    expect(endpoint).toMatchSnapshot();
    expect(dataContracts).toMatchSnapshot();
  });

  it('keeps only generated endpoint aliases in endpoint file', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
      }),
    );

    const endpoint = (await fs.readFile(ENDPOINT_FILE, 'utf-8')).replaceAll(
      '\r\n',
      '\n',
    );
    const dataContracts = (
      await fs.readFile(DATA_CONTRACTS_FILE, 'utf-8')
    );

    console.log('f', endpoint);

    expect(endpoint).toContain(
      'export type SaveResponseDataType1DataDC = SaveResponseDataType1ResponseDC;',
    );
    expect(endpoint).not.toContain(
      'export type SaveResponseDataType1ErrorDC = SaveResponseDataType1ErrorDC;',
    );
    expect(endpoint).toContain('export type SaveResponseDataType1Params = {');

    expect(endpoint).not.toContain(
      'export type SaveResponseDataType1Data = SaveResponseDataType1ResponseDC;',
    );
    expect(endpoint).not.toContain(
      'export type SaveResponseDataType1Fail = SaveResponseDataType1ErrorDC;',
    );
    expect(endpoint).not.toContain('export type SaveResponseDataType1Data = ');
    expect(endpoint).not.toContain('export type SaveResponseDataType1Fail = ');
    expect(endpoint).not.toContain('export type SaveResponseDataType1Data = SaveResponseDataType1Response;');

    expect(dataContracts).toBe(
`/* eslint-disable */
/* tslint:disable */

export interface SaveResponseDataType1ErrorDC {
  /** @format int32 */
  code?: number;
}

export interface SaveResponseDataType1RequestDC {
  /** @format int32 */
  limit?: number;
}

export interface SaveResponseDataType1ResponseDC {
  items?: string[];
}
`);
  });

  it('supports custom dataContractTypeSuffix in generated files', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        dataContractTypeSuffix: 'DTO',
      }),
    );

    const endpoint = (await fs.readFile(ENDPOINT_FILE, 'utf-8')).replaceAll(
      '\r\n',
      '\n',
    );
    const dataContracts = (
      await fs.readFile(DATA_CONTRACTS_FILE, 'utf-8')
    ).replaceAll('\r\n', '\n');

    expect(endpoint).toContain('SaveResponseDataType1RequestDTO');
    expect(endpoint).toContain('SaveResponseDataType1ResponseDTO');
    expect(endpoint).not.toContain('SaveResponseDataType1RequestDC');

    expect(dataContracts).toContain(
      'export interface SaveResponseDataType1RequestDTO',
    );
    expect(dataContracts).toContain(
      'export interface SaveResponseDataType1ResponseDTO',
    );
    expect(dataContracts).not.toContain(
      'export interface SaveResponseDataType1RequestDC',
    );
  });

  it('supports dataContractTypeSuffix=false (no suffix)', async () => {
    await generateApi(
      defineConfig({
        input: INPUT_FILE,
        output: OUTPUT_DIR,
        noBarrelFiles: true,
        removeUnusedTypes: true,
        outputType: 'one-endpoint-per-file',
        dataContractTypeSuffix: false,
      }),
    );

    const endpoint = (await fs.readFile(ENDPOINT_FILE, 'utf-8')).replaceAll(
      '\r\n',
      '\n',
    );
    const dataContracts = (
      await fs.readFile(DATA_CONTRACTS_FILE, 'utf-8')
    ).replaceAll('\r\n', '\n');

    expect(endpoint).toContain('SaveResponseDataType1Request');
    expect(endpoint).toContain('SaveResponseDataType1Response');
    expect(endpoint).not.toContain('SaveResponseDataType1RequestDC');

    expect(dataContracts).toContain('export interface SaveResponseDataType1Request');
    expect(dataContracts).toContain(
      'export interface SaveResponseDataType1Response',
    );
    expect(dataContracts).not.toContain(
      'export interface SaveResponseDataType1RequestDC',
    );
  });
});
