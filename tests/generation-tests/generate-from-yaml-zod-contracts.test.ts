import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineConfig } from '../../src/cli/utils/define-config.js';
import { generateApi } from '../../src/codegen/index.js';
import type { GenerateQueryApiParams } from '../../src/codegen/types/generate-query-api-params.js';

const INPUT_DIR = path.resolve(__dirname, './generate-from-yaml.test.yaml');
const OUTPUT_DIR = path.resolve(__dirname, './__generated_zod__');
const ENDPOINT_FILE = path.resolve(
  OUTPUT_DIR,
  'endpoints',
  'submit-multi-content-report.ts',
);

async function readEndpointContent(): Promise<string> {
  return fs.readFile(ENDPOINT_FILE, 'utf-8');
}

function hasZodImport(content: string): boolean {
  return content.includes('import * as z from "zod"');
}

function hasContracts(content: string): boolean {
  return (
    content.includes('contracts: submitMultiContentReportContracts') &&
    content.includes('submitMultiContentReportContracts')
  );
}

function getValidateContractsLine(content: string): string | null {
  const match = content.match(/validateContracts:\s*[^\n]+/);
  return match ? match[0].trim().replace(/,?\s*$/, '') : null;
}

function getThrowContractsLine(content: string): string | null {
  const match = content.match(/throwContracts:\s*[^\n]+/);
  return match ? match[0].trim().replace(/,?\s*$/, '') : null;
}

function getContractsLine(content: string): string | null {
  const match = content.match(/contracts:\s*[^\n]+/);
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

  it('zodContracts: true — контракты + validateContracts: true', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: true,
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(hasContracts(content)).toBe(true);
    expect(getValidateContractsLine(content)).toBe('validateContracts: true');
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: { validate: true } — только validateContracts: true', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: { validate: true },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(hasContracts(content)).toBe(true);
    expect(getValidateContractsLine(content)).toBe('validateContracts: true');
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: { validate: false } — контракты есть, validateContracts: false', async () => {
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
      'validateContracts: false',
    );
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: { validate: "..." } — выражение в validateContracts', async () => {
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
      /validateContracts:\s*process\.env\.NODE_ENV\s*===\s*["']development["']/,
    );
    expect(getThrowContractsLine(content)).toBeNull();
  });

  it('zodContracts: { validate: { params: true, data: false } } — объект validateContracts', async () => {
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
      'validateContracts: { params: true, data: false }',
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
    expect(getValidateContractsLine(content)).toBe('validateContracts: true');
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
    expect(content).toContain('submitMultiContentReportContracts');
    expect(content).toContain(condition);
    // Форматтер может разбить строку; проверяем наличие тернарника
    expect(content).toMatch(
      /contracts:\s*\n?\s*[\s\S]*\?\s*submitMultiContentReportContracts\s*:\s*undefined/,
    );
  });

  it('zodContracts: { appendRule: (name) => name === "..." } — контракт только для выбранного эндпоинта', async () => {
    await generateApi(
      defineConfig({
        ...baseConfig,
        zodContracts: {
          validate: true,
          appendRule: (name) =>
            name === 'submitMultiContentReportContracts',
        },
      }),
    );
    const content = await readEndpointContent();
    expect(hasZodImport(content)).toBe(true);
    expect(getContractsLine(content)).toBe(
      'contracts: submitMultiContentReportContracts',
    );
  });

  it('zodContracts: { appendRule: () => false } — contracts: undefined', async () => {
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
    expect(content).toContain('submitMultiContentReportContracts'); // переменная всё равно генерируется
    expect(getContractsLine(content)).toBe('contracts: undefined');
  });
});
