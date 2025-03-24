import {
  ParsedRoute,
  GenerateApiConfiguration,
  GenerateApiOutput,
} from 'swagger-typescript-api';

import type {
  AllImportFileParams,
  CodegenProcess,
  QueryApiParams,
} from '../index.js';

import { newRequestInfoTmpl } from './new-request-info.tmpl.js';
import { requestInfoJSDocTmpl } from './request-info-jsdoc.tmpl.js';

export interface RequestInfoPerFileTmplParams extends GenerateApiOutput {
  route: ParsedRoute;
  configuration: GenerateApiConfiguration;
  apiParams: QueryApiParams;
  codegenProcess: CodegenProcess;
  importFileParams: AllImportFileParams;
}

export const requestInfoPerFileTmpl = async ({
  route,
  configuration,
  apiParams,
  formatTSContent,
  importFileParams,
}: RequestInfoPerFileTmplParams) => {
  const { utils } = configuration;
  const { _ } = utils;

  const { content: requestInfoInstanceContent, reservedDataContractNames } =
    newRequestInfoTmpl({
      route,
      configuration,
      apiParams,
      importFileParams,
    });

  return {
    reservedDataContractNames,
    content: await formatTSContent(`
      /* eslint-disable */
      /* tslint:disable */
      import { RequestParams } from "mobx-tanstack-query-api";
      import { ${importFileParams.requestInfo.exportName} } from "${importFileParams.requestInfo.path}";
      import { ${importFileParams.httpClient.exportName} } from "${importFileParams.httpClient.path}";
      import { ${importFileParams.queryClient.exportName} } from "${importFileParams.queryClient.path}";
      ${
        reservedDataContractNames.length > 0
          ? `
      import { ${reservedDataContractNames.join(', ')} } from "./data-contracts.ts";
      `
          : ''
      }
      
      ${requestInfoJSDocTmpl({
        route,
        configuration,
        apiParams,
      })}
      export const ${_.camelCase(route.routeName.usage)} = ${requestInfoInstanceContent}
      `),
  };
};
