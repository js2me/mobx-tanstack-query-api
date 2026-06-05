import { rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloneDeep } from 'es-toolkit';
import {
  type GenerateApiConfiguration,
  generateApi as generateApiFromSwagger,
  type Hooks,
  type ParsedRoute,
} from 'swagger-typescript-api';
import { callFunction } from 'yummies/common';
import { toArray } from 'yummies/data';
import type { AnyObject, Defined, Maybe } from 'yummies/types';
import { allEndpointPerFileTmpl } from './templates/all-endpoints-per-file.tmpl.js';
import { allExportsTmpl } from './templates/all-exports.tmpl.js';
import { LINTERS_IGNORE } from './templates/constants.js';
import { dataContractsFileTmpl } from './templates/data-contracts-file.tmpl.js';
import { endpointPerFileTmpl } from './templates/endpoint-per-file.tmpl.js';
import { indexTsForEndpointPerFileTmpl } from './templates/index-ts-for-endpoint-per-file.tmpl.js';
import { metaInfoTmpl } from './templates/meta-info.tmpl.js';
import { newEndpointTmpl } from './templates/new-endpoint.tmpl/index.js';
import type {
  AllImportFileParams,
  BaseTmplParams,
  CodegenDataUtils,
  GenerateQueryApiParams,
  GenerateQueryApiParamsWithInput,
  MetaInfo,
  RouteBaseInfo,
} from './types/index.js';
import { computeExcludedDataContractNames } from './utils/data-contract-exclusion.js';
import { DEFAULT_DATA_CONTRACT_TYPE_SUFFIX } from './utils/data-contract-type-suffix.js';
import { generateExport } from './utils/generate-export.js';
import { removeUnusedTypes } from './utils/remove-unused-types.js';
import { collectComponentContractNames } from './utils/swagger/collect-component-names.js';
import {
  createAggregateUserError,
  throwSwaggerCodegenError,
} from './utils/swagger/throw-swagger-codegen-error.js';
import { unpackFilterOption } from './utils/unpack-filter-option.js';
import { buildCentralZodContractsFile } from './utils/zod/build-endpoint-zod-contracts-code.js';
import { getZodContractSuffix } from './utils/zod/contract-suffix.js';

export * from './types/index.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);
const __execdirname = process.cwd();

export const generateApi = async (
  paramOrParams: GenerateQueryApiParams | GenerateQueryApiParams[],
): Promise<void> => {
  console.log('');

  const params = toArray(paramOrParams).filter(
    (config): config is GenerateQueryApiParamsWithInput => {
      if (!config.input) {
        const outputHint =
          typeof config.output === 'string' && config.output
            ? ` (output: ${config.output})`
            : '';
        console.log(
          `⏭️  Skipping codegen config${outputHint}: "input" is missing or empty.`,
        );
        console.log('');
        return false;
      }
      return true;
    },
  );

  // Precompute vetoed paths: if any config with the same output has cleanOutput: false,
  // that output path should never be cleaned.
  const vetoedPaths = new Set<string>();
  for (const param of params) {
    if (!param.output || typeof param.output !== 'string') continue;
    if (param.cleanOutput === false) {
      vetoedPaths.add(path.resolve(__execdirname, param.output));
    }
  }

  const cleanedPaths = new Set<string>();

  // Check if any config has debug enabled (used for error output)
  const debug = params.some((p) => p.debug === true);

  const failures: Error[] = [];

  for await (const param of params) {
    try {
      await generateApiSingle(param, cleanedPaths, vetoedPaths);
      console.log('');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      failures.push(err);
      console.error(err.message);
      console.log('');
    }
  }

  if (failures.length === 1) {
    throw failures[0];
  }
  if (failures.length > 1) {
    throw createAggregateUserError(
      failures,
      '⛔ One or more codegen configs failed',
      debug,
    );
  }
};

