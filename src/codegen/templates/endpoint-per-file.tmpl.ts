import type { ParsedRoute } from 'swagger-typescript-api';
import type { AnyObject, Maybe } from 'yummies/types';
import type { BaseTmplParams, MetaInfo } from '../types/index.js';
import { generateImport } from '../utils/generate-import.js';
import { callEndpointMeta } from '../utils/resolve-codegen-meta.js';
import { LINTERS_IGNORE } from './constants.js';
import { dataContractTmpl } from './data-contract.tmpl.js';
import { endpointJSDocTmpl } from './endpoint-jsdoc.tmpl.js';
import {
  type NewEndpointTmplParams,
  newEndpointTmpl,
} from './new-endpoint.tmpl.js';

export type PrecomputedNewEndpoint = ReturnType<typeof newEndpointTmpl>;

export interface EndpointPerFileTmplParams extends BaseTmplParams {
  route: ParsedRoute;
  relativePathDataContracts: string;
  groupName: Maybe<string>;
  metaInfo: Maybe<MetaInfo>;
  /** When set (e.g. '../contracts'), endpoint imports shared Zod contracts from this path instead of inlining them */
  relativePathZodSchemas?: string | null;
  /** Skip `newEndpointTmpl` and use this (two-phase endpoint generation). */
  precomputedNewEndpoint?: PrecomputedNewEndpoint;
  /**
   * Schema-backed data contracts in this set are inlined into this file (same as synthetic types).
   * Used for types that appear in exactly one endpoint so they stay out of `data-contracts.ts`.
   */
  inlineSchemaDataContractNames?: ReadonlySet<string>;
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
    relativePathDataContracts,
    groupName,
    metaInfo,
    relativePathZodSchemas,
    precomputedNewEndpoint,
    inlineSchemaDataContractNames,
  } = params;
  const { _ } = utils;

  const newEndpointParams: NewEndpointTmplParams = {
    ...params,
    route,
    groupName,
    metaInfo,
    zodContracts: codegenParams.zodContracts,
    relativePathZodSchemas: relativePathZodSchemas ?? undefined,
  };

  const {
    content: requestInfoInstanceContent,
    reservedDataContractNames: endpointReservedDataContractNames,
    localModelTypes,
    contractsCode,
  } = precomputedNewEndpoint ?? newEndpointTmpl(newEndpointParams);

  const dataContactNames = new Set(
    Object.keys(
      (configuration.config.swaggerSchema as any)?.components?.schemas,
    ).map((schemaName) => utils.formatModelName(schemaName)),
  );

  const dataContractNamesInThisFile: string[] = [];

  endpointReservedDataContractNames.forEach((reservedDataContractName) => {
    if (
      precomputedNewEndpoint?.endpointOnlyDataContractNames?.has(
        reservedDataContractName,
      )
    ) {
      return;
    }
    const inlineSchema =
      (inlineSchemaDataContractNames?.has(reservedDataContractName) ?? false) &&
      !(
        precomputedNewEndpoint?.forceSharedDataContractNames?.has(
          reservedDataContractName,
        ) ?? false
      );
    if (!dataContactNames.has(reservedDataContractName) || inlineSchema) {
      dataContractNamesInThisFile.push(reservedDataContractName);
    }
  });

  const extraImportLines: string[] = [];

  if (metaInfo) {
    const metaFrom = `../${groupName ? '../' : ''}meta-info`;
    extraImportLines.push(
      generateImport(
        [groupName && 'Group', metaInfo.namespace && 'namespace', 'Tag'],
        metaFrom,
        codegenParams,
      ),
    );
  }

  const requestInfoMeta = callEndpointMeta(codegenParams, route, utils);

  if (requestInfoMeta?.typeNameImportPath && requestInfoMeta.typeName) {
    extraImportLines.push(
      generateImport(
        [requestInfoMeta.typeName],
        requestInfoMeta.typeNameImportPath,
        codegenParams,
      ),
    );
  }

  const dataContractImportToken = '/*__DATA_CONTRACT_IMPORTS__*/';
  const contractsResult =
    contractsCode != null && typeof contractsCode === 'object'
      ? contractsCode
      : null;
  const zodImportLine =
    contractsResult != null ? 'import * as z from "zod";' : '';
  const zodSchemasImportLine =
    contractsResult?.zodContractImportNames?.length && relativePathZodSchemas
      ? generateImport(
          contractsResult.zodContractImportNames,
          relativePathZodSchemas,
          codegenParams,
        )
      : '';
  const contractsBlock =
    contractsResult != null ? `\n\n${contractsResult.content}\n\n` : '';
  const zodImportsBlock = [zodImportLine, zodSchemasImportLine]
    .filter(Boolean)
    .join('\n');
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
      ${zodImportsBlock}
      ${dataContractImportToken}${
        precomputedNewEndpoint?.staOperationResponseAliasLine
          ? `

${precomputedNewEndpoint.staOperationResponseAliasLine}
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
          precomputedNewEndpoint?.operationSuccessResponseDisplayType,
      })}
      export const ${_.camelCase(route.routeName.usage)} = ${requestInfoInstanceContent}
      `);

  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const usedDataContractNames = configuration.modelTypes
    .map((modelType: AnyObject) => modelType.name as string)
    .filter(
      (modelTypeName) =>
        modelTypeName !==
          precomputedNewEndpoint?.staResponseAliasReplacesContractName &&
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
    reservedDataContractNames: endpointReservedDataContractNames,
    content: contentWithImportToken.replace(
      dataContractImportToken,
      dataContractImportLine,
    ),
  };
};
