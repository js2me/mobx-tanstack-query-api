import { LoDashStatic } from 'lodash';
import { generateApi as generateApiFromSwagger } from 'swagger-typescript-api';
import { AnyObject, KeyOfByValue, Maybe } from 'yummies/utils/types';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { allExportsTmpl } from './templates/all-exports.tmpl.js';
import { LINTERS_IGNORE } from './templates/constants.js';
import { dataContractsFileTmpl } from './templates/data-contracts-file.tmpl.js';
import { endpointPerFileTmpl } from './templates/endpoint-per-file.tmpl.js';
import { indexTsForEndpointPerFileTmpl } from './templates/index-ts-for-endpoint-per-file.tmpl.js';
import { metaInfoTmpl } from './templates/meta-info.tmpl.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

export type CodegenDataUtils = {
  _: LoDashStatic;
  getInlineParseContent: (requestParams: AnyObject) => string;
  formatModelName: (modelName: string) => string;
};

export type CodegenProcess = AnyObject;

export interface ImportFileParams {
  path: string;
  exportName: string;
}

export interface MetaInfo {
  namespace: string | null;
  groupNames: string[];
  tags?: string[];
}

export interface GenerateQueryApiParams {
  output: string;
  input: string | AnyObject;

  requestPathPrefix?: string;
  requestPathSuffix?: string;
  requestInfoPrefix?: string;

  formatExportGroupName?: (
    groupName: string,
    utils: CodegenDataUtils,
  ) => string;

  /**
   * Group endpoints and collect it into object
   */
  groupBy?:
    | ((route: AnyObject) => string)
    | `path-segment`
    | `path-segment-${number}`
    | `tag`
    | `tag-${number}`;

  /**
   * Collect all exports into single namespace
   *
   * Example:
   * without namespace:
   *
   * export * from "./endpoints";
   * export * from "./data-contracts";
   *
   * with namespace:
   *
   * export * as namespaceName from "./__exports"; // exports like above
   *
   *
   * namespaceName.login.toMutation()
   */
  namespace?: string | ((utils: AnyObject) => string);

  /**
   * Example:
   * operationId: 'getById'
   * /api/v1/users/{userId} => /api/v1/users/1
   *
   * addPathSegmentToRouteName: 2 (users), 0 - api
   *
   * output endpoint instance name: `usersGetById` (pathSegments[2] + operationId)
   */
  addPathSegmentToRouteName?: boolean | number;

  queryClient?: 'builtin' | ImportFileParams;
  endpoint?: 'builtin' | ImportFileParams;
  httpClient?: 'builtin' | ImportFileParams;

  getEndpointMeta?: (
    route: AnyObject,
    utils: AnyObject,
  ) => {
    typeName: string;
    importTypePath: string;
    tmplData: string;
  };
  getRequestMeta?: (
    route: AnyObject,
    utils: AnyObject,
  ) => {
    tmplData: string;
  };

  requestOptions?: AnyObject;

  otherCodegenParams?: AnyObject;

  filterRoutes?: (route: AnyObject) => boolean;

  filterGroups?: (groupName: string) => boolean;

  libImports?: {
    'mobx-tanstack-query-api'?: string;
  };

  transforms?: {
    groupEnumValue?: (group: string, namespace?: Maybe<string>) => string;
    tagEnumValue?: (tag: string, namespace?: Maybe<string>) => string;
  };
}

export type AllImportFileParams = Record<
  KeyOfByValue<Required<GenerateQueryApiParams>, 'builtin' | ImportFileParams>,
  ImportFileParams
>;

