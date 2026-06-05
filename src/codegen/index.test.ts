/** @vitest-environment node */

import type * as Fs from 'node:fs';
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
    rmSync: vi.fn((..._args: unknown[]) => undefined),
    statSync: vi.fn(() => {
      enoent();
    }) as any,
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
      fsMocks.statSync.mock.calls.some(
        (c: Parameters<typeof Fs.statSync>) => c[0] === absoluteOutput,
      ),
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

  it('does not delete output directory when swagger input fetch fails', async () => {
    fsMocks.statSync.mockImplementation(
      () => ({ isDirectory: () => true }) as Stats,
    );

    vi.mocked(swaggerCodegen).mockRejectedValueOnce(
      new Error('error while fetching data from URL'),
    );

    await expect(
      generateApi({
        ...minimalCodegenOptions,
        input: 'http://unreachable/swagger.json',
        output: './api-out-fetch-fail',
      }),
    ).rejects.toThrow();

    expect(fsMocks.rmSync).not.toHaveBeenCalled();
  });
});

describe('debug option for error output', () => {
  const defaultSwaggerCodegenImpl = vi
    .mocked(swaggerCodegen)
    .getMockImplementation()!;

  beforeEach(() => {
    vi.mocked(swaggerCodegen).mockClear();
    vi.mocked(swaggerCodegen).mockImplementation(defaultSwaggerCodegenImpl);
  });

  it('hides stack trace by default (debug: false)', async () => {
    vi.mocked(swaggerCodegen).mockRejectedValueOnce(
      new Error('error while fetching data from URL'),
    );

    const badUrl = 'http://unreachable/swagger.json';

    try {
      await generateApi({
        input: badUrl,
        output: './debug-test-out',
        noBarrelFiles: true,
        noMetaInfo: true,
      });
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        `⛔ failed to load swagger schema based on input ${badUrl}`,
      );
      // Stack should only contain the message (not a full call stack)
      expect((error as Error).stack).toBe(
        `⛔ failed to load swagger schema based on input ${badUrl}`,
      );
    }
  });

  it('shows full stack trace when debug: true', async () => {
    vi.mocked(swaggerCodegen).mockRejectedValueOnce(
      new Error('error while fetching data from URL'),
    );

    const badUrl = 'http://unreachable/swagger.json';

    try {
      await generateApi({
        input: badUrl,
        output: './debug-test-out',
        noBarrelFiles: true,
        noMetaInfo: true,
        debug: true,
      });
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        `⛔ failed to load swagger schema based on input ${badUrl}`,
      );
      // Stack should contain the full call stack (including file paths)
      expect((error as Error).stack).toContain('throw-swagger-codegen-error');
    }
  });

  it('AggregateError hides stack traces by default for multiple failures', async () => {
    vi.mocked(swaggerCodegen)
      .mockRejectedValueOnce(new Error('error while fetching data from URL'))
      .mockRejectedValueOnce(new Error('error while fetching data from URL'));

    try {
      await generateApi([
        {
          input: 'http://fail1/swagger.json',
          output: './out1',
          noBarrelFiles: true,
        },
        {
          input: 'http://fail2/swagger.json',
          output: './out2',
          noBarrelFiles: true,
        },
      ]);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      // Should be a regular Error (not AggregateError) for clean output
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(AggregateError);
      const err = error as Error;
      // Message should contain summary, not full stack traces
      expect(err.message).toContain('⛔ One or more codegen configs failed');
      expect(err.message).toContain('failed to load swagger schema');
      // Should NOT contain file paths or stack trace
      expect(err.message).not.toContain('throw-swagger-codegen-error');
      expect(err.message).not.toContain('.ts:');
    }
  });

  it('AggregateError with debug: true returns real AggregateError with stack traces', async () => {
    vi.mocked(swaggerCodegen)
      .mockRejectedValueOnce(new Error('error while fetching data from URL'))
      .mockRejectedValueOnce(new Error('error while fetching data from URL'));

    try {
      await generateApi([
        {
          input: 'http://fail1/swagger.json',
          output: './out1',
          noBarrelFiles: true,
          debug: true,
        },
        {
          input: 'http://fail2/swagger.json',
          output: './out2',
          noBarrelFiles: true,
        },
      ]);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      // Should be a real AggregateError with full details
      expect(error).toBeInstanceOf(AggregateError);
      const aggregate = error as AggregateError;
      expect(aggregate.errors).toHaveLength(2);
      // Stack should contain file paths
      expect(aggregate.stack).toContain('createAggregateUserError');
    }
  });

  it('stack property equals message for clean output (single error)', async () => {
    vi.mocked(swaggerCodegen).mockRejectedValueOnce(
      new Error('error while fetching data from URL'),
    );

    const badUrl = 'http://test-stack/swagger.json';

    try {
      await generateApi({
        input: badUrl,
        output: './out',
        noBarrelFiles: true,
        noMetaInfo: true,
      });
      expect.fail('Expected error to be thrown');
    } catch (error) {
      const err = error as Error;
      // Stack should be exactly equal to message (no file paths)
      expect(err.stack).toBe(err.message);
      expect(err.stack).not.toContain('.ts');
      expect(err.stack).not.toContain('at ');
    }
  });

  it('stack property equals message for clean output (multiple errors)', async () => {
    vi.mocked(swaggerCodegen)
      .mockRejectedValueOnce(new Error('error while fetching data from URL'))
      .mockRejectedValueOnce(new Error('error while fetching data from URL'));

    try {
      await generateApi([
        {
          input: 'http://fail1/swagger.json',
          output: './out1',
          noBarrelFiles: true,
        },
        {
          input: 'http://fail2/swagger.json',
          output: './out2',
          noBarrelFiles: true,
        },
      ]);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      const err = error as Error;
      // Stack should be exactly equal to message (no file paths)
      expect(err.stack).toBe(err.message);
      expect(err.stack).not.toContain('.ts');
      expect(err.stack).not.toContain('at ');
      // Stack should contain numbered list
      expect(err.stack).toContain('1. ⛔');
      expect(err.stack).toContain('2. ⛔');
    }
  });

  it('handles non-swagger-input errors with debug: false', async () => {
    vi.mocked(swaggerCodegen).mockRejectedValueOnce(
      new Error('Some unexpected internal error'),
    );

    try {
      await generateApi({
        input: 'http://test/swagger.json',
        output: './out',
        noBarrelFiles: true,
        noMetaInfo: true,
      });
      expect.fail('Expected error to be thrown');
    } catch (error) {
      const err = error as Error;
      // Should still have clean error message
      expect(err.message).toBe('⛔ failed to generate swagger schema');
      expect(err.stack).toBe('⛔ failed to generate swagger schema');
    }
  });

  it('debug: true shows full stack for non-swagger-input errors', async () => {
    vi.mocked(swaggerCodegen).mockRejectedValueOnce(
      new Error('Some unexpected internal error'),
    );

    try {
      await generateApi({
        input: 'http://test/swagger.json',
        output: './out',
        noBarrelFiles: true,
        noMetaInfo: true,
        debug: true,
      });
      expect.fail('Expected error to be thrown');
    } catch (error) {
      const err = error as Error;
      expect(err.message).toBe('⛔ failed to generate swagger schema');
      // Stack should contain file paths
      expect(err.stack).toContain('throw-swagger-codegen-error');
    }
  });

  it('enumerates errors with correct numbering in aggregate', async () => {
    vi.mocked(swaggerCodegen)
      .mockRejectedValueOnce(new Error('error while fetching data from URL'))
      .mockRejectedValueOnce(new Error('error while fetching data from URL'))
      .mockRejectedValueOnce(new Error('error while fetching data from URL'));

    try {
      await generateApi([
        { input: 'http://a/swagger.json', output: './a', noBarrelFiles: true },
        { input: 'http://b/swagger.json', output: './b', noBarrelFiles: true },
        { input: 'http://c/swagger.json', output: './c', noBarrelFiles: true },
      ]);
      expect.fail('Expected error to be thrown');
    } catch (error) {
      const err = error as Error;
      expect(err.message).toContain(
        '1. ⛔ failed to load swagger schema based on input http://a/swagger.json',
      );
      expect(err.message).toContain(
        '2. ⛔ failed to load swagger schema based on input http://b/swagger.json',
      );
      expect(err.message).toContain(
        '3. ⛔ failed to load swagger schema based on input http://c/swagger.json',
      );
    }
  });
});

