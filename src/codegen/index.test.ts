/** @vitest-environment node */

import type { Stats } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => {
  const enoent = (): never => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  };
  return {
    rmSync: vi.fn(),
    statSync: vi.fn(enoent),
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    rmSync: (...args: Parameters<typeof actual.rmSync>) =>
      fsMocks.rmSync(...args),
    statSync: (...args: Parameters<typeof actual.statSync>) =>
      fsMocks.statSync(...args),
  };
});

const mocks = vi.hoisted(() => {
  return {
    cleanDir: vi.fn(),
    createDir: vi.fn(),
    createFile: vi.fn(),
    removeDir: vi.fn(),
    removeUnusedTypes: vi.fn(),
    endpointPerFileTmpl: vi.fn(),
    dataContractsFileTmpl: vi.fn(),
  };
});

const kebabCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

vi.mock('swagger-typescript-api', () => {
  return {
    generateApi: vi.fn(async (config: any) => {
      const codegenProcess = {
        fileSystem: {
          cleanDir: mocks.cleanDir,
          createDir: mocks.createDir,
          createFile: mocks.createFile,
          removeDir: mocks.removeDir,
        },
        getRenderTemplateData: () => ({
          utils: {
            _: {
              camelCase: (value: string) => value,
              kebabCase,
            },
          },
        }),
      };

      config.hooks?.onInit?.({ swaggerSchema: {} }, codegenProcess);
      config.hooks?.onPrepareConfig?.({ routes: { combined: [] } });

      return {
        configuration: {
          modelTypes: [],
          routes: {
            combined: [
              {
                routes: [
                  {
                    routeName: { usage: 'getUsers' },
                    request: { path: '/users' },
                    raw: {
                      operationId: 'getUsers',
                      tags: ['users'],
                    },
                  },
                ],
              },
            ],
          },
        },
        formatTSContent: (content: string) => content,
      };
    }),
  };
});

vi.mock('./templates/endpoint-per-file.tmpl.js', () => {
  return {
    endpointPerFileTmpl: mocks.endpointPerFileTmpl.mockResolvedValue({
      content: 'export const getUsers = 1;',
      reservedDataContractNames: [],
    }),
  };
});

vi.mock('./templates/all-endpoints-per-file.tmpl.js', () => {
  return {
    allEndpointPerFileTmpl: vi.fn(),
  };
});

vi.mock('./templates/index-ts-for-endpoint-per-file.tmpl.js', () => {
  return {
    indexTsForEndpointPerFileTmpl: vi.fn(),
  };
});

vi.mock('./templates/data-contracts-file.tmpl.js', () => {
  return {
    dataContractsFileTmpl: mocks.dataContractsFileTmpl.mockResolvedValue(
      'export type DataContracts = unknown;',
    ),
  };
});

vi.mock('./templates/all-exports.tmpl.js', () => {
  return {
    allExportsTmpl: vi.fn(),
  };
});

vi.mock('./templates/meta-info.tmpl.js', () => {
  return {
    metaInfoTmpl: vi.fn(),
  };
});

vi.mock('./utils/remove-unused-types.js', () => {
  return {
    removeUnusedTypes: mocks.removeUnusedTypes,
  };
});

import { generateApi as swaggerCodegen } from 'swagger-typescript-api';
import { defineConfig } from '../cli/utils/define-config.js';
import { generateApi } from './index.js';

const minimalOpenApi = {
  openapi: '3.0.0',
  info: { title: 't', version: '1.0.0' },
  paths: {},
} as const;

const minimalCodegenOptions = {
  noBarrelFiles: true,
  noMetaInfo: true,
  removeUnusedTypes: true,
} as const;

beforeEach(() => {
  fsMocks.rmSync.mockClear();
  fsMocks.statSync.mockReset();
  fsMocks.statSync.mockImplementation(() => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    throw err;
  });
});

describe('falsy input', () => {
  it('generateApi does not call swagger-typescript-api', async () => {
    vi.mocked(swaggerCodegen).mockClear();

    await generateApi({
      output: './ignored-out',
      input: '',
      noBarrelFiles: true,
      noMetaInfo: true,
    });

    expect(swaggerCodegen).not.toHaveBeenCalled();
  });

  it('generateApi only processes configs with truthy input', async () => {
    vi.mocked(swaggerCodegen).mockClear();

    await generateApi([
      {
        output: './only-second',
        input: '',
        noBarrelFiles: true,
        noMetaInfo: true,
      },
      {
        ...minimalCodegenOptions,
        output: './only-second',
        input: minimalOpenApi,
      },
    ]);

    expect(swaggerCodegen).toHaveBeenCalledTimes(1);
  });

  it('defineConfig keeps falsy input in the array; generateApi skips them', async () => {
    const out = defineConfig(
      { output: 'a', input: '', noBarrelFiles: true },
      {
        output: 'b',
        input: minimalOpenApi,
        noBarrelFiles: true,
        noMetaInfo: true,
      },
    );

    expect(out).toHaveLength(2);

    vi.mocked(swaggerCodegen).mockClear();
    await generateApi(out);
    expect(swaggerCodegen).toHaveBeenCalledTimes(1);
  });
});