export const generateApi = async (
  params: GenerateQueryApiParams | GenerateQueryApiParams[],
): Promise<void> => {
  if (Array.isArray(params)) {
    await Promise.all(params.map((param) => generateApi(param)));
    return;
  }

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
  const codegenParams: Partial<AnyObject> = {
    httpClientType: 'fetch',
    cleanOutput: true,
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
    requestOptions: params.requestOptions,
    ...params.otherCodegenParams,
  };

  let codegenProcess!: any;

  const inputData: AnyObject = {};

  if (!params.input) {
    console.warn(
      '[mobx-tanstack-query-api/codegen]',
      'input is not specified',
      '\nprocess will be skipped',
    );
    return;
  }

  if (typeof params.input === 'string') {
    inputData.input = params.input;
    inputData.url = params.input;
  } else {
    inputData.spec = params.input;
  }

  const generated = await generateApiFromSwagger({
    ...(codegenParams as any),
    ...inputData,
    hooks: {
      onInit: (configuration, codeGenProcessFromInit) => {
        codegenProcess = codeGenProcessFromInit;

        return codegenParams?.hooks?.onInit?.(
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
        return codegenParams?.hooks?.onPrepareConfig?.(config);
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

        return (
          codegenParams?.hooks?.onFormatRouteName?.(
            routeInfo,
            formattedRouteName,
          ) ?? formattedRouteName
        );
      },
    },
  });
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

  let allRoutes = Object.values(generated.configuration.routes)
    .flat()
    .flatMap((routeGroup) =>
      'routes' in routeGroup ? routeGroup.routes : routeGroup,
    );

  allRoutes = params.filterRoutes
    ? allRoutes.filter(params.filterRoutes)
    : allRoutes;

  const reservedDataContractNamesMap = new Map<string, number>();

  const collectedExportFiles: string[] = [];

  const groupsMap = new Map<string, AnyObject[]>();
  const tagsSet = new Set<string>();

  if (params.groupBy == null) {
    collectedExportFiles.push('endpoints');
    // #region кодогенерация 1 эндпоинт - 1 файл без группировки
    codegenFs.createDir(path.resolve(params.output, 'endpoints'));

    const fileNamesWithRequestInfo: string[] = [];

    for await (const route of allRoutes) {
      const { content: requestInfoPerFileContent, reservedDataContractNames } =
        await endpointPerFileTmpl({
          ...generated,
          route,
          apiParams: params,
          codegenProcess,
          importFileParams,
          utils,
          relativePathDataContracts: '../data-contracts',
          groupName: null,
          metaInfo: {
            groupNames: [],
            namespace,
          },
        });

      if (Array.isArray(route.raw.tags)) {
        route.raw.tags.forEach((tag) => tagsSet.add(tag));
      }

      reservedDataContractNames.forEach((name) => {
        reservedDataContractNamesMap.set(
          name,
          (reservedDataContractNamesMap.get(name) ?? 0) + 1,
        );
      });

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
        ...generated,
        apiParams: params,
        codegenProcess,
        generatedRequestFileNames: fileNamesWithRequestInfo,
      }),
    });
    // #endregion
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

    for await (const [groupName, routes] of groupsMap) {
      if (params.filterGroups && !params.filterGroups(groupName)) {
        continue;
      }

      const fileNamesWithRequestInfo: string[] = [];

      codegenFs.createDir(path.resolve(params.output, _.kebabCase(groupName)));
      codegenFs.createDir(
        path.resolve(params.output, _.kebabCase(groupName), 'endpoints'),
      );

      for await (const route of routes) {
        const {
          content: requestInfoPerFileContent,
          reservedDataContractNames,
        } = await endpointPerFileTmpl({
          ...generated,
          route,
          apiParams: params,
          codegenProcess,
          importFileParams,
          utils,
          relativePathDataContracts: '../../data-contracts',
          groupName,
          metaInfo: {
            namespace,
            groupNames: [],
          },
        });

        if (Array.isArray(route.raw.tags)) {
          route.raw.tags.forEach((tag: string) => tagsSet.add(tag));
        }

        reservedDataContractNames.forEach((name) => {
          reservedDataContractNamesMap.set(
            name,
            (reservedDataContractNamesMap.get(name) ?? 0) + 1,
          );
        });

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

      const exportGroupName = params.formatExportGroupName
        ? params.formatExportGroupName(_.camelCase(groupName), utils)
        : _.camelCase(groupName);

      codegenFs.createFile({
        path: path.resolve(params.output, _.kebabCase(groupName)),
        fileName: 'index.ts',
        withPrefix: false,
        content: `${LINTERS_IGNORE}
export * as ${exportGroupName} from './endpoints';
`,
      });

      codegenFs.createFile({
        path: path.resolve(params.output, _.kebabCase(groupName), 'endpoints'),
        fileName: 'index.ts',
        withPrefix: false,
        content: await indexTsForEndpointPerFileTmpl({
          ...generated,
          apiParams: params,
          codegenProcess,
          generatedRequestFileNames: fileNamesWithRequestInfo,
        }),
      });

      collectedExportFiles.push(_.kebabCase(groupName));
    }
    // #endregion
  }

  const metaInfo: Maybe<MetaInfo> =
    (namespace ?? groupsMap.size > 0)
      ? {
          namespace,
          groupNames: [...groupsMap.keys()],
          tags: [...tagsSet.values()],
        }
      : null;

  const excludedDataContractNames = Array.from(
    reservedDataContractNamesMap.entries(),
  )
    .filter(([_, count]) => count === 1)
    .map(([name]) => name);

  const dataContractsContent = await dataContractsFileTmpl({
    ...generated,
    apiParams: params,
    codegenProcess,
    excludedDataContractNames,
  });

  codegenFs.createFile({
    path: paths.outputDir,
    fileName: 'data-contracts.ts',
    withPrefix: false,
    content: dataContractsContent,
  });

  codegenFs.createFile({
    path: paths.outputDir,
    fileName: 'meta-info.ts',
    withPrefix: false,
    content: await metaInfoTmpl({
      ...generated,
      metaInfo,
      utils,
      codegenParams: params,
    }),
  });

  if (namespace) {
    codegenFs.createFile({
      path: paths.outputDir,
      fileName: '__exports.ts',
      withPrefix: false,
      content: await allExportsTmpl({
        ...generated,
        collectedExportFiles,
        metaInfo,
        utils,
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
        ...generated,
        collectedExportFiles,
        metaInfo,
        utils,
      }),
    });
  }
};
