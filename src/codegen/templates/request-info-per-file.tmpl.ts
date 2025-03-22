import {
  ParsedRoute,
  GenerateApiConfiguration,
  GenerateApiOutput,
} from 'swagger-typescript-api';

import type { QueryApiParams } from '../index.js';

import { newRequestInfoTmpl } from './new-request-info.tmpl.js';
import { requestInfoJSDocTmpl } from './request-info-jsdoc.tmpl.js';

export interface RequestInfoPerFileTmplParams extends GenerateApiOutput {
  route: ParsedRoute;
  configuration: GenerateApiConfiguration;
  apiParams: QueryApiParams;
}

export const requestInfoPerFileTmpl = async ({
  route,
  configuration,
  apiParams,
  formatTSContent,
}: RequestInfoPerFileTmplParams) => {
  const dataContractNames = configuration.modelTypes.map((it) => it.name);
  const { utils } = configuration;
  const { _ } = utils;

  return await formatTSContent(`
/* eslint-disable */
/* tslint:disable */
import { RequestInfo, RequestParams } from "mobx-tanstack-query-api";
${
  dataContractNames.length > 0
    ? `
import { ${dataContractNames.join(', ')} } from "./data-contracts.ts";
`
    : ''
}

${requestInfoJSDocTmpl({
  route,
  configuration,
  apiParams,
})}
export const ${_.camelCase(route.routeName.usage)} = ${newRequestInfoTmpl({
    route,
    configuration,
    apiParams,
  })}
    `);
};
