import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';
import type { GenerateQueryApiParams } from '../../src/codegen/types/generate-query-api-params.js';

const INPUT_DIR = path.resolve(__dirname, './generate-from-yaml.test.yaml');
const OUTPUT_DIR = path.resolve(__dirname, './__generated__/zod');
const ENDPOINT_FILE = path.resolve(
  OUTPUT_DIR,
  'endpoints',
  'submit-multi-content-report.ts',
);
const CONTRACTS_FILE = path.resolve(OUTPUT_DIR, 'contracts.ts');
const DUPLICATE_NAME_ENDPOINT_FILE = path.resolve(
  OUTPUT_DIR,
  'endpoints',
  'get-test-resource.ts',
);

const DUPLICATE_NAME_INPUT = {
  openapi: '3.0.0',
  info: {
    title: 'Duplicate zod contract names',
    version: '1.0.0',
  },
  paths: {
    '/api/test/resource': {
      get: {
        tags: ['TestTag'],
        operationId: 'GetTestResource',
        responses: {
          200: {
            description: 'A successful response.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TestResource',
                },
              },
            },
          },
          default: {
            description: 'An unexpected error response.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TestStatus',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      TestResource: {
        type: 'object',
        required: ['value'],
        properties: {
          value: {
            type: 'string',
          },
        },
      },
      TestStatus: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
          },
        },
      },
    },
  },
} satisfies GenerateQueryApiParams['input'];

async function readEndpointContent(): Promise<string> {
  return fs.readFile(ENDPOINT_FILE, 'utf-8');
}

async function readContractsContent(): Promise<string> {
  return fs.readFile(CONTRACTS_FILE, 'utf-8');
}

async function readGeneratedFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

function hasZodImport(content: string): boolean {
  return content.includes('import * as z from "zod"');
}

function hasContracts(content: string): boolean {
  return (
    content.includes('contract: submitMultiContentReportContract') &&
    content.includes('submitMultiContentReportContract')
  );
}

function getValidateContractsLine(content: string): string | null {
  const match = content.match(/validateContract:\s*[^\n]+/);
  return match ? match[0].trim().replace(/,?\s*$/, '') : null;
}

function getThrowContractsLine(content: string): string | null {
  const match = content.match(/throwContracts:\s*[^\n]+/);
  return match ? match[0].trim().replace(/,?\s*$/, '') : null;
}

function getContractsLine(content: string): string | null {
  const match = content.match(/contract:\s*[^\n]+/);
  return match ? match[0].trim().replace(/,?\s*$/, '') : null;
}

