import type { AnyObject, Maybe } from 'yummies/utils/types';

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

export interface AllEndpointPerFileTmplParams extends AnyObject {
  routes: AnyObject[];
  configuration: AnyObject;
  apiParams: GenerateQueryApiParams;
  codegenProcess: CodegenProcess;
  importFileParams: AllImportFileParams;
  utils: CodegenDataUtils;
  relativePathDataContracts: string;
  groupName: Maybe<string>;
  metaInfo: Maybe<MetaInfo>;
}

export const allEndpointPerFileTmpl = async ({
  routes,
  configuration,
  apiParams,
  formatTSContent,
  importFileParams,
  utils,
  relativePathDataContracts,
  groupName,
  metaInfo,
}: AllEndpointPerFileTmplParams) => {
  const { _ } = utils;

  const dataContractNamesInThisFile: string[] = [];

  const newEndpointTemplates = routes.map((route) => {
    const newEndpointTemplateData = newEndpointTmpl({
      route,
      configuration,
      apiParams,
      importFileParams,
      utils,
      groupName,
      metaInfo,
    });
    const { reservedDataContractNames } = newEndpointTemplateData;

    const dataContactNames = new Set(
      Object.keys(
        (configuration.config.swaggerSchema as any)?.components?.schemas,
      ).map((schemaName) => utils.formatModelName(schemaName)),
    );

    reservedDataContractNames.forEach((reservedDataContractName) => {
      if (!dataContactNames.has(reservedDataContractName)) {
        dataContractNamesInThisFile.push(reservedDataContractName);
      }
    });

    return { ...newEndpointTemplateData, route };
  });

  let metaInfoImport: string = '';

  if (metaInfo) {
    metaInfoImport = `import { ${[groupName && 'Group', metaInfo?.namespace && 'namespace', 'Tag'].filter(Boolean).join(',')} } from "${groupName ? '../' : './'}meta-info";`;
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
          newEndpointTemplates.map(
            async ({
              content: requestInfoInstanceContent,
              localModelTypes,
              route,
            }) => {
              return `
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
      export const ${_.camelCase(route.routeName.usage)} = ${requestInfoInstanceContent}               
`;
            },
          ),
        )
      )
        .filter(Boolean)
        .join('\n\n')}
      `),
  };
};
