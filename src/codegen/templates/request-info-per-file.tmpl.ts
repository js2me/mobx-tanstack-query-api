/* eslint-disable unicorn/no-await-expression-member */
import {
  ParsedRoute,
  GenerateApiConfiguration,
  GenerateApiOutput,
} from 'swagger-typescript-api';

import type {
  AllImportFileParams,
  CodegenDataUtils,
  CodegenProcess,
  QueryApiParams,
} from '../index.js';

import { dataContractTmpl } from './data-contract.tmpl.js';
import { newRequestInfoTmpl } from './new-request-info.tmpl.js';
import { requestInfoJSDocTmpl } from './request-info-jsdoc.tmpl.js';

export interface RequestInfoPerFileTmplParams extends GenerateApiOutput {
  route: ParsedRoute;
  configuration: GenerateApiConfiguration;
  apiParams: QueryApiParams;
  codegenProcess: CodegenProcess;
  importFileParams: AllImportFileParams;
  utils: CodegenDataUtils;
}

export const requestInfoPerFileTmpl = async ({
  route,
  configuration,
  apiParams,
  formatTSContent,
  importFileParams,
  utils,
}: RequestInfoPerFileTmplParams) => {
  const { _ } = utils;

  const { content: requestInfoInstanceContent, reservedDataContractNames } =
    newRequestInfoTmpl({
      route,
      configuration,
      apiParams,
      importFileParams,
      utils,
    });

  const dataContactNames = new Set(
    Object.keys(
      (configuration.config.swaggerSchema as any)?.components?.schemas,
    ).map((schemaName) => utils.formatModelName(schemaName)),
  );

  const dataContractNamesInThisFile: string[] = [];

  reservedDataContractNames.forEach((reservedDataContractName) => {
    if (!dataContactNames.has(reservedDataContractName)) {
      dataContractNamesInThisFile.push(reservedDataContractName);
    }
  });

  return {
    reservedDataContractNames: dataContractNamesInThisFile,
    content: await formatTSContent(`/* eslint-disable */
      /* tslint:disable */
      import { RequestParams } from "mobx-tanstack-query-api";
      import { ${importFileParams.endpoint.exportName} } from "${importFileParams.endpoint.path}";
      import { ${importFileParams.httpClient.exportName} } from "${importFileParams.httpClient.path}";
      import { ${importFileParams.queryClient.exportName} } from "${importFileParams.queryClient.path}";
      ${
        configuration.modelTypes.length > 0
          ? `
      import { ${configuration.modelTypes
        .map((it) => it.name)
        .filter((it) => !dataContractNamesInThisFile.includes(it))
        .join(', ')} } from "../data-contracts";
      `
          : ''
      }

      ${(
        await Promise.all(
          dataContractNamesInThisFile.map(async (dataContractName) => {
            const modelType = configuration.modelTypes.find(
              (modelType) => modelType.name === dataContractName,
            );

            if (!modelType) {
              return '';
            }

            const contractType = await dataContractTmpl({
              configuration,
              contract: modelType,
              addExportKeyword: true,
            });

            return contractType;
          }),
        )
      )
        .filter(Boolean)
        .join('\n\n')}
      
      ${requestInfoJSDocTmpl({
        route,
        configuration,
        apiParams,
      })}
      export const ${_.camelCase(route.routeName.usage)} = ${requestInfoInstanceContent}
      `),
  };
};