const generateApiSingle = async (
  params: GenerateQueryApiParamsWithInput,
  cleanedPaths: Set<string>,
  vetoedPaths: Set<string>,
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestration with many code paths
): Promise<void> => {
  const importFileParams: AllImportFileParams = {
    queryClient:
      params.queryClient === 'skip'
        ? {
            exportName: 'queryClient',
            path: 'mobx-tanstack-query-api/builtin',
          }
        : !params.queryClient || typeof params.queryClient === 'string'
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
      params.httpClient === 'skip'
        ? {
            exportName: 'http',
            path: 'mobx-tanstack-query-api/builtin',
          }
        : !params.httpClient || typeof params.httpClient === 'string'
          ? {
              exportName: 'http',
              path: 'mobx-tanstack-query-api/builtin',
            }
          : params.httpClient,
    ...(params.httpClient === 'skip' ? { skipHttpClient: true as const } : {}),
    ...(params.queryClient === 'skip'
      ? { skipQueryClient: true as const }
      : {}),
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
  const dataContractTypeSuffix =
    params.dataContractTypeSuffix === false
      ? ''
      : (params.dataContractTypeSuffix ?? DEFAULT_DATA_CONTRACT_TYPE_SUFFIX);

  const inputLogLabel =
    typeof params.input === 'string' ? params.input : '<inline OpenAPI spec>';

  console.log('⏳ Preparing codegen...', 'input:', inputLogLabel);

  //#region swagger-typescript-api
  const swaggerTypescriptApiCodegenBaseParams: Parameters<
    typeof generateApiFromSwagger
  >[0] = {
    httpClientType: 'fetch',
    // Output cleanup is handled here (batch rm + codegenFs.cleanDir); avoid swagger doing it too.
    cleanOutput: false,
    modular: false,
    patch: true,
    typeSuffix: dataContractTypeSuffix,
    singleHttpClient: true,
    extractRequestBody: true,
    extractRequestParams: false,
    extractResponseBody: true,
    extractResponseError: true,
    extractResponses: true,
    preferExistingSchemaNamesForExternalRefs: true,
    generateResponses: true,
    generateClient: false,
    addReadonly: true,
    moduleNameFirstTag: true,
    sortTypes: true,
    templates: paths.templates.toString(),
    primitiveTypeConstructs: (constructs: AnyObject) => {
      const result = {
        ...(constructs as any),
        object: () => `Record<string, any>`,
        float: () => `number`,
        /** GitLab / some specs use OpenAPI 2-style `type: text` for strings */
        text: () => `string`,
      };

      if (params.otherCodegenParams?.primitiveTypeConstructs) {
        if (
          typeof params.otherCodegenParams?.primitiveTypeConstructs ===
          'function'
        ) {
          Object.assign(
            result,
            params.otherCodegenParams.primitiveTypeConstructs(result),
          );
        } else {
          Object.assign(
            result,
            params.otherCodegenParams.primitiveTypeConstructs,
          );
        }
      }

      return result;
    },
    requestOptions: params.fetchSchemaRequestOptions,
    ...params.otherCodegenParams,
    ...(params.enumStyle !== undefined && { enumStyle: params.enumStyle }),
  };

  let codegenProcess!: any;

  const prepareConfig: Defined<Hooks['onPrepareConfig']> = (config) => {
    config.routes.combined?.forEach((routeInfo) => {
      routeInfo.routes.sort((routeA, routeB) =>
        routeA.routeName.usage.localeCompare(routeB.routeName.usage),
      );
    });
    return params.otherCodegenParams?.hooks?.onPrepareConfig?.(config);
  };

  const formatRouteName: Defined<Hooks['onFormatRouteName']> = (
    routeInfo,
    usageRouteName,
  ) => {
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

    const resultRouteName =
      params?.formatEndpointName?.(
        endpointName,
        routeInfo,
        swaggerSchemaRefForHooks,
      ) ??
      swaggerTypescriptApiCodegenBaseParams?.hooks?.onFormatRouteName?.(
        routeInfo,
        endpointName,
      ) ??
      endpointName;

    return (
      params.otherCodegenParams?.hooks?.onFormatRouteName?.(
        routeInfo,
        resultRouteName,
      ) ?? resultRouteName
    );
  };

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
  let mixinSwaggerSchema: Maybe<AnyObject> = null;
  /** Set in `onInit` so {@link GenerateQueryApiParams.formatEndpointName} can read the schema before `generateApiFromSwagger` resolves. */
  let swaggerSchemaRefForHooks: AnyObject = {};

  if (params.mixinInput) {
    await generateApiFromSwagger({
      ...(swaggerTypescriptApiCodegenBaseParams as any),
      ...inputToCodegenInput(params.mixinInput),
      hooks: {
        onInit: (configuration, _codegenProcess) => {
          mixinSwaggerSchema = cloneDeep(configuration.swaggerSchema);
          swaggerSchemaRefForHooks = configuration.swaggerSchema as AnyObject;
        },
        onPrepareConfig: prepareConfig,
        onFormatRouteName: formatRouteName,
      },
    });
  }

  const input = inputToCodegenInput(params.input);

  const generated = await generateApiFromSwagger({
    ...(swaggerTypescriptApiCodegenBaseParams as any),
    ...input,
    hooks: {
      ...params.otherCodegenParams?.hooks,
      onInit: (configuration, codeGenProcessFromInit) => {
        codegenProcess = codeGenProcessFromInit;

        const resultSwaggerSchema = configuration.swaggerSchema as AnyObject;

        resultSwaggerSchema.components = resultSwaggerSchema.components || {};
        resultSwaggerSchema.components.schemas =
          resultSwaggerSchema.components.schemas || {};

        resultSwaggerSchema.paths = {
          ...resultSwaggerSchema.paths,
          ...mixinSwaggerSchema?.paths,
        };

        resultSwaggerSchema.components.schemas = {
          ...resultSwaggerSchema.components.schemas,
          ...mixinSwaggerSchema?.components?.schemas,
        };

        swaggerSchemaRefForHooks = resultSwaggerSchema as AnyObject;

        return swaggerTypescriptApiCodegenBaseParams?.hooks?.onInit?.(
          configuration,
          codeGenProcessFromInit,
        );
      },
      onCreateRoute: (routeData) => {
        const routeBaseInfo: RouteBaseInfo = {
          operationId: routeData.raw.operationId,
          path: routeData.request.path!,
          method: routeData.request.method!,
          contractName: null,
          parsed: routeData,
        };

        if (routeData.request.path !== undefined) {
          const prefix =
            callFunction(
              params.requestPathPrefix,
              routeBaseInfo,
              swaggerSchemaRefForHooks,
            ) || '';
          const suffix =
            callFunction(
              params.requestPathSuffix,
              routeBaseInfo,
              swaggerSchemaRefForHooks,
            ) || '';

          routeData.request.path = prefix + routeData.request.path + suffix;

          if (typeof routeData.raw.route === 'string') {
            routeData.raw.route = prefix + routeData.raw.route + suffix;
          }
        }

        if (params.otherCodegenParams?.hooks?.onCreateRoute) {
          return params.otherCodegenParams.hooks.onCreateRoute(routeData);
        }

        return routeData;
      },
      onPrepareConfig: prepareConfig,
      onFormatRouteName: formatRouteName,
    },
  }).catch((e): never => throwSwaggerCodegenError(e, input, params.debug));

  //#endregion

  // Clean output directory after input validation but before writing files.
  // This ensures old files are only deleted when we know new ones will be written.
  const absOutputPath = path.resolve(__execdirname, params.output);
  if (!vetoedPaths.has(absOutputPath) && !cleanedPaths.has(absOutputPath)) {
    try {
      const statInfo = statSync(absOutputPath);
      if (statInfo.isDirectory()) {
        rmSync(absOutputPath, { recursive: true, force: true });
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw err;
      }
    }
    cleanedPaths.add(absOutputPath);
  }

  const swaggerSchema = ((generated.configuration as GenerateApiConfiguration)
    .config?.swaggerSchema ??
    (generated.configuration as AnyObject)?.swaggerSchema) as AnyObject;

  const utils = codegenProcess.getRenderTemplateData()
    .utils as CodegenDataUtils;

  const { _ } = utils;

  const outputType = params.outputType ?? 'one-endpoint-per-file';
  const shouldGenerateBarrelFiles = !params.noBarrelFiles;

  let namespace: string | null = null;

  if (params.namespace) {
    if (typeof params.namespace === 'function') {
      namespace = params.namespace(utils, swaggerSchema) ?? null;
    } else {
      namespace = utils._.camelCase(params.namespace);
    }
  }

  const codegenFs = codegenProcess.fileSystem as any;

  await Promise.resolve(codegenFs.createDir(paths.outputDir));

  const filterTypes = unpackFilterOption(
    params.filterTypes,
    (modelType) => modelType.name,
  );

  generated.configuration.modelTypes =
    generated.configuration.modelTypes.filter((modelType) =>
      filterTypes(modelType, swaggerSchema),
    );

  console.log('📦 Generating api...', 'input:', inputLogLabel);

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
    codegenParams: {
      ...params,
      libImports: {
        ...params.libImports,
        'mobx-tanstack-query-api':
          params.libImports?.['mobx-tanstack-query-api'] ??
          'mobx-tanstack-query-api',
      },
    },
    configuration: generated.configuration as GenerateApiConfiguration,
    formatTSContent: generated.formatTSContent,
    codegenProcess,
    importFileParams,
    utils,
    filterTypes,
    swaggerSchema,
  };

  const reservedDataContractNamesMap = new Map<string, number>();

  const zodContractSuffix = getZodContractSuffix(params.zodContracts);
  const hasZodContractsFile =
    (params.zodContracts === true ||
      (typeof params.zodContracts === 'object' &&
        params.zodContracts != null)) &&
    swaggerSchema?.components?.schemas &&
    typeof swaggerSchema?.components?.schemas === 'object' &&
    Object.keys(swaggerSchema?.components?.schemas).length > 0;

  const collectedExportFilesFromIndexFile: string[] = [];

  const groupsMap = new Map<string, ParsedRoute[]>();
  const nonEmptyGroups = new Set<string>();
  const tagsSet = new Set<string>();

  if (params.groupBy == null) {
    collectedExportFilesFromIndexFile.push('endpoints');

    if (outputType === 'one-endpoint-per-file') {
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
          relativePathZodSchemas: hasZodContractsFile ? '../contracts' : null,
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

        if (!filterEndpoint(route, swaggerSchema)) {
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

      if (shouldGenerateBarrelFiles) {
        codegenFs.createFile({
          path: path.resolve(params.output, 'endpoints'),
          fileName: 'index.ts',
          withPrefix: false,
          content: await indexTsForEndpointPerFileTmpl({
            ...baseTmplParams,
            generatedRequestFileNames: fileNamesWithRequestInfo,
          }),
        });
      }
      // #endregion
    } else {
      // #region кодогенерация несколько эндпоинтов в 1 файле без группировки
      const filteredRoutes = allRoutes.filter((route) =>
        filterEndpoint(route, swaggerSchema),
      );

      // Для роутов, не прошедших filterEndpoint, в файл их не пишем,
      // но reservedDataContractNames всё равно учитываем — иначе
      // operation-level alias-типы (Op*DataDC и т.п.) этих роутов
      // утекут в data-contracts.ts (см. excludedDataContractNames).
      for (const route of allRoutes) {
        if (filterEndpoint(route, swaggerSchema)) {
          continue;
        }
        const { reservedDataContractNames } = newEndpointTmpl({
          ...baseTmplParams,
          route,
          groupName: null,
          metaInfo: params.noMetaInfo
            ? null
            : {
                namespace,
                groupNames: [],
              },
          zodContracts: params.zodContracts,
          relativePathZodSchemas: hasZodContractsFile
            ? './contracts'
            : undefined,
        });
        reservedDataContractNames.forEach((name) => {
          reservedDataContractNamesMap.set(
            name,
            (reservedDataContractNamesMap.get(name) ?? 0) + 1,
          );
        });
      }

      const hasFilteredRoutes = filteredRoutes.length > 0;

      if (hasFilteredRoutes) {
        const {
          content: requestInfoPerFileContent,
          reservedDataContractNames,
        } = await allEndpointPerFileTmpl({
          ...baseTmplParams,
          routes: filteredRoutes,
          relativePathDataContracts: './data-contracts',
          groupName: null,
          metaInfo: params.noMetaInfo
            ? null
            : {
                namespace,
                groupNames: [],
              },
          relativePathZodSchemas: hasZodContractsFile ? './contracts' : null,
        });

        reservedDataContractNames.forEach((name) => {
          reservedDataContractNamesMap.set(
            name,
            (reservedDataContractNamesMap.get(name) ?? 0) + 1,
          );
        });

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
          path: paths.outputDir,
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
        group = params.groupBy(route, swaggerSchema);
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
      if (!filterGroups(groupName, swaggerSchema)) {
        // Группа отфильтрована: файлы для неё не пишем, но всё равно
        // собираем reservedDataContractNames по её роутам, чтобы
        // operation-level alias-типы (Op*DataDC и т.п.) этих роутов
        // корректно исключались из data-contracts.ts (см. excludedDataContractNames).
        for (const route of routes) {
          const { reservedDataContractNames } = newEndpointTmpl({
            ...baseTmplParams,
            route,
            groupName,
            metaInfo: params.noMetaInfo
              ? null
              : {
                  namespace,
                  groupNames: [],
                },
            zodContracts: params.zodContracts,
            relativePathZodSchemas: hasZodContractsFile
              ? '../../contracts'
              : undefined,
          });

          reservedDataContractNames.forEach((name) => {
            reservedDataContractNamesMap.set(
              name,
              (reservedDataContractNamesMap.get(name) ?? 0) + 1,
            );
          });
        }
        continue;
      }

      const fileNamesWithRequestInfo: string[] = [];

      const groupDirectory = path.resolve(
        params.output,
        _.kebabCase(groupName),
      );

      codegenFs.createDir(groupDirectory);

      let hasFilteredRoutes = false;

      if (outputType === 'one-endpoint-per-file') {
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
            relativePathZodSchemas: hasZodContractsFile
              ? '../../contracts'
              : null,
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

          if (!filterEndpoint(route, swaggerSchema)) {
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
        const filteredRoutes = routes.filter((route) =>
          filterEndpoint(route, swaggerSchema),
        );

        // См. комментарий в ветке без группировки: отфильтрованные роуты
        // не пишем в файл, но reservedDataContractNames учитываем.
        for (const route of routes) {
          if (filterEndpoint(route, swaggerSchema)) {
            continue;
          }
          const { reservedDataContractNames } = newEndpointTmpl({
            ...baseTmplParams,
            route,
            groupName,
            metaInfo: params.noMetaInfo
              ? null
              : {
                  namespace,
                  groupNames: [],
                },
            zodContracts: params.zodContracts,
            relativePathZodSchemas: hasZodContractsFile
              ? '../contracts'
              : undefined,
          });
          reservedDataContractNames.forEach((name) => {
            reservedDataContractNamesMap.set(
              name,
              (reservedDataContractNamesMap.get(name) ?? 0) + 1,
            );
          });
        }

        hasFilteredRoutes = filteredRoutes.length > 0;

        if (hasFilteredRoutes) {
          const {
            content: requestInfoPerFileContent,
            reservedDataContractNames,
          } = await allEndpointPerFileTmpl({
            ...baseTmplParams,
            routes: filteredRoutes,
            relativePathDataContracts: '../data-contracts',
            relativePathZodSchemas: hasZodContractsFile ? '../contracts' : null,
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
          ? params.formatExportGroupName(
              _.camelCase(groupName),
              utils,
              swaggerSchema,
            )
          : _.camelCase(groupName);

        if (shouldGenerateBarrelFiles) {
          codegenFs.createFile({
            path: groupDirectory,
            fileName: 'index.ts',
            withPrefix: false,
            content: `${LINTERS_IGNORE}
export * as ${exportGroupName} from './endpoints';
`,
          });
        }

        if (
          shouldGenerateBarrelFiles &&
          outputType === 'one-endpoint-per-file'
        ) {
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

  const hasRootServers =
    Array.isArray(baseTmplParams.swaggerSchema?.servers) &&
    baseTmplParams.swaggerSchema.servers.length > 0;

  const metaInfo: Maybe<MetaInfo> =
    !params.noMetaInfo &&
    (namespace ??
      (nonEmptyGroups.size > 0 || tagsSet.size > 0 || hasRootServers))
      ? {
          namespace,
          groupNames: [...nonEmptyGroups.values()],
          tags: [...tagsSet.values()],
        }
      : null;

  const componentsContractNames = collectComponentContractNames(
    swaggerSchema,
    utils.formatModelName,
  );

  const excludedDataContractNames = computeExcludedDataContractNames({
    reservedDataContractNamesMap,
    componentsContractNames,
    modelTypes: generated.configuration.modelTypes as AnyObject[],
  });

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

  if (hasZodContractsFile && swaggerSchema?.components?.schemas) {
    const contractsTsContent = buildCentralZodContractsFile({
      componentsSchemas: swaggerSchema?.components?.schemas as Record<
        string,
        AnyObject
      >,
      contractSuffix: zodContractSuffix,
    });
    const formattedContractsContent = await generated.formatTSContent(
      `${LINTERS_IGNORE}\n${contractsTsContent}`,
    );
    codegenFs.createFile({
      path: paths.outputDir,
      fileName: 'contracts.ts',
      withPrefix: false,
      content: formattedContractsContent,
    });
  }

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
        exportSchemas: hasZodContractsFile,
      }),
    });
    if (shouldGenerateBarrelFiles) {
      codegenFs.createFile({
        path: paths.outputDir,
        fileName: 'index.ts',
        withPrefix: false,
        content: `${LINTERS_IGNORE}
${generateExport({ asteriksAt: namespace }, './__exports', params)}
`,
      });
    }
  } else {
    if (shouldGenerateBarrelFiles) {
      codegenFs.createFile({
        path: paths.outputDir,
        fileName: 'index.ts',
        withPrefix: false,
        content: await allExportsTmpl({
          ...baseTmplParams,
          collectedExportFiles: collectedExportFilesFromIndexFile,
          metaInfo,
          exportSchemas: hasZodContractsFile,
        }),
      });
    }
  }

  if (params.removeUnusedTypes) {
    await removeUnusedTypes({
      directory: paths.outputDir,
      keepTypes:
        params.removeUnusedTypes === true
          ? undefined
          : params.removeUnusedTypes.keepTypes,
    });
  }

  console.log('✅ Codegen completed successfully:', paths.outputDir);
};
