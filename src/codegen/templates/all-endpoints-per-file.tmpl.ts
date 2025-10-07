import type { AnyObject, Maybe } from 'yummies/utils/types';
import type { BaseTmplParams, MetaInfo } from '../types/index.js';
import { LINTERS_IGNORE } from './constants.js';
import { dataContractTmpl } from './data-contract.tmpl.js';
import { endpointJSDocTmpl } from './endpoint-jsdoc.tmpl.js';
import { newEndpointTmpl } from './new-endpoint.tmpl.js';

export interface AllEndpointPerFileTmplParams extends BaseTmplParams {
  routes: AnyObject[];
  groupName: Maybe<string>;
  metaInfo: Maybe<MetaInfo>;
  relativePathDataContracts: string;
}

export const allEndpointPerFileTmpl = async (
  params: AllEndpointPerFileTmplParams,
) => {
  const {
    routes,
    configuration,
    codegenParams,
    formatTSContent,
    importFileParams,
    utils,
    relativePathDataContracts,
    groupName,
    metaInfo,
  } = params;

  const { _ } = utils;

  const dataContractNamesInThisFile: string[] = [];

  const newEndpointTemplates = routes.map((route) => {
    const newEndpointTemplateData = newEndpointTmpl({
      ...params,
      route,
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

  const extraImportLines: string[] = [];

  const endpointTemplates = await Promise.all(
    newEndpointTemplates.map(
      async ({
        content: requestInfoInstanceContent,
        localModelTypes,
        route,
      }) => {
        const requestInfoMeta = codegenParams.getEndpointMeta?.(route, utils);

        if (requestInfoMeta?.typeNameImportPath && requestInfoMeta.typeName) {
          extraImportLines.push(
            `import { ${requestInfoMeta.typeName} } from "${requestInfoMeta.typeNameImportPath}";`,
          );
        }

        return `
      ${(
        await Promise.all(
          localModelTypes.map(async (modelType) => {
            const contractType = await dataContractTmpl({
              ...params,
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
        ...params,
        route,
      })}
      export const ${_.camelCase(route.routeName.usage)} = ${requestInfoInstanceContent}               
`;
      },
    ),
  );

  if (metaInfo) {
    extraImportLines.push(
      `import { ${[groupName && 'Group', metaInfo?.namespace && 'namespace', 'Tag'].filter(Boolean).join(',')} } from "${groupName ? '../' : './'}meta-info";`,
    );
  }

  return {
    reservedDataContractNames: dataContractNamesInThisFile,
    content: await formatTSContent(`${LINTERS_IGNORE}
      import {
        RequestParams,
        HttpResponse,
        HttpMultistatusResponse,
      } from "${codegenParams.libImports?.['mobx-tanstack-query-api'] ?? 'mobx-tanstack-query-api'}";
      import { ${importFileParams.endpoint.exportName} } from "${importFileParams.endpoint.path}";
      import { ${importFileParams.httpClient.exportName} } from "${importFileParams.httpClient.path}";
      import { ${importFileParams.queryClient.exportName} } from "${importFileParams.queryClient.path}";
      ${extraImportLines.join('\n')}

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
              ...params,
              contract: modelType,
              addExportKeyword: true,
            });

            return contractType;
          }),
        )
      )
        .filter(Boolean)
        .join('\n\n')}

      ${endpointTemplates.filter(Boolean).join('\n\n')}
      `),
  };
};
