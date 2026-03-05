import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

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

import { generateApi } from './index.js';

describe('generateApi output path handling', () => {
  it('использует абсолютные пути при относительном output без outputType', async () => {
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

    expect(mocks.cleanDir).toHaveBeenCalledWith(absoluteOutput);
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