describe('generateApi — zodContracts все вариации', () => {
  const baseConfig: GenerateQueryApiParams = {
    input: INPUT_DIR,
    output: OUTPUT_DIR,
    noBarrelFiles: true,
    removeUnusedTypes: true,
    outputType: 'one-endpoint-per-file',
    filterEndpoints: [/^submitMultiContentReport$/i],
  };

  beforeEach(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    // swagger-typescript-api fileSystem.createDir не создает вложенные директории рекурсивно
    // поэтому гарантируем существование родителя (__generated__)
    await fs.mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
  });

  it('zodContracts: false — нет контрактов и валидации', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: false,
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(false);
    expect(hasContracts(content)).toBe(false);
    expect(getValidateContractsLine(content)).toBeNull();
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: true — контракты + validateContract: true', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: true,
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(hasContracts(content)).toBe(true);
    expect(getValidateContractsLine(content)).toBe('validateContract: true');
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: { validate: true } — только validateContract: true', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: { validate: true },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(hasContracts(content)).toBe(true);
    expect(getValidateContractsLine(content)).toBe('validateContract: true');
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: { suffix: "Validator" } — кастомный суффикс для всех zod контрактов', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: { validate: true, suffix: 'Validator' },
      }),
    );
    const endpointContent = await readEndpointContent();
    const contractsContent = await readContractsContent();
    expect(endpointContent).toContain('submitMultiContentReportValidator');
    expect(endpointContent).toContain(
      'contract: submitMultiContentReportValidator',
    );
    expect(contractsContent).toContain('nodePageEnvelopeDcValidator');
    expect(contractsContent).not.toContain('nodePageEnvelopeValidator');
  });

  it('zodContracts: { validate: false } — контракты есть, validateContract: false', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: { validate: false },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(hasContracts(content)).toBe(true);
    expect(getValidateContractsLine(content)).toBe(
      'validateContract: false',
    );
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: { validate: "..." } — выражение в validateContract', async () => {
    const expr = "process.env.NODE_ENV === 'development'";
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: { validate: expr },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(hasContracts(content)).toBe(true);
    // в сгенерированном коде строка может быть с двойными кавычками
    expect(getValidateContractsLine(content)).toMatch(
      /validateContract:\s*process\.env\.NODE_ENV\s*===\s*["']development["']/,
    );
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: { validate: { params: true, data: false } } — объект validateContract', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: { validate: { params: true, data: false } },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(hasContracts(content)).toBe(true);
    expect(content).toContain(
      'validateContract: { params: true, data: false }',
    );
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: { validate: { params: true, data: "..." } } — объект с выражением для data', async () => {
    const dataExpr = "process.env.NODE_ENV === 'development'";
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: { validate: { params: true, data: dataExpr } },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(hasContracts(content)).toBe(true);
    expect(content).toContain('params: true');
    expect(content).toMatch(/data:\s*process\.env\.NODE_ENV\s*===\s*["']development["']/);
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: { validate: fn } — функция получает contractName и routeInfo', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: {
          validate: (contractName, routeInfo) => ({
            params: contractName === 'submitMultiContentReportContract',
            data:
              routeInfo.operationId === 'submitMultiContentReport' &&
              routeInfo.path === '/reports/multi-content' &&
              routeInfo.method === 'post' &&
              routeInfo.contractName === contractName,
          }),
        },
      }),
    );
    const content = await readEndpointContent();
    expect(content).toContain(
      'validateContract: { params: true, data: true }',
    );
  });

  it('zodContracts: { throw: true } — throwContracts: true', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: { validate: true, throw: true },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(hasContracts(content)).toBe(true);
    expect(getValidateContractsLine(content)).toBe('validateContract: true');
    expect(getThrowContractsLine(content)).toBe('throwContracts: true');
  });

  it('zodContracts: { throw: false } — throwContracts: false', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: { validate: true, throw: false },
      }),
    );
    const content = await readEndpointContent();
    expect(getThrowContractsLine(content)).toBe('throwContracts: false');
  });

  it('zodContracts: { throw: "..." } — выражение в throwContracts', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: {
          validate: false,
          throw: "process.env.NODE_ENV === 'development'",
        },
      }),
    );
    const content = await readEndpointContent();
    expect(getThrowContractsLine(content)).toMatch(
      /throwContracts:\s*process\.env\.NODE_ENV\s*===\s*["']development["']/,
    );
  });

  it('zodContracts: { throw: { params: true, data: false } } — объект throwContracts', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: {
          validate: true,
          throw: { params: true, data: false },
        },
      }),
    );
    const content = await readEndpointContent();
    expect(content).toContain(
      'throwContracts: { params: true, data: false }',
    );
  });

  it('zodContracts: { throw: fn } — функция вычисляет throwContracts на этапе codegen', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: {
          validate: true,
          throw: (contractName, routeInfo) =>
            routeInfo.contractName === contractName &&
            routeInfo.operationId === 'submitMultiContentReport',
        },
      }),
    );
    const content = await readEndpointContent();
    expect(getThrowContractsLine(content)).toBe('throwContracts: true');
  });

  it('zodContracts: { appendRule: "..." } — условная вставка contracts в рантайме', async () => {
    const condition = 'process.env.NODE_ENV === "development"';
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: { validate: true, appendRule: condition },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(content).toContain('submitMultiContentReportContract');
    expect(content).toContain(condition);
    // Форматтер может разбить строку; проверяем наличие тернарника
    expect(content).toMatch(
      /contract:\s*\n?\s*[\s\S]*\?\s*submitMultiContentReportContract\s*:\s*undefined/,
    );
  });

  it('zodContracts: { appendRule: (name) => name === "..." } — контракт только для выбранного эндпоинта', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: {
          validate: true,
          appendRule: (name) =>
            name === 'submitMultiContentReportContract',
        },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(getContractsLine(content)).toBe(
      'contract: submitMultiContentReportContract',
    );
  });

  it('zodContracts: { appendRule: () => false } — contract: undefined', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: {
          validate: true,
          appendRule: () => false,
        },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(content).toContain('submitMultiContentReportContract'); // переменная всё равно генерируется
    expect(getContractsLine(content)).toBe('contract: undefined');
  });

  it('zodContracts: true — shared zod схемы именуются как data contracts в camelCase', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: true,
      }),
    );
    const contractsContent = await readContractsContent();
    expect(contractsContent).toContain('nodePageEnvelopeDc');
    expect(contractsContent).not.toContain('nodePageEnvelopeContract');
  });

  it('zodContracts: true — не импортирует shared zod schema с тем же именем, что и endpoint contract', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        input: DUPLICATE_NAME_INPUT,
        noMetaInfo: true,
        filterEndpoints: [/^getTestResource$/i],
        zodContracts: true,
      }),
    );

    const endpointContent = await readGeneratedFile(DUPLICATE_NAME_ENDPOINT_FILE);
    const contractsContent = await readContractsContent();

    expect(endpointContent).toContain(
      'import { testResourceDc } from "../contracts";',
    );
    expect(endpointContent).not.toContain(
      'import { testResourceContract } from "../contracts";',
    );
    expect(endpointContent).toContain('export const getTestResourceContract = {');
    expect(endpointContent).toContain('data: testResourceDc');
    expect(contractsContent).toContain('export const testResourceDc =');
    expect(contractsContent).not.toContain('export const testResourceContract =');
  });

  it('zodContracts: { suffix: "Schema" } — сохраняет отсутствие коллизии имён и применяет suffix', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        input: DUPLICATE_NAME_INPUT,
        noMetaInfo: true,
        filterEndpoints: [/^getTestResource$/i],
        zodContracts: {
          validate: true,
          suffix: 'Schema',
        },
      }),
    );

    const endpointContent = await readGeneratedFile(DUPLICATE_NAME_ENDPOINT_FILE);
    const contractsContent = await readContractsContent();

    expect(endpointContent).toContain(
      'import { testResourceDcSchema } from "../contracts";',
    );
    expect(endpointContent).not.toContain(
      'import { testResourceSchema } from "../contracts";',
    );
    expect(endpointContent).toContain('export const getTestResourceSchema = {');
    expect(endpointContent).toContain('data: testResourceDcSchema');
    expect(endpointContent).toContain('contract: getTestResourceSchema');
    expect(contractsContent).toContain('export const testResourceDcSchema =');
    expect(contractsContent).not.toContain('export const testResourceSchema =');
  });
});
