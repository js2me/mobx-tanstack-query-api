import type { ParsedRoute } from 'swagger-typescript-api';
import type { AnyObject, Maybe } from 'yummies/types';
import type { BaseTmplParams, MetaInfo } from '../types/index.js';
import { generateImport } from '../utils/generate-import.js';
import { callEndpointMeta } from '../utils/resolve-codegen-meta.js';
import { LINTERS_IGNORE } from './constants.js';
import { dataContractTmpl } from './data-contract.tmpl.js';
import { endpointJSDocTmpl } from './endpoint-jsdoc.tmpl.js';
import { newEndpointTmpl } from './new-endpoint.tmpl/index.js';

export interface AllEndpointPerFileTmplParams extends BaseTmplParams {
  routes: ParsedRoute[];
  groupName: Maybe<string>;
  metaInfo: Maybe<MetaInfo>;
  relativePathDataContracts: string;
  relativePathZodSchemas?: string | null;
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
    swaggerSchema,
    relativePathDataContracts,
    groupName,
    metaInfo,
    relativePathZodSchemas,
  } = params;

  const { _ } = utils;

  const dataContractNamesInThisFile: string[] = [];
  const dataContactNames = new Set(
    Object.keys(
      (configuration.config.swaggerSchema as any)?.components?.schemas,
    ).map((schemaName) => utils.formatModelName(schemaName)),
  );
  const newEndpointTemplates = routes.map((route) => {
    const newEndpointTemplateData = newEndpointTmpl({
      ...params,
      route,
      groupName,
      metaInfo,
      zodContracts: codegenParams.zodContracts,
      relativePathZodSchemas: relativePathZodSchemas ?? undefined,
    });
    const { reservedDataContractNames } = newEndpointTemplateData;

    reservedDataContractNames.forEach((reservedDataContractName) => {
      if (!dataContactNames.has(reservedDataContractName)) {
        dataContractNamesInThisFile.push(reservedDataContractName);
      }
    });

    return { ...newEndpointTemplateData, route };
  });

  const extraImportLines: string[] = [];

  const hasAnyZodContracts = newEndpointTemplates.some(
    (t) => t.contractsCode != null,
  );
  const allZodContractImportNames = new Set<string>();
  newEndpointTemplates.forEach((t) => {
    const c = t.contractsCode;
    if (
      c != null &&
      typeof c === 'object' &&
      c.zodContractImportNames?.length
    ) {
      for (const n of c.zodContractImportNames) {
        allZodContractImportNames.add(n);
      }
    }
  });
  const zodImportLine = hasAnyZodContracts ? 'import * as z from "zod";' : '';
  const zodSchemasImportLine =
    allZodContractImportNames.size && relativePathZodSchemas
      ? generateImport(
          [...allZodContractImportNames].sort(),
          relativePathZodSchemas,
          codegenParams,
        )
      : '';

  const endpointTemplates = await Promise.all(
    newEndpointTemplates.map(
      async ({
        content: requestInfoInstanceContent,
        localModelTypes,
        route,
        contractsCode,
      }) => {
        const requestInfoMeta = callEndpointMeta(
          codegenParams,
          route,
          utils,
          swaggerSchema,
        );

        if (requestInfoMeta?.typeNameImportPath && requestInfoMeta.typeName) {
          extraImportLines.push(
            generateImport(
              [requestInfoMeta.typeName],
              requestInfoMeta.typeNameImportPath,
              codegenParams,
            ),
          );
        }

        const contractsResult =
          contractsCode != null && typeof contractsCode === 'object'
            ? contractsCode
            : null;
        const contractsBlock =
          contractsResult != null ? `\n\n${contractsResult.content}\n\n` : '';

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
      ${contractsBlock}
      ${endpointJSDocTmpl({
        ...params,
        route,
      })}
      export const ${_.camelCase(route.routeName.usage)} = ${requestInfoInstanceContent}               
`;
      },
    ),
  );

  const endpointTemplatesContent = endpointTemplates
    .filter(Boolean)
    .join('\n\n');

  if (metaInfo) {
    const metaFrom = groupName ? '../meta-info' : './meta-info';
    extraImportLines.push(
      generateImport(
        [groupName && 'Group', metaInfo.namespace && 'namespace', 'Tag'],
        metaFrom,
        codegenParams,
      ),
    );
  }

  const dataContractImportToken = '/*__DATA_CONTRACT_IMPORTS__*/';
  const contentWithImportToken = await formatTSContent(`${LINTERS_IGNORE}
      import {
        RequestParams,
        HttpResponse,
        HttpMultistatusResponse,
      } from "${codegenParams.libImports?.['mobx-tanstack-query-api'] ?? 'mobx-tanstack-query-api'}";
      import { ${importFileParams.endpoint.exportName} } from "${importFileParams.endpoint.path}";
      import { ${importFileParams.httpClient.exportName} } from "${importFileParams.httpClient.path}";
      import { ${importFileParams.queryClient.exportName} } from "${importFileParams.queryClient.path}";
      ${extraImportLines.join('\n')}
      ${[zodImportLine, zodSchemasImportLine].filter(Boolean).join('\n')}
      ${dataContractImportToken}

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

      ${endpointTemplatesContent}
      `);

  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const usedDataContractNames = configuration.modelTypes
    .map((modelType: AnyObject) => modelType.name as string)
    .filter(
      (modelTypeName) =>
        !dataContractNamesInThisFile.includes(modelTypeName) &&
        dataContactNames.has(modelTypeName) &&
        new RegExp(`\\b${escapeRegExp(modelTypeName)}\\b`).test(
          contentWithImportToken,
        ),
    );

  const dataContractImportLine =
    usedDataContractNames.length > 0
      ? generateImport(
          usedDataContractNames,
          relativePathDataContracts,
          codegenParams,
        )
      : '';

  return {
    reservedDataContractNames: dataContractNamesInThisFile,
    content: contentWithImportToken.replace(
      dataContractImportToken,
      dataContractImportLine,
    ),
  };
};
