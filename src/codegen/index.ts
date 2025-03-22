import {
  GenerateApiParams as GenerateApiParamsFromSwagger,
  ParsedRoute,
  generateApi as generateApiFromSwagger,
} from 'swagger-typescript-api';
import { AnyObject } from 'yummies/utils/types';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { requestInfoPerFileTmpl } from './templates/request-info-per-file.tmpl.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

export interface QueryApiParams {
  requestPathPrefix?: string;
  requestPathSuffix?: string;
  requestInfoPrefix?: string;
  outputType: 'request-info-per-file';

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

type GenerateApiParams = Omit<
  GenerateApiParamsFromSwagger,
  'output' | 'moduleNameFirstTag' | 'moduleNameIndex' | 'url' | 'input' | 'spec'
> & {
  output: string;
  input: string | AnyObject;
} & QueryApiParams;

export const generateApi = async (inputParams: GenerateApiParams) => {
  const { output, input, ...params } = inputParams;

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
    outputRequestsDir: path.resolve(output, 'requests'),
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

  let codegenProcess!: Parameters<
    Exclude<
      Required<
        Extract<GenerateApiParamsFromSwagger, { input: string }>['hooks']
      >,
      undefined
    >['onInit']
  >[1];

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
    },
  });

  const codegenFs = codegenProcess.fileSystem as any;

  codegenFs.cleanDir(output);
  codegenFs.createDir(output);

  codegenFs.createDir(paths.outputRequestsDir.toString());

  const allRoutes = Object.values(generated.configuration.routes)
    .flat()
    .flatMap((routeGroup) =>
      'routes' in routeGroup ? routeGroup.routes : routeGroup,
    );

  for await (const route of allRoutes) {
    const requestInfoPerFileContent = await requestInfoPerFileTmpl({
      ...generated,
      route,
      apiParams: inputParams,
    });

    codegenFs.createFile({
      path: paths.outputRequestsDir.toString(),
      fileName: `${generated.configuration.utils._.kebabCase(route.routeName.usage)}.ts`,
      withPrefix: false,
      content: requestInfoPerFileContent,
    });
  }
};
