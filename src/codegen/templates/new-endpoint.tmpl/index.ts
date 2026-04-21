import {
  camelCase,
  compact,
  join,
  map,
  sortBy,
  uniq,
  upperCase,
  upperFirst,
  values,
} from 'lodash-es';
import type { ParsedRoute } from 'swagger-typescript-api';
import { callFunction } from 'yummies/common';
import type { AnyObject, Maybe } from 'yummies/types';
import type { BaseTmplParams } from '../../types/base-tmpl-params.js';
import type {
  GenerateQueryApiParams,
  MetaInfo,
  RouteBaseInfo,
} from '../../types/index.js';
import { createShortModelType } from '../../utils/create-short-model-type.js';
import { DEFAULT_DATA_CONTRACT_TYPE_SUFFIX } from '../../utils/data-contract-type-suffix.js';
import {
  callEndpointMeta,
  callRequestMeta,
} from '../../utils/resolve-codegen-meta.js';
import { typeNameToSchemaKey } from '../../utils/zod/build-endpoint-zod-contracts-code.js';
import {
  formatGroupNameEnumKey,
  formatTagNameEnumKey,
} from '../meta-info.tmpl.js';
import { buildZodEndpointData } from './utils/build-zod-endpoint-data.js';
import { chooseOpenApiServer } from './utils/choose-open-api-server.js';
import { getRequestBodyContentType } from './utils/get-request-body-content-type.js';
import { getResponseFormat } from './utils/get-response-format.js';
import { getResponseSchemaKey } from './utils/get-response-schema-key.js';
import { normalizeBaseUrlForPath } from './utils/normalize-base-url-for-path.js';
import { overrideRequestParamsToSpreadLine } from './utils/override-request-params-to-spread-line.js';
import { tmplDataToSourceExpr } from './utils/tmpl-data-to-source-expr.js';

type RuntimeExpressionOrBoolean = string | boolean;
type RuntimeContractsRule =
  | RuntimeExpressionOrBoolean
  | {
      params?: RuntimeExpressionOrBoolean;
      data?: RuntimeExpressionOrBoolean;
    };

export type ZodContractsOption = NonNullable<
  GenerateQueryApiParams['zodContracts']
>;