describe('generateApi input errors and batch resilience', () => {
  const defaultSwaggerCodegenImpl = vi
    .mocked(swaggerCodegen)
    .getMockImplementation()!;

  beforeEach(() => {
    mocks.createDir.mockClear();
    vi.mocked(swaggerCodegen).mockClear();
    vi.mocked(swaggerCodegen).mockImplementation(defaultSwaggerCodegenImpl);
  });

  it('several codegen configs should process all even if any one was throwed exception', async () => {
    const out1 = './batch-ok-1';
    const outFail = './batch-fail';
    const out3 = './batch-ok-3';
    const absOut1 = path.resolve(process.cwd(), out1);
    const absOut3 = path.resolve(process.cwd(), out3);

    vi.mocked(swaggerCodegen)
      .mockImplementationOnce(defaultSwaggerCodegenImpl)
      .mockRejectedValueOnce(
        new Error('simulated codegen failure for config 2'),
      )
      .mockImplementationOnce(defaultSwaggerCodegenImpl);

    await expect(
      generateApi([
        {
          ...minimalCodegenOptions,
          input: minimalOpenApi,
          output: out1,
        },
        {
          ...minimalCodegenOptions,
          input: minimalOpenApi,
          output: outFail,
        },
        {
          ...minimalCodegenOptions,
          input: minimalOpenApi,
          output: out3,
        },
      ]),
    ).rejects.toMatchObject({
      message: '⛔ failed to generate swagger schema',
      cause: expect.objectContaining({
        message: 'simulated codegen failure for config 2',
      }),
    });

    expect(swaggerCodegen).toHaveBeenCalledTimes(3);
    expect(mocks.createDir).toHaveBeenCalledWith(absOut1);
    expect(mocks.createDir).toHaveBeenCalledWith(absOut3);
    expect(
      mocks.createDir.mock.calls.some(
        ([dir]) => dir === path.resolve(process.cwd(), outFail),
      ),
    ).toBe(false);
  });
});