describe('generateApi output path handling', () => {
  it('uses absolute paths for relative output without outputType', async () => {
    const relativeOutput = './src/shared/api/__generated__';
    const absoluteOutput = path.resolve(process.cwd(), relativeOutput);

    await expect(
      generateApi({
        input: {
          openapi: '3.0.0',
          info: { title: 'test', version: '1.0.0' },
          paths: {},
        },
        output: relativeOutput,
        noBarrelFiles: true,
        noMetaInfo: true,
        removeUnusedTypes: true,
      }),
    ).resolves.toBeUndefined();

    expect(mocks.cleanDir).not.toHaveBeenCalled();
    expect(mocks.createDir).toHaveBeenCalledWith(absoluteOutput);
    expect(mocks.removeUnusedTypes).toHaveBeenCalledWith({
      directory: absoluteOutput,
      keepTypes: undefined,
    });

    const createdFileParams = mocks.createFile.mock.calls.map(
      ([params]) => params as { path: string; fileName: string },
    );

    expect(
      createdFileParams.every(({ path: filePath }) =>
        path.isAbsolute(filePath),
      ),
    ).toBe(true);

    expect(createdFileParams).toContainEqual(
      expect.objectContaining({
        path: path.resolve(absoluteOutput, 'endpoints'),
        fileName: 'get-users.ts',
      }),
    );
    expect(createdFileParams).not.toContainEqual(
      expect.objectContaining({
        path: relativeOutput,
      }),
    );
  });
});

describe('cleanOutputDirectoriesOnDiskBeforeCodegen (via generateApi)', () => {
  it('calls rmSync for existing output directory before codegen', async () => {
    const relativeOutput = './api-out-rm-test';
    const absoluteOutput = path.resolve(process.cwd(), relativeOutput);

    fsMocks.statSync.mockImplementation(
      () => ({ isDirectory: () => true }) as Stats,
    );

    await expect(
      generateApi({
        ...minimalCodegenOptions,
        input: minimalOpenApi,
        output: relativeOutput,
      }),
    ).resolves.toBeUndefined();

    expect(fsMocks.statSync).toHaveBeenCalled();
    expect(
      fsMocks.statSync.mock.calls.some((c) => c[0] === absoluteOutput),
    ).toBe(true);
    expect(fsMocks.rmSync).toHaveBeenCalledTimes(1);
    expect(fsMocks.rmSync).toHaveBeenCalledWith(absoluteOutput, {
      recursive: true,
      force: true,
    });
  });

  it('does not call rmSync when path does not exist (ENOENT)', async () => {
    await expect(
      generateApi({
        ...minimalCodegenOptions,
        input: minimalOpenApi,
        output: './no-such-output-dir',
      }),
    ).resolves.toBeUndefined();

    expect(fsMocks.rmSync).not.toHaveBeenCalled();
  });

  it('does not call rmSync when path is not a directory', async () => {
    fsMocks.statSync.mockImplementation(
      () => ({ isDirectory: () => false }) as Stats,
    );

    await expect(
      generateApi({
        ...minimalCodegenOptions,
        input: minimalOpenApi,
        output: './some-file-path',
      }),
    ).resolves.toBeUndefined();

    expect(fsMocks.rmSync).not.toHaveBeenCalled();
  });

  it('with two configs sharing one output, calls rmSync exactly once', async () => {
    const relativeOutput = './shared-batch-out';
    const absoluteOutput = path.resolve(process.cwd(), relativeOutput);

    fsMocks.statSync.mockImplementation(
      () => ({ isDirectory: () => true }) as Stats,
    );

    await expect(
      generateApi([
        {
          ...minimalCodegenOptions,
          input: minimalOpenApi,
          output: relativeOutput,
        },
        {
          ...minimalCodegenOptions,
          input: minimalOpenApi,
          output: relativeOutput,
        },
      ]),
    ).resolves.toBeUndefined();

    expect(fsMocks.rmSync).toHaveBeenCalledTimes(1);
    expect(fsMocks.rmSync).toHaveBeenCalledWith(absoluteOutput, {
      recursive: true,
      force: true,
    });
  });

  it('does not delete output if any config with that path has cleanOutput: false', async () => {
    fsMocks.statSync.mockImplementation(
      () => ({ isDirectory: () => true }) as Stats,
    );

    await expect(
      generateApi([
        {
          ...minimalCodegenOptions,
          input: minimalOpenApi,
          output: './preserve-out',
          cleanOutput: false,
        },
        {
          ...minimalCodegenOptions,
          input: minimalOpenApi,
          output: './preserve-out',
        },
      ]),
    ).resolves.toBeUndefined();

    expect(fsMocks.rmSync).not.toHaveBeenCalled();
  });
});
