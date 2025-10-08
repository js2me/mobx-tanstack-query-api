import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type GenerateApiConfiguration,
  generateApi as generateApiFromSwagger,
  type ParsedRoute,
} from 'swagger-typescript-api';
import type { AnyObject, Maybe } from 'yummies/utils/types';

import { allEndpointPerFileTmpl } from './templates/all-endpoints-per-file.tmpl.js';
import { allExportsTmpl } from './templates/all-exports.tmpl.js';
import { LINTERS_IGNORE } from './templates/constants.js';
import { dataContractsFileTmpl } from './templates/data-contracts-file.tmpl.js';
import { endpointPerFileTmpl } from './templates/endpoint-per-file.tmpl.js';
import { indexTsForEndpointPerFileTmpl } from './templates/index-ts-for-endpoint-per-file.tmpl.js';
import { metaInfoTmpl } from './templates/meta-info.tmpl.js';
import type {
  AllImportFileParams,
  BaseTmplParams,
  CodegenDataUtils,
  GenerateQueryApiParams,
  MetaInfo,
} from './types/index.js';
import { removeUnusedTypes } from './utils/remove-unused-types.js';
import { unpackFilterOption } from './utils/unpack-filter-option.js';

export * from './types/index.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);
const __execdirname = process.cwd();