export interface NewEndpointTmplParams extends BaseTmplParams {
  route: ParsedRoute;
  groupName: Maybe<string>;
  metaInfo: Maybe<MetaInfo>;
  /** Generate Zod contracts and optionally enable validation. */
  zodContracts?: ZodContractsOption;
  /** When set, shared Zod contracts are not inlined; endpoint imports them from this path (e.g. '../../contracts') */
  relativePathZodSchemas?: string | null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
export const newEndpointTmpl = (params: NewEndpointTmplParams) => {
  const {
    route,
    codegenParams,
    importFileParams,
    utils,
    groupName,
    metaInfo,
    filterTypes,
    configuration,
    zodContracts,
    swaggerSchema,
  } = params;

  const zodContractsIsObject =
    typeof zodContracts === 'object' && zodContracts !== null;
  const dataContractTypeSuffix =
    codegenParams.dataContractTypeSuffix === false
      ? ''
      : (codegenParams.dataContractTypeSuffix ??
        DEFAULT_DATA_CONTRACT_TYPE_SUFFIX);
  const positiveResponseTypes = route.raw.responsesTypes?.filter(
    (it) =>
      +it.status >= 200 &&
      +it.status < 300 &&
      (!(it as AnyObject).typeData ||
        filterTypes((it as AnyObject).typeData, swaggerSchema)),
  );

  const { requestBodyInfo, responseBodyInfo } = route as AnyObject;
  const routeRequest = route.request as AnyObject;
  const routeResponse = route.response;

  const { parameters, path, method, payload, query, requestParams, security } =
    routeRequest;
  const { raw } = route;
  const queryName = query?.name || 'query';
  const pathParams = values(parameters);
  const pathParamsNames = map(pathParams, 'name');

  type RequestParam = {
    name: string;
    optional?: boolean;
    type: string;
    defaultValue?: string;
  };

  const requestConfigParam: RequestParam = {
    name: 'requestParams',
    optional: true,
    type: 'RequestParams',
    defaultValue: '{}',
  };

  const inputParams = [
    ...pathParams,
    payload,
    query,
    requestConfigParam,
  ].filter(Boolean);

  const defaultOkResponse = positiveResponseTypes?.[0]?.type || 'unknown';

  const foundErrorModelType =
    (routeResponse.errorType &&
      configuration.modelTypes.find(
        (it) => it.name === routeResponse.errorType,
      )) ||
    null;

  const requestOutputErrorType = foundErrorModelType
    ? routeResponse.errorType
    : 'any';
  const defaultBadResponse = requestOutputErrorType;
  const endpointBaseTypeName = upperFirst(camelCase(route.routeName.usage));
  const operationDataTypeName = `${endpointBaseTypeName}DataDC`;
  const operationErrorTypeName = `${endpointBaseTypeName}ErrorDC`;
  const preferExistingResultTypeAsData = /Result(?:[A-Z0-9_]*)?$/.test(
    defaultOkResponse,
  );

  let responseSchemaKey = getResponseSchemaKey(route);

  if (
    !responseSchemaKey &&
    swaggerSchema?.components?.schemas &&
    configuration.modelTypes
  ) {
    const aliasType = configuration.modelTypes.find(
      (m: AnyObject) => m.name === defaultOkResponse,
    );
    if (
      aliasType?.typeIdentifier === 'type' &&
      typeof aliasType.content === 'string' &&
      /^[A-Za-z0-9_]+$/.test(aliasType.content.trim())
    ) {
      const resolved = typeNameToSchemaKey(
        aliasType.content.trim(),
        dataContractTypeSuffix,
      );
      if (resolved in swaggerSchema.components.schemas) {
        responseSchemaKey = resolved;
      }
    }
  }

  if (!responseSchemaKey && swaggerSchema?.components?.schemas) {
    const match = defaultOkResponse.match(/^Get(.+)DataDC$/);
    if (match) {
      const candidate = match[1];
      if (candidate in swaggerSchema.components.schemas) {
        responseSchemaKey = candidate;
      }
    }
  }

  const resolvedSuccessTypeName =
    responseSchemaKey != null
      ? (configuration.modelTypes.find((modelType: AnyObject) => {
          if (typeof modelType.name !== 'string') {
            return false;
          }
          return (
            typeNameToSchemaKey(modelType.name, dataContractTypeSuffix) ===
            responseSchemaKey
          );
        })?.name as string | undefined)
      : undefined;

  const outputSuffix = `Output${dataContractTypeSuffix}`;
  const isStaOutputAlias = defaultOkResponse.endsWith(outputSuffix);
  const isResolvedResultType =
    typeof resolvedSuccessTypeName === 'string' &&
    /Result(?:[A-Z0-9_]*)?$/.test(resolvedSuccessTypeName);
  const useCollisionAliasRecovery = isStaOutputAlias && isResolvedResultType;
  const effectiveOkResponseType = useCollisionAliasRecovery
    ? (resolvedSuccessTypeName as string)
    : defaultOkResponse;

  const failSuffix = `Fail${dataContractTypeSuffix}`;
  const errorSuffix = `Error${dataContractTypeSuffix}`;
  const canUseReverseFailAlias =
    typeof requestOutputErrorType === 'string' &&
    requestOutputErrorType !== 'any' &&
    requestOutputErrorType.endsWith(failSuffix) &&
    operationErrorTypeName.endsWith(errorSuffix) &&
    requestOutputErrorType.slice(0, -failSuffix.length) ===
      operationErrorTypeName.slice(0, -errorSuffix.length);

  const zodData = buildZodEndpointData({
    ...params,
    inputParams,
    defaultOkResponse,
    dataContractTypeSuffix,
    responseSchemaKey,
    queryName,
  });

  const getArgs = ({
    withPayload,
    withRequestConfigParam,
  }: {
    withPayload?: boolean;
    withRequestConfigParam?: boolean;
  }): RequestParam[] => {
    return sortBy(
      compact([
        ...(requestParams
          ? [
              {
                name:
                  pathParams.length > 0
                    ? `{ ${join(pathParamsNames, ', ')}, ...${queryName} }`
                    : queryName,
                optional: false,
                type: utils.getInlineParseContent(requestParams),
              },
            ]
          : pathParams),
        withPayload && payload,
        withRequestConfigParam && requestConfigParam,
      ]),
      [(o: AnyObject) => o.optional],
    );
  };

  const tags = (raw.tags || []).filter(Boolean);
  const requestOutputDataTypes = positiveResponseTypes.map((it, index) =>
    index === 0 && useCollisionAliasRecovery
      ? effectiveOkResponseType
      : it.type,
  );
  const reservedErrorContractType = canUseReverseFailAlias
    ? operationErrorTypeName
    : requestOutputErrorType || 'any';
  const operationIdDataContractName = operationDataTypeName;

  const pathParamsToInline = path.split('/').slice(1) as string[];

  let lastDynamicStructPos = 0;

  const queryParamStruct =
    query == null
      ? null
      : {
          type: 'dynamic',
          key: 'params',
          i: pathParamsToInline.length,
          param: lastDynamicStructPos > 0 ? lastDynamicStructPos - 1 : 0,
        };

  if (queryParamStruct && !lastDynamicStructPos) {
    lastDynamicStructPos++;
  }

  const requestInfoMeta = callEndpointMeta(
    codegenParams,
    route,
    utils,
    swaggerSchema,
  );
  const requestMeta = callRequestMeta(
    codegenParams,
    route,
    utils,
    swaggerSchema,
  );
  const routeBaseInfo: RouteBaseInfo = {
    operationId: raw.operationId ?? '',
    path,
    method,
    contractName: zodData?.contractVarName,
  };

  const overrideRequestParamsSpreadLine = overrideRequestParamsToSpreadLine(
    callFunction(
      codegenParams.overrideRequestParams,
      routeBaseInfo,
      swaggerSchema,
    ),
  );

  const resultPath =
    (callFunction(
      codegenParams.requestPathPrefix,
      routeBaseInfo,
      swaggerSchema,
    ) || '') +
    path +
    (callFunction(
      codegenParams.requestPathSuffix,
      routeBaseInfo,
      swaggerSchema,
    ) || '');

  const bodyContentType =
    getRequestBodyContentType(
      requestBodyInfo,
      raw,
      configuration as AnyObject,
      path,
      method,
    ) || null;
  const responseFormat =
    getResponseFormat(
      responseBodyInfo,
      raw,
      configuration as AnyObject,
      path,
      method,
    ) || null;

  const reservedDataContractNames: string[] = [
    ...requestOutputDataTypes,
    reservedErrorContractType,
    requestOutputErrorType || 'any',
    ...getArgs({
      withPayload: true,
    }).map((it) => it.type),
  ];

  const pathDeclaration = resultPath.replaceAll('$', '');
  const staOperationResponseAliasLine =
    positiveResponseTypes?.length === 1 &&
    responseFormat === '"blob"' &&
    defaultOkResponse === effectiveOkResponseType &&
    operationIdDataContractName !== operationDataTypeName &&
    defaultOkResponse !== operationIdDataContractName
      ? `export type ${operationIdDataContractName} = ${defaultOkResponse};`
      : undefined;
  const operationDataAliasLine =
    (useCollisionAliasRecovery || !preferExistingResultTypeAsData) &&
    effectiveOkResponseType !== operationDataTypeName
      ? `export type ${operationDataTypeName} = ${effectiveOkResponseType};`
      : undefined;
  const operationErrorAliasLine =
    requestOutputErrorType !== operationErrorTypeName
      ? canUseReverseFailAlias
        ? `export type ${requestOutputErrorType} = ${operationErrorTypeName};`
        : `export type ${operationErrorTypeName} = ${requestOutputErrorType};`
      : undefined;
  const operationErrorAliasTypeName = operationErrorAliasLine
    ? canUseReverseFailAlias
      ? requestOutputErrorType
      : operationErrorTypeName
    : null;
  const staResponseAliasReplacesContractName = staOperationResponseAliasLine
    ? operationIdDataContractName
    : undefined;
  const operationSuccessResponseDisplayType = staOperationResponseAliasLine
    ? operationIdDataContractName
    : useCollisionAliasRecovery
      ? operationDataTypeName
      : preferExistingResultTypeAsData
        ? defaultOkResponse
        : operationDataTypeName;
  const endpointAliasTypeNames = uniq(
    [
      operationDataAliasLine ? operationDataTypeName : null,
      operationErrorAliasTypeName,
      staOperationResponseAliasLine ? operationIdDataContractName : null,
    ].filter(Boolean) as string[],
  );
  if (operationDataAliasLine) {
    reservedDataContractNames.push(operationDataTypeName);
  }
  if (operationErrorAliasLine) {
    reservedDataContractNames.push(operationErrorTypeName);
  }
  if (staOperationResponseAliasLine) {
    reservedDataContractNames.push(operationIdDataContractName);
  }

  const getHttpRequestGenerics = () => {
    const responses =
      raw.responsesTypes?.filter(
        (it) =>
          it.status !== 'default' &&
          (!(it as AnyObject).typeData ||
            filterTypes((it as AnyObject).typeData, swaggerSchema)),
      ) || [];

    if (!responses?.length) {
      return `HttpResponse<unknown, ${requestOutputErrorType}>`;
    }

    if (responses.length === 1 && responses[0].isSuccess) {
      const successType = staResponseAliasReplacesContractName
        ? staResponseAliasReplacesContractName
        : useCollisionAliasRecovery
          ? operationDataTypeName
          : preferExistingResultTypeAsData
            ? responses[0].type
            : operationDataTypeName;
      const errorType = canUseReverseFailAlias
        ? requestOutputErrorType
        : operationErrorTypeName;
      return `HttpResponse<${successType}, ${errorType}>`;
    }

    return `HttpMultistatusResponse<{
  ${responses
    .map((it: AnyObject) => {
      return [
        it.description && `/** ${it.description} */`,
        `${it.status}: ${it.type};`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n')}
  },
  ${defaultOkResponse},
  ${defaultBadResponse}
  >`;
  };

  const requestInputTypeDc = createShortModelType({
    typeIdentifier: 'type',
    name: upperFirst(camelCase(`${route.routeName.usage}Params`)),
    content: `{
    ${inputParams
      .map(({ name, optional, type }) => {
        return `${name}${optional ? '?' : ''}:${type}`;
      })
      .filter(Boolean)
      .join(', ')}
  }`,
  });

  const isAllowedInputType = filterTypes(requestInputTypeDc, swaggerSchema);

  const validateOpt = zodContractsIsObject
    ? callFunction(
        zodContracts.validate,
        routeBaseInfo.contractName!,
        routeBaseInfo,
        swaggerSchema,
      )
    : zodContracts === true
      ? true
      : undefined;
  const throwOpt = zodContractsIsObject
    ? callFunction(
        zodContracts.throw,
        routeBaseInfo.contractName!,
        routeBaseInfo,
        swaggerSchema,
      )
    : undefined;
  const isRuntimeContractsRuleObject = (
    value: RuntimeContractsRule | undefined,
  ): value is {
    params?: RuntimeExpressionOrBoolean;
    data?: RuntimeExpressionOrBoolean;
  } => value != null && typeof value === 'object' && !Array.isArray(value);
  const validateOptObj = isRuntimeContractsRuleObject(validateOpt)
    ? validateOpt
    : null;
  const throwOptObj = isRuntimeContractsRuleObject(throwOpt) ? throwOpt : null;

  const serverBaseUrl = chooseOpenApiServer({
    swaggerSchema,
    route,
    chooseServer: codegenParams.chooseServer,
  })?.url;

  const formattedBaseUrl = (() => {
    if (serverBaseUrl == null) {
      return undefined;
    }

    const formatBaseUrlOption = codegenParams.formatBaseUrl ?? 'normalize';
    if (formatBaseUrlOption === 'as-is') {
      return serverBaseUrl;
    }
    if (formatBaseUrlOption === 'normalize') {
      return normalizeBaseUrlForPath(serverBaseUrl, resultPath);
    }
    return callFunction(
      formatBaseUrlOption,
      serverBaseUrl,
      routeBaseInfo,
      swaggerSchema,
    );
  })();

  const baseUrlLine =
    formattedBaseUrl != null && formattedBaseUrl !== ''
      ? `baseUrl: ${JSON.stringify(formattedBaseUrl)},`
      : '';

  const appendRuleOpt =
    zodContractsIsObject && zodContracts.appendRule != null
      ? callFunction(
          zodContracts.appendRule,
          routeBaseInfo.contractName!,
          routeBaseInfo,
          swaggerSchema,
        )
      : null;

  const contractLine = (() => {
    if (zodData?.contractVarName == null) return '';
    if (typeof appendRuleOpt === 'string')
      return `contract: ${appendRuleOpt} ? ${zodData?.contractVarName} : undefined,`;
    if (appendRuleOpt === false) return 'contract: undefined,';
    if (appendRuleOpt === true) return `contract: ${zodData?.contractVarName},`;
    return `contract: ${zodData?.contractVarName},`;
  })();

  const validateContractLine = (() => {
    if (validateOpt === undefined) return '';
    if (typeof validateOpt === 'string')
      return `validateContract: ${validateOpt},`;
    if (typeof validateOpt === 'boolean')
      return `validateContract: ${validateOpt},`;
    if (validateOptObj !== null) {
      const parts: string[] = [];
      if (validateOptObj.params !== undefined)
        parts.push(
          `params: ${typeof validateOptObj.params === 'string' ? validateOptObj.params : validateOptObj.params}`,
        );
      if (validateOptObj.data !== undefined)
        parts.push(
          `data: ${typeof validateOptObj.data === 'string' ? validateOptObj.data : validateOptObj.data}`,
        );
      return parts.length > 0
        ? `validateContract: { ${parts.join(', ')} },`
        : '';
    }
    return '';
  })();
  const throwContractsLine = (() => {
    if (throwOpt === undefined) return '';
    if (typeof throwOpt === 'string') return `throwContracts: ${throwOpt},`;
    if (typeof throwOpt === 'boolean') return `throwContracts: ${throwOpt},`;
    if (throwOptObj !== null) {
      const parts: string[] = [];
      if (throwOptObj.params !== undefined)
        parts.push(`params: ${throwOptObj.params}`);
      if (throwOptObj.data !== undefined)
        parts.push(`data: ${throwOptObj.data}`);
      return parts.length > 0 ? `throwContracts: { ${parts.join(', ')} },` : '';
    }
    return '';
  })();

  return {
    reservedDataContractNames: uniq(reservedDataContractNames),
    localModelTypes: isAllowedInputType ? [requestInputTypeDc] : [],
    contractsCode: zodData?.contractsCode ?? undefined,
    contractsVarName: zodData?.contractVarName ?? undefined,
    endpointAliasTypeNames,
    operationDataAliasLine,
    operationErrorAliasLine,
    staOperationResponseAliasLine,
    staResponseAliasReplacesContractName,
    operationSuccessResponseDisplayType,
    content: `
new ${importFileParams.endpoint.exportName}<
  ${getHttpRequestGenerics()},
  ${isAllowedInputType ? requestInputTypeDc.name : 'any'},
  ${requestInfoMeta?.typeName ?? 'any'}
>(
    {
        params: ({
  ${inputParams.map((it) => it.name)}
}) => ({
            ${baseUrlLine}
            path: \`${resultPath}\`,
            method: '${upperCase(method)}',
            ${requestMeta?.tmplData ? `meta: ${tmplDataToSourceExpr(requestMeta.tmplData)},` : ''}
            ${query == null ? '' : `query: ${query.name},`}
            ${payload?.name ? `body: ${payload.name},` : ''}
            ${security ? 'secure: true,' : ''}
            ${bodyContentType ? `contentType: ${bodyContentType},` : ''}
            ${responseFormat ? `format: ${responseFormat},` : ''}
            ${overrideRequestParamsSpreadLine ?? ''}
            ...${requestConfigParam.name},
        }),
        requiredParams: [${inputParams.filter((it) => !it.optional).map((it) => `"${it.name}"`)}],
        operationId: "${raw.operationId || camelCase(route.routeName.usage)}",
        path: [${pathDeclaration
          .split('/')
          .filter(Boolean)
          .map((it) => `"${it}"`)}],
        tags: [${tags.map((tag: string) => {
          if (metaInfo) {
            return `Tag.${formatTagNameEnumKey(tag, utils)}`;
          }
          return `"${tag}"`;
        })}],
        ${groupName ? `group: ${metaInfo ? `Group.${formatGroupNameEnumKey(groupName, utils)}` : `"${groupName}"`},` : ''}
        ${metaInfo?.namespace ? `namespace,` : ''}
        meta: ${tmplDataToSourceExpr(requestInfoMeta?.tmplData)},
        ${contractLine}
        ${validateContractLine}
        ${throwContractsLine}
    },
    ${importFileParams.queryClient.exportName},
    ${importFileParams.httpClient.exportName},
)  
`
      .split('\n')
      .map((it) => it.trim())
      .filter(Boolean)
      .join('\n'),
  };
};
