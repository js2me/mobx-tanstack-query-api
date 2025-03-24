import {
  GenerateApiParams as GenerateApiParamsFromSwagger,
  ParsedRoute,
  generateApi as generateApiFromSwagger,
} from 'swagger-typescript-api';
import { AnyObject, KeyOfByValue } from 'yummies/utils/types';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { dataContractsTmpl } from './templates/data-contracts.tmpl.js';
import { indexTsForRequestPerFileTmpl } from './templates/index-ts-for-request-per-file.tmpl.js';
import { requestInfoPerFileTmpl } from './templates/request-info-per-file.tmpl.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

export type CodegenProcess = Parameters<
  Exclude<
    Required<Extract<GenerateApiParamsFromSwagger, { input: string }>['hooks']>,
    undefined
  >['onInit']
>[1];

export interface ImportFileParams {
  path: string;
  exportName: string;
}

export interface QueryApiParams {
  requestPathPrefix?: string;
  requestPathSuffix?: string;
  requestInfoPrefix?: string;
  outputType: 'request-info-per-file';
  addPathSegmentToRouteName?: boolean | number;

  queryClient: 'builtin' | ImportFileParams;

  endpoint: 'builtin' | ImportFileParams;

  httpClient: 'builtin' | ImportFileParams;

  getRequestInfoMeta?: (route: ParsedRoute) => {
    typeName: string;
    importTypePath: string;
    tmplData: string;
  };
  getRequestMeta?: (route: ParsedRoute) => {
    typeName: string;
    importTypePath: string;
    tmplData: string;
  };
}

export type AllImportFileParams = Record<
  KeyOfByValue<Required<QueryApiParams>, 'builtin' | ImportFileParams>,
  ImportFileParams
>;

type GenerateApiParams = Omit<
  GenerateApiParamsFromSwagger,
  'output' | 'moduleNameFirstTag' | 'moduleNameIndex' | 'url' | 'input' | 'spec'
> & {
  output: string;
  input: string | AnyObject;
} & QueryApiParams;

export const generateApi = async (inputParams: GenerateApiParams) => {
  const { output, input, ...params } = inputParams;

  const importFileParams: AllImportFileParams = {
    queryClient:
      typeof inputParams.queryClient === 'string'
        ? {
            exportName: 'queryClient',
            path: 'mobx-tanstack-query-api/builtin',
          }
        : inputParams.queryClient,
    endpoint:
      typeof inputParams.endpoint === 'string'
        ? {
            exportName: 'Endpoint',
            path: 'mobx-tanstack-query-api',
          }
        : inputParams.endpoint,
    httpClient:
      typeof inputParams.httpClient === 'string'
        ? {
            exportName: 'http',
            path: 'mobx-tanstack-query-api/builtin',
          }
        : inputParams.httpClient,
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
    outputDir: output,
    outputEndpoints: path.resolve(output, 'endpoints'),
  };

  const codegenParams: Partial<GenerateApiParamsFromSwagger> = {
    httpClientType: 'fetch',
    cleanOutput: true,
    modular: true,
    patch: true,
    typeSuffix: 'DC',
    disableStrictSSL: false,
    singleHttpClient: true,
    extractRequestBody: true,
    extractRequestParams: true,
    extractResponseBody: true,
    extractResponseError: true,
    generateResponses: true,
    generateClient: false,
    addReadonly: true,
    moduleNameFirstTag: true,
    sortTypes: true,
    templates: paths.templates.toString(),
    primitiveTypeConstructs: (constructs) => {
      return {
        ...(constructs as any),
        object: () => `Record<string, any>`,
        float: () => `number`,
        ...params?.primitiveTypeConstructs?.(constructs),
      };
    },
    ...params,
  };

  let codegenProcess!: CodegenProcess;

  const inputData: AnyObject = {};

  if (typeof input === 'string') {
    inputData.input = input;
    inputData.url = input;
  } else {
    inputData.spec = input;
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
          inputParams.addPathSegmentToRouteName === true ||
          typeof inputParams.addPathSegmentToRouteName === 'number'
        ) {
          const pathSegmentForSuffix =
            typeof inputParams.addPathSegmentToRouteName === 'number'
              ? inputParams.addPathSegmentToRouteName
              : 0;

          const pathSegments = routeInfo.route.split('/').filter(Boolean);
          const { _ } = codegenProcess.getRenderTemplateData().utils;

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

  const { _ } = codegenProcess.getRenderTemplateData().utils;

  const codegenFs = codegenProcess.fileSystem as any;

  codegenFs.cleanDir(output);
  codegenFs.createDir(output);

  codegenFs.createDir(paths.outputEndpoints);

  const allRoutes = Object.values(generated.configuration.routes)
    .flat()
    .flatMap((routeGroup) =>
      'routes' in routeGroup ? routeGroup.routes : routeGroup,
    );

  const reservedDataContractNamesMap = new Map<string, number>();

  const fileNamesWithRequestInfo: string[] = [];

  for await (const route of allRoutes) {
    const { content: requestInfoPerFileContent, reservedDataContractNames } =
      await requestInfoPerFileTmpl({
        ...generated,
        route,
        apiParams: inputParams,
        codegenProcess,
        importFileParams,
      });

    reservedDataContractNames.forEach((name) => {
      reservedDataContractNamesMap.set(
        name,
        (reservedDataContractNamesMap.get(name) ?? 0) + 1,
      );
    });

    const fileName = `${_.kebabCase(route.routeName.usage)}.ts`;

    fileNamesWithRequestInfo.push(fileName);

    codegenFs.createFile({
      path: paths.outputEndpoints,
      fileName,
      withPrefix: false,
      content: requestInfoPerFileContent,
    });
  }

  const excludedDataContractNames = Array.from(
    reservedDataContractNamesMap.entries(),
  )
    .filter(([_, count]) => count === 1)
    .map(([name]) => name);

  const dataContractsContent = await dataContractsTmpl({
    ...generated,
    apiParams: inputParams,
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
    path: paths.outputEndpoints,
    fileName: 'index.ts',
    withPrefix: false,
    content: await indexTsForRequestPerFileTmpl({
      ...generated,
      apiParams: inputParams,
      codegenProcess,
      generatedRequestFileNames: fileNamesWithRequestInfo,
    }),
  });

  codegenFs.createFile({
    path: paths.outputDir,
    fileName: 'index.ts',
    withPrefix: false,
    content: `
export * from './data-contracts';
export * from './endpoints';    
`,
  });
};