export const generateApi = async (
  params: GenerateQueryApiParams | GenerateQueryApiParams[],
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
): Promise<void> => {
  if (Array.isArray(params)) {
    for await (const param of params) {
      await generateApi(param);
    }
    return;
  }

  const tsconfigPath = params.tsconfigPath
    ? path.resolve(__execdirname, params.tsconfigPath)
    : path.resolve(__execdirname, './tsconfig.json');

  console.info('using tsconfig', tsconfigPath);

  const importFileParams: AllImportFileParams = {
    queryClient:
      !params.queryClient || typeof params.queryClient === 'string'
        ? {
            exportName: 'queryClient',
            path: 'mobx-tanstack-query-api/builtin',
          }
        : params.queryClient,
    endpoint:
      !params.endpoint || typeof params.endpoint === 'string'
        ? {
            exportName: 'Endpoint',
            path: 'mobx-tanstack-query-api',
          }
        : params.endpoint,
    httpClient:
      !params.httpClient || typeof params.httpClient === 'string'
        ? {
            exportName: 'http',
            path: 'mobx-tanstack-query-api/builtin',
          }
        : params.httpClient,
  };

  const paths = {
    templates: path.resolve(__dirname, 'templates'),
    requestInfoClass: path.resolve(
      __dirname,
      'templates/request-info-class.ejs',
    ),
    httpClient: path.resolve(__dirname, 'templates/http-client.ejs'),
    createRequestInfoInstance: path.resolve(
      __dirname,
      'templates/create-request-info-instance.ejs',
    ),
    outputDir: path.resolve(process.cwd(), params.output),
  };

  //#region swagger-typescript-api
  const swaggerTypescriptApiCodegenBaseParams: Partial<AnyObject> = {
    httpClientType: 'fetch',
    cleanOutput: params.cleanOutput ?? true,
    modular: true,
    patch: true,
    typeSuffix: 'DC',
    disableStrictSSL: false,
    singleHttpClient: true,
    extractRequestBody: true,
    extractRequestParams: false,
    extractResponseBody: true,
    extractResponseError: true,
    generateResponses: true,
    generateClient: false,
    addReadonly: true,
    moduleNameFirstTag: true,
    sortTypes: true,
    templates: paths.templates.toString(),
    primitiveTypeConstructs: (constructs: AnyObject) => {
      return {
        ...(constructs as any),
        object: () => `Record<string, any>`,
        float: () => `number`,
        ...params.otherCodegenParams?.primitiveTypeConstructs?.(constructs),
      };
    },
    requestOptions: params.fetchSchemaRequestOptions,
    ...params.otherCodegenParams,
  };

  let codegenProcess!: any;

  if (!params.input) {
    console.warn(
      '[mobx-tanstack-query-api/codegen]',
      'input is not specified',
      '\nprocess will be skipped',
    );
    return;
  }

  const inputToCodegenInput = (input: Maybe<string | AnyObject>): AnyObject => {
    const inputData: AnyObject = {};

    if (typeof input === 'string') {
      inputData.input = input;
      inputData.url = input;
    } else {
      inputData.spec = input;
    }

    return inputData;
  };

  const generated = await generateApiFromSwagger({
    ...(swaggerTypescriptApiCodegenBaseParams as any),
    ...inputToCodegenInput(params.input),
    hooks: {
      onInit: (configuration, codeGenProcessFromInit) => {
        codegenProcess = codeGenProcessFromInit;

        // @ts-expect-error
        configuration.swaggerSchema.components =
          // @ts-expect-error
          configuration.swaggerSchema.components || {};
        // @ts-expect-error
        configuration.swaggerSchema.components.schemas =
          // @ts-expect-error
          configuration.swaggerSchema.components.schemas || {};

        return swaggerTypescriptApiCodegenBaseParams?.hooks?.onInit?.(
          configuration,
          codeGenProcessFromInit,
        );
      },
      onPrepareConfig: (config) => {
        config.routes.combined?.forEach((routeInfo) => {
          routeInfo.routes.sort((routeA, routeB) =>
            routeA.routeName.usage.localeCompare(routeB.routeName.usage),
          );
        });
        return swaggerTypescriptApiCodegenBaseParams?.hooks?.onPrepareConfig?.(
          config,
        );
      },
      onFormatRouteName: (routeInfo, usageRouteName) => {
        let formattedRouteName = usageRouteName;

        if (
          params.addPathSegmentToRouteName === true ||
          typeof params.addPathSegmentToRouteName === 'number'
        ) {
          const pathSegmentForSuffix =
            typeof params.addPathSegmentToRouteName === 'number'
              ? params.addPathSegmentToRouteName
              : 0;

          const pathSegments = routeInfo.route.split('/').filter(Boolean);
          const { _ } = codegenProcess.getRenderTemplateData()
            .utils as CodegenDataUtils;

          formattedRouteName = _.camelCase(
            `${pathSegments[pathSegmentForSuffix] || ''}_${formattedRouteName}`,
          );
        }

        const endpointName = formattedRouteName;

        return (
          params?.formatEndpointName?.(endpointName, routeInfo) ??
          swaggerTypescriptApiCodegenBaseParams?.hooks?.onFormatRouteName?.(
            routeInfo,
            endpointName,
          ) ??
          endpointName
        );
      },
    },
  });

  const generatedExtra = params.mixinInput
    ? await generateApiFromSwagger({
        ...(swaggerTypescriptApiCodegenBaseParams as any),
        ...inputToCodegenInput(params.mixinInput),
        hooks: {
          onPrepareConfig: (config) => {
            config.routes.combined?.forEach((routeInfo) => {
              routeInfo.routes.sort((routeA, routeB) =>
                routeA.routeName.usage.localeCompare(routeB.routeName.usage),
              );
            });
          },
          onFormatRouteName: (routeInfo, usageRouteName) => {
            let formattedRouteName = usageRouteName;

            if (
              params.addPathSegmentToRouteName === true ||
              typeof params.addPathSegmentToRouteName === 'number'
            ) {
              const pathSegmentForSuffix =
                typeof params.addPathSegmentToRouteName === 'number'
                  ? params.addPathSegmentToRouteName
                  : 0;

              const pathSegments = routeInfo.route.split('/').filter(Boolean);
              const { _ } = codegenProcess.getRenderTemplateData()
                .utils as CodegenDataUtils;

              formattedRouteName = _.camelCase(
                `${pathSegments[pathSegmentForSuffix] || ''}_${formattedRouteName}`,
              );
            }

            const endpointName = formattedRouteName;

            return (
              params?.formatEndpointName?.(endpointName, routeInfo) ??
              swaggerTypescriptApiCodegenBaseParams?.hooks?.onFormatRouteName?.(
                routeInfo,
                endpointName,
              ) ??
              endpointName
            );
          },
        },
      })
    : null;

  //#endregion

  const utils = codegenProcess.getRenderTemplateData()
    .utils as CodegenDataUtils;

  const { _ } = utils;

  let namespace: Maybe<string> = null;

  if (params.namespace) {
    if (typeof params.namespace === 'function') {
      namespace = params.namespace(utils);
    } else {
      namespace = utils._.camelCase(params.namespace);
    }
  }

  const codegenFs = codegenProcess.fileSystem as any;

  codegenFs.cleanDir(params.output);
  codegenFs.createDir(params.output);

  if (generatedExtra) {
    const allExtraOperationIdsSet = new Set([
      ...(generatedExtra.configuration.routes.outOfModule?.map(
        (r) => r.raw.operationId,
      ) ?? []),
      ...(generatedExtra.configuration.routes.combined?.flatMap((r) =>
        r.routes.map((r) => r.raw.operationId),
      ) ?? []),
    ]);
    const allExtraModelTypesSet = new Set([
      ...generatedExtra.configuration.modelTypes.map((m) => m.name),
    ]);

    generated.configuration.routes.outOfModule =
      generated.configuration.routes.outOfModule ?? [];
    generated.configuration.routes.outOfModule = [
      ...generated.configuration.routes.outOfModule.filter(
        (route) => !allExtraOperationIdsSet.has(route.raw.operationId),
      ),
      ...generatedExtra.configuration.routes.outOfModule,
    ];

    generated.configuration.routes.combined =
      generated.configuration.routes.combined ?? [];

    generated.configuration.routes.combined.forEach((group) => {
      group.routes = [
        ...group.routes.filter(
          (route) => !allExtraOperationIdsSet.has(route.raw.operationId),
        ),
        ...(generatedExtra.configuration.routes.combined?.find(
          (g) => g.moduleName === group.moduleName,
        )?.routes ?? []),
      ];
    });

    const notExistedCombinedExtra =
      generatedExtra.configuration.routes.combined?.filter(
        (group) =>
          !generated.configuration.routes.combined?.some(
            (g) => g.moduleName === group.moduleName,
          ),
      );

    generated.configuration.routes.combined.push(
      ...(notExistedCombinedExtra ?? []),
    );

    generated.configuration.modelTypes = [
      ...generated.configuration.modelTypes.filter(
        (it) => !allExtraModelTypesSet.has(it.name),
      ),
      ...generatedExtra.configuration.modelTypes,
    ];
  }

  const filterTypes = unpackFilterOption(
    params.filterTypes,
    (modelType) => modelType.name,
  );

  generated.configuration.modelTypes =
    generated.configuration.modelTypes.filter((modelType) =>
      filterTypes(modelType),
    );

  generated.configuration.modelTypes = generated.configuration.modelTypes.sort(
    (modelType1, modelType2) => {
      if (modelType1.name > modelType2.name) {
        return 1;
      }
      if (modelType1.name < modelType2.name) {
        return -1;
      }
      return 0;
    },
  );

  const allRoutes = Object.values(generated.configuration.routes)
    .flat()
    .flatMap((routeGroup) =>
      'routes' in routeGroup ? routeGroup.routes : routeGroup,
    );

  const filterEndpoint = unpackFilterOption(
    params.filterEndpoints,
    (route) => route.raw?.operationId || '',
  );

  const baseTmplParams: BaseTmplParams = {
    ...generated,
    codegenParams: params,
    configuration: generated.configuration as GenerateApiConfiguration,
    formatTSContent: generated.formatTSContent,
    codegenProcess,
    importFileParams,
    utils,
    filterTypes,
  };

  const reservedDataContractNamesMap = new Map<string, number>();

  const collectedExportFilesFromIndexFile: string[] = [];

  const groupsMap = new Map<string, ParsedRoute[]>();
  const nonEmptyGroups = new Set<string>();
  const tagsSet = new Set<string>();

  if (params.groupBy == null) {
    collectedExportFilesFromIndexFile.push('endpoints');

    if (params.outputType === 'one-endpoint-per-file') {
      // #region кодогенерация 1 эндпоинт - 1 файл без группировки
      codegenFs.createDir(path.resolve(params.output, 'endpoints'));

      const fileNamesWithRequestInfo: string[] = [];

      for await (const route of allRoutes) {
        const {
          content: requestInfoPerFileContent,
          reservedDataContractNames,
        } = await endpointPerFileTmpl({
          ...baseTmplParams,
          route,
          relativePathDataContracts: '../data-contracts',
          groupName: null,
          metaInfo: params.noMetaInfo
            ? null
            : {
                groupNames: [],
                namespace,
              },
        });

        if (Array.isArray(route.raw.tags)) {
          route.raw.tags.forEach((tag) => {
            tagsSet.add(tag);
          });
        }

        reservedDataContractNames.forEach((name) => {
          reservedDataContractNamesMap.set(
            name,
            (reservedDataContractNamesMap.get(name) ?? 0) + 1,
          );
        });

        if (!filterEndpoint(route)) {
          continue;
        }

        const fileName = `${_.kebabCase(route.routeName.usage)}.ts`;

        fileNamesWithRequestInfo.push(fileName);

        codegenFs.createFile({
          path: path.resolve(params.output, 'endpoints'),
          fileName,
          withPrefix: false,
          content: requestInfoPerFileContent,
        });
      }

      codegenFs.createFile({
        path: path.resolve(params.output, 'endpoints'),
        fileName: 'index.ts',
        withPrefix: false,
        content: await indexTsForEndpointPerFileTmpl({
          ...baseTmplParams,
          generatedRequestFileNames: fileNamesWithRequestInfo,
        }),
      });
      // #endregion
    } else {
      // #region кодогенерация несколько эндпоинтов в 1 файле без группировки
      const { content: requestInfoPerFileContent, reservedDataContractNames } =
        await allEndpointPerFileTmpl({
          ...baseTmplParams,
          routes: allRoutes,
          relativePathDataContracts: './data-contracts',
          groupName: null,
          metaInfo: params.noMetaInfo
            ? null
            : {
                namespace,
                groupNames: [],
              },
        });

      reservedDataContractNames.forEach((name) => {
        reservedDataContractNamesMap.set(
          name,
          (reservedDataContractNamesMap.get(name) ?? 0) + 1,
        );
      });

      const filteredRoutes = allRoutes.filter(filterEndpoint);

      const hasFilteredRoutes = filteredRoutes.length > 0;

      if (hasFilteredRoutes) {
        filteredRoutes.forEach((route) => {
          if (Array.isArray(route.raw.tags)) {
            route.raw.tags.forEach((tag: string) => {
              tagsSet.add(tag);
            });
          }
        });

        const fileName = 'endpoints.ts';

        collectedExportFilesFromIndexFile.push('endpoints');

        codegenFs.createFile({
          path: params.output,
          fileName,
          withPrefix: false,
          content: requestInfoPerFileContent,
        });
      }

      // #endregion
    }
  } else {
    // #region кодогенерация с группировкой

    // #region разбиение роутов по группам

    allRoutes.forEach((route) => {
      let group: string | undefined;

      if (typeof params.groupBy === 'function') {
        group = params.groupBy(route);
      } else if (params.groupBy?.includes('path-segment')) {
        const segmentIndex =
          +params.groupBy.replaceAll(/path-segment-?/g, '') || 0;

        group =
          (route.request as AnyObject).path?.split('/')?.filter(Boolean)?.[
            segmentIndex
          ] || undefined;
      } else if (params.groupBy?.includes('tag')) {
        const tagIndex = +params.groupBy.replaceAll(/tag-?/g, '') || 0;

        group = route.raw?.tags?.[tagIndex] ?? undefined;
      }

      if (group == null) {
        group = 'other';
      }

      if (!groupsMap.has(group)) {
        groupsMap.set(group, []);
      }

      groupsMap.get(group)?.push(route);
    });
    // #endregion

    const filterGroups = unpackFilterOption(
      params.filterGroups,
      (groupName) => groupName,
    );
    for await (const [groupName, routes] of groupsMap) {
      if (!filterGroups(groupName)) {
        continue;
      }

      const fileNamesWithRequestInfo: string[] = [];

      const groupDirectory = path.resolve(
        params.output,
        _.kebabCase(groupName),
      );

      codegenFs.createDir(groupDirectory);

      let hasFilteredRoutes = false;

      if (params.outputType === 'one-endpoint-per-file') {
        // #region Генерация одного эндпоинта на 1 файл
        codegenFs.createDir(path.resolve(groupDirectory, 'endpoints'));

        for await (const route of routes) {
          const {
            content: requestInfoPerFileContent,
            reservedDataContractNames,
          } = await endpointPerFileTmpl({
            ...baseTmplParams,
            route,
            relativePathDataContracts: '../../data-contracts',
            groupName,
            metaInfo: params.noMetaInfo
              ? null
              : {
                  namespace,
                  groupNames: [],
                },
          });

          reservedDataContractNames.forEach((name) => {
            reservedDataContractNamesMap.set(
              name,
              (reservedDataContractNamesMap.get(name) ?? 0) + 1,
            );
          });

          if (!filterEndpoint(route)) {
            continue;
          }

          hasFilteredRoutes = true;

          if (Array.isArray(route.raw.tags)) {
            route.raw.tags.forEach((tag: string) => {
              tagsSet.add(tag);
            });
          }

          const fileName = `${_.kebabCase(route.routeName.usage)}.ts`;

          fileNamesWithRequestInfo.push(fileName);

          codegenFs.createFile({
            path: path.resolve(
              params.output,
              _.kebabCase(groupName),
              'endpoints',
            ),
            fileName,
            withPrefix: false,
            content: requestInfoPerFileContent,
          });
        }
        // #endregion
      } else {
        // #region Генерация нескольких эндпоинтов на 1 файл
        const {
          content: requestInfoPerFileContent,
          reservedDataContractNames,
        } = await allEndpointPerFileTmpl({
          ...baseTmplParams,
          routes,
          relativePathDataContracts: '../data-contracts',
          groupName,
          metaInfo: params.noMetaInfo
            ? null
            : {
                namespace,
                groupNames: [],
              },
        });

        reservedDataContractNames.forEach((name) => {
          reservedDataContractNamesMap.set(
            name,
            (reservedDataContractNamesMap.get(name) ?? 0) + 1,
          );
        });

        const filteredRoutes = routes.filter(filterEndpoint);

        hasFilteredRoutes = filteredRoutes.length > 0;

        if (hasFilteredRoutes) {
          filteredRoutes.forEach((route) => {
            if (Array.isArray(route.raw.tags)) {
              route.raw.tags.forEach((tag: string) => {
                tagsSet.add(tag);
              });
            }
          });

          const fileName = 'endpoints.ts';

          fileNamesWithRequestInfo.push(fileName);

          codegenFs.createFile({
            path: groupDirectory,
            fileName,
            withPrefix: false,
            content: requestInfoPerFileContent,
          });
        }

        // #endregion
      }

      if (hasFilteredRoutes) {
        nonEmptyGroups.add(groupName);
        const exportGroupName = params.formatExportGroupName
          ? params.formatExportGroupName(_.camelCase(groupName), utils)
          : _.camelCase(groupName);

        codegenFs.createFile({
          path: groupDirectory,
          fileName: 'index.ts',
          withPrefix: false,
          content: `${LINTERS_IGNORE}
export * as ${exportGroupName} from './endpoints';
`,
        });

        if (params.outputType === 'one-endpoint-per-file') {
          codegenFs.createFile({
            path: path.resolve(groupDirectory, 'endpoints'),
            fileName: 'index.ts',
            withPrefix: false,
            content: await indexTsForEndpointPerFileTmpl({
              ...baseTmplParams,
              generatedRequestFileNames: fileNamesWithRequestInfo,
            }),
          });
        }

        collectedExportFilesFromIndexFile.push(_.kebabCase(groupName));
      } else {
        codegenFs.removeDir(
          path.resolve(params.output, _.kebabCase(groupName)),
        );
      }
    }
    // #endregion
  }

  const metaInfo: Maybe<MetaInfo> =
    !params.noMetaInfo &&
    (namespace ?? (nonEmptyGroups.size > 0 || tagsSet.size > 0))
      ? {
          namespace,
          groupNames: [...nonEmptyGroups.values()],
          tags: [...tagsSet.values()],
        }
      : null;

  const excludedDataContractNames = Array.from(
    reservedDataContractNamesMap.entries(),
  )
    .filter(([_, count]) => count === 1)
    .map(([name]) => name);

  const dataContractsContent = await dataContractsFileTmpl({
    ...baseTmplParams,
    excludedDataContractNames,
  });

  codegenFs.createFile({
    path: paths.outputDir,
    fileName: 'data-contracts.ts',
    withPrefix: false,
    content: dataContractsContent,
  });

  if (metaInfo) {
    codegenFs.createFile({
      path: paths.outputDir,
      fileName: 'meta-info.ts',
      withPrefix: false,
      content: await metaInfoTmpl({
        ...baseTmplParams,
        metaInfo,
      }),
    });
  }

  if (namespace) {
    codegenFs.createFile({
      path: paths.outputDir,
      fileName: '__exports.ts',
      withPrefix: false,
      content: await allExportsTmpl({
        ...baseTmplParams,
        collectedExportFiles: collectedExportFilesFromIndexFile,
        metaInfo,
      }),
    });
    codegenFs.createFile({
      path: paths.outputDir,
      fileName: 'index.ts',
      withPrefix: false,
      content: `${LINTERS_IGNORE}
export * as ${namespace} from './__exports';
`,
    });
  } else {
    codegenFs.createFile({
      path: paths.outputDir,
      fileName: 'index.ts',
      withPrefix: false,
      content: await allExportsTmpl({
        ...baseTmplParams,
        collectedExportFiles: collectedExportFilesFromIndexFile,
        metaInfo,
      }),
    });
  }

  if (params.removeUnusedTypes) {
    removeUnusedTypes({
      directory: params.output,
      keepTypes:
        params.removeUnusedTypes === true
          ? undefined
          : params.removeUnusedTypes.keepTypes,
    });
  }
};
