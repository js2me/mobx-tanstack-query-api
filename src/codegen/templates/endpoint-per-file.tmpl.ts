/* eslint-disable unicorn/no-await-expression-member */
import { AnyObject, Maybe } from 'yummies/utils/types';

import type {
  AllImportFileParams,
  CodegenDataUtils,
  CodegenProcess,
  GenerateQueryApiParams,
  MetaInfo,
} from '../index.js';

import { LINTERS_IGNORE } from './constants.js';
import { dataContractTmpl } from './data-contract.tmpl.js';
import { endpointJSDocTmpl } from './endpoint-jsdoc.tmpl.js';
import { newEndpointTmpl } from './new-endpoint.tmpl.js';

export interface EndpointPerFileTmplParams extends AnyObject {
  route: AnyObject;
  configuration: AnyObject;
  apiParams: GenerateQueryApiParams;
  codegenProcess: CodegenProcess;
  importFileParams: AllImportFileParams;
  utils: CodegenDataUtils;
  relativePathDataContracts: string;
  groupName: Maybe<string>;
  metaInfo: Maybe<MetaInfo>;
}

export const endpointPerFileTmpl = async ({
  route,
  configuration,
  apiParams,
  formatTSContent,
  importFileParams,
  utils,
  relativePathDataContracts,
  groupName,
  metaInfo,
}: EndpointPerFileTmplParams) => {
  const { _ } = utils;

  const {
    content: requestInfoInstanceContent,
    reservedDataContractNames,
    localModelTypes,
  } = newEndpointTmpl({
    route,
    configuration,
    apiParams,
    importFileParams,
    utils,
    groupName,
    metaInfo,
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

  let metaInfoImport: string = '';

  if (metaInfo) {
    metaInfoImport = `import { ${[groupName && 'Group', metaInfo?.namespace && 'namespace', 'Tag'].filter(Boolean).join(',')} } from "../${groupName ? '../' : ''}meta-info";`;
  }

  return {
    reservedDataContractNames: dataContractNamesInThisFile,
    content: await formatTSContent(`${LINTERS_IGNORE}
      import {
        RequestParams,
        HttpResponse,
        HttpMultistatusResponse,
      } from "${apiParams.libImports?.['mobx-tanstack-query-api'] ?? 'mobx-tanstack-query-api'}";
      import { ${importFileParams.endpoint.exportName} } from "${importFileParams.endpoint.path}";
      import { ${importFileParams.httpClient.exportName} } from "${importFileParams.httpClient.path}";
      import { ${importFileParams.queryClient.exportName} } from "${importFileParams.queryClient.path}";
      ${metaInfoImport}

      ${
        configuration.modelTypes.length > 0
          ? `
      import { ${configuration.modelTypes
        .map((it: AnyObject) => it.name)
        .filter(
          (it: any) => !dataContractNamesInThisFile.includes(it),
        )} } from "${relativePathDataContracts}";
      `
          : ''
      }

      ${(
        await Promise.all(
          dataContractNamesInThisFile.map(async (dataContractName) => {
            const modelType = configuration.modelTypes.find(
              (modelType: AnyObject) => modelType.name === dataContractName,
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

      ${(
        await Promise.all(
          localModelTypes.map(async (modelType) => {
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
      
      ${endpointJSDocTmpl({
        route,
        configuration,
        apiParams,
      })}
      /*#__PURE__*/
      export const ${_.camelCase(route.routeName.usage)} = ${requestInfoInstanceContent}
      `),
  };
};
