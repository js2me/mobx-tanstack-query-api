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
import {
  DATA_CONTRACT_IMPORT_TOKEN,
  type ImportTmplEntry,
  importsTmpl,
} from './imports.tmpl.js';
import { newEndpointTmpl } from './new-endpoint.tmpl/index.js';
import { usesRuntimeEnumExports } from './utils/render-styled-string-enum.js';

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

  const dataContractNamesInThisFile = new Set<string>();
  const reservedDataContractNamesInFile = new Set<string>();
  const dataContactNames = collectComponentContractNames(
    swaggerSchema,
    utils.formatModelName,
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
    const { reservedDataContractNames, endpointAliasTypeNames } =
      newEndpointTemplateData;

    reservedDataContractNames.forEach((reservedDataContractName) => {
      reservedDataContractNamesInFile.add(reservedDataContractName);
    });

    for (const localName of collectEndpointLocalDataContractNames({
      dataContactNames: dataContactNames,
      reservedDataContractNames,
      endpointAliasTypeNames,
    })) {
      dataContractNamesInThisFile.add(localName);
    }

    return { ...newEndpointTemplateData, route };
  });
  const endpointAliasTypeNamesInFile = new Set<string>();
  newEndpointTemplates.forEach((template) => {
    template.endpointAliasTypeNames?.forEach((name) => {
      endpointAliasTypeNamesInFile.add(name);
    });
  });

  const endpointMetaTypeImports: ImportTmplEntry[] = [];

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
  const endpointTemplates = await Promise.all(
    newEndpointTemplates.map(
      async ({
        content: requestInfoInstanceContent,
        localModelTypes,
        route,
        contractsCode,
        operationDataAliasLine,
        operationErrorAliasLine,
        staOperationResponseAliasLine,
        operationSuccessResponseDisplayType,
      }) => {
        const requestInfoMeta = callEndpointMeta(
          codegenParams,
          route,
          utils,
          swaggerSchema,
        );

        if (requestInfoMeta?.typeNameImportPath && requestInfoMeta.typeName) {
          endpointMetaTypeImports.push({
            what: requestInfoMeta.typeName,
            from: requestInfoMeta.typeNameImportPath,
          });
        }

        const contractsResult =
          contractsCode != null && typeof contractsCode === 'object'
            ? contractsCode
            : null;
        const contractsBlock =
          contractsResult != null ? `\n\n${contractsResult.content}\n\n` : '';

        return `
      ${operationDataAliasLine ?? ''}
      ${operationErrorAliasLine ?? ''}
      ${staOperationResponseAliasLine ?? ''}
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
        operationSuccessResponseDisplayType,
      })}
      export const ${_.camelCase(route.routeName.usage)} = ${requestInfoInstanceContent}               
`;
      },
    ),
  );

  const endpointTemplatesContent = endpointTemplates
    .filter(Boolean)
    .join('\n\n');

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
      ...endpointMetaTypeImports.map(({ what, from }) => ({
        what,
        from: from && resolveGeneratedModuleSpecifier(from, codegenParams),
      })),
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
            groupName ? '../meta-info' : './meta-info',
            codegenParams,
          ),
      },
      {
        what: hasAnyZodContracts && '* as z',
        from: hasAnyZodContracts && 'zod',
      },
      {
        what: [...allZodContractImportNames].sort(),
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

      ${(
        await Promise.all(
          [...dataContractNamesInThisFile].map(async (dataContractName) => {
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
        !endpointAliasTypeNamesInFile.has(modelTypeName) &&
        !dataContractNamesInThisFile.has(modelTypeName) &&
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
    reservedDataContractNames: [...reservedDataContractNamesInFile],
    content: contentWithImportToken.replace(
      DATA_CONTRACT_IMPORT_TOKEN,
      dataContractImportLine,
    ),
  };
};
