import type { ParsedRoute } from 'swagger-typescript-api';
import type { AnyObject, Maybe } from 'yummies/types';
import type { BaseTmplParams, MetaInfo } from '../types/index.js';
import { collectEndpointLocalDataContractNames } from '../utils/data-contract-exclusion.js';
import {
  generateImport,
  resolveGeneratedModuleSpecifier,
} from '../utils/generate-import.js';
import { callEndpointMeta } from '../utils/resolve-codegen-meta.js';
import { collectComponentContractNames } from '../utils/swagger/collect-component-names.js';
import { LINTERS_IGNORE } from './constants.js';
import { dataContractTmpl } from './data-contract.tmpl.js';
import { endpointJSDocTmpl } from './endpoint-jsdoc.tmpl.js';
import { DATA_CONTRACT_IMPORT_TOKEN, importsTmpl } from './imports.tmpl.js';
import { newEndpointTmpl } from './new-endpoint.tmpl/index.js';
import { usesRuntimeEnumExports } from './utils/render-styled-string-enum.js';

export interface EndpointPerFileTmplParams extends BaseTmplParams {
  route: ParsedRoute;
  relativePathDataContracts: string;
  groupName: Maybe<string>;
  metaInfo: Maybe<MetaInfo>;
  /** When set (e.g. '../contracts'), endpoint imports shared Zod contracts from this path instead of inlining them */
  relativePathZodSchemas?: string | null;
}

export const endpointPerFileTmpl = async (
  params: EndpointPerFileTmplParams,
) => {
  const {
    route,
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

  const requestInfoTemplateResult = newEndpointTmpl({
    ...params,
    route,
    groupName,
    metaInfo,
    zodContracts: codegenParams.zodContracts,
    relativePathZodSchemas: relativePathZodSchemas ?? undefined,
  });

  const {
    content: requestInfoInstanceContent,
    reservedDataContractNames,
    localModelTypes,
    contractsCode,
  } = requestInfoTemplateResult;

  const dataContactNames = collectComponentContractNames(
    swaggerSchema,
    utils.formatModelName,
  );

  const dataContractNamesInThisFile = collectEndpointLocalDataContractNames({
    dataContactNames: dataContactNames,
    reservedDataContractNames,
    endpointAliasTypeNames: requestInfoTemplateResult.endpointAliasTypeNames,
  });

  const requestInfoMeta = callEndpointMeta(
    codegenParams,
    route,
    utils,
    swaggerSchema,
  );
  const contractsResult =
    contractsCode != null && typeof contractsCode === 'object'
      ? contractsCode
      : null;
  const contractsBlock =
    contractsResult != null ? `\n\n${contractsResult.content}\n\n` : '';
  const endpointAliasesBlock = [
    requestInfoTemplateResult.operationDataAliasLine,
    requestInfoTemplateResult.operationErrorAliasLine,
    requestInfoTemplateResult.staOperationResponseAliasLine,
  ]
    .filter(Boolean)
    .join('\n');
  const importsBlock = importsTmpl({
    imports: [
      {
        what: ['RequestParams', 'HttpResponse', 'HttpMultistatusResponse'],
        from: codegenParams.libImports['mobx-tanstack-query-api'],
      },
      {
        what: importFileParams.endpoint.exportName,
        from: resolveGeneratedModuleSpecifier(
          importFileParams.endpoint.path,
          codegenParams,
        ),
      },
      !importFileParams.skipHttpClient && {
        what: importFileParams.httpClient.exportName,
        from: resolveGeneratedModuleSpecifier(
          importFileParams.httpClient.path,
          codegenParams,
        ),
      },
      !importFileParams.skipQueryClient && {
        what: importFileParams.queryClient.exportName,
        from: resolveGeneratedModuleSpecifier(
          importFileParams.queryClient.path,
          codegenParams,
        ),
      },
      {
        what:
          metaInfo &&
          [
            usesRuntimeEnumExports(codegenParams.enumStyle) &&
              groupName &&
              'Group',
            metaInfo.namespace && 'namespace',
            usesRuntimeEnumExports(codegenParams.enumStyle) && 'Tag',
          ].filter(Boolean),
        from:
          metaInfo &&
          resolveGeneratedModuleSpecifier(
            `../${groupName ? '../' : ''}meta-info`,
            codegenParams,
          ),
      },
      {
        what: requestInfoMeta?.typeName,
        from:
          requestInfoMeta?.typeNameImportPath &&
          resolveGeneratedModuleSpecifier(
            requestInfoMeta.typeNameImportPath,
            codegenParams,
          ),
      },
      {
        what: contractsResult != null && '* as z',
        from: contractsResult != null && 'zod',
      },
      {
        what: contractsResult?.zodContractImportNames,
        from:
          relativePathZodSchemas &&
          resolveGeneratedModuleSpecifier(
            relativePathZodSchemas,
            codegenParams,
          ),
      },
      DATA_CONTRACT_IMPORT_TOKEN,
    ],
  });
  const contentWithImportToken = await formatTSContent(`${LINTERS_IGNORE}
      ${importsBlock}
      ${endpointAliasesBlock}

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
        operationSuccessResponseDisplayType:
          requestInfoTemplateResult.operationSuccessResponseDisplayType,
      })}
      export const ${_.camelCase(route.routeName.usage)} = ${requestInfoInstanceContent}
      `);

  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const usedDataContractNames = configuration.modelTypes
    .map((modelType: AnyObject) => modelType.name as string)
    .filter(
      (modelTypeName) =>
        !requestInfoTemplateResult.endpointAliasTypeNames?.includes(
          modelTypeName,
        ) &&
        modelTypeName !==
          requestInfoTemplateResult.staResponseAliasReplacesContractName &&
        !dataContractNamesInThisFile.includes(modelTypeName) &&
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
    reservedDataContractNames,
    content: contentWithImportToken.replace(
      DATA_CONTRACT_IMPORT_TOKEN,
      dataContractImportLine,
    ),
  };
};
