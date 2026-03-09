import type { ParsedRoute } from 'swagger-typescript-api';
import type { AnyObject, Maybe } from 'yummies/types';
import type { BaseTmplParams } from '../types/base-tmpl-params.js';
import type { MetaInfo } from '../types/index.js';
import { createShortModelType } from '../utils/create-short-model-type.js';
import {
  buildEndpointZodContractsCode,
  getResponseSchemaKeyFromOperation,
  typeNameToSchemaKey,
} from '../utils/zod/build-endpoint-zod-contracts-code.js';
import {
  formatGroupNameEnumKey,
  formatTagNameEnumKey,
} from './meta-info.tmpl.js';

export interface NewEndpointTmplParams extends BaseTmplParams {
  route: ParsedRoute;
  groupName: Maybe<string>;
  metaInfo: Maybe<MetaInfo>;
  /** When true, generates Zod contracts (params + data) and adds contracts to endpoint config */
  generateZodContracts?: boolean;
  /** When set, auxiliary Zod schemas are not inlined; endpoint imports them from this path (e.g. '../schemas') */
  relativePathZodSchemas?: string | null;
}

// RequestParams["type"]
const requestContentKind: AnyObject = {
  URL_ENCODED: '"application/x-www-form-urlencoded"',
  FORM_DATA: '"multipart/form-data"',
  TEXT: '"text/plain"',
  JSON: '"application/json"',
  BINARY: '"application/octet-stream"',
};
// RequestParams["format"]
const responseContentKind: AnyObject = {
  TEXT: '"text"',
  IMAGE: '"blob"',
  JSON: '"json"',
  FORM_DATA: '"formData"',
  BYTES: '"bytes"',
};

/** Infer response format from raw OpenAPI operation (produces or responses content) when contentKind is not set */
function inferResponseFormatFromRaw(raw: AnyObject): string | null {
  const contentTypes: string[] = [];
  if (Array.isArray(raw.produces)) {
    contentTypes.push(...raw.produces);
  }
  const successStatus =
    raw.responses &&
    Object.keys(raw.responses).find((s) => {
      const code = Number.parseInt(s, 10);
      return code >= 200 && code < 300;
    });
  const content = successStatus && raw.responses[successStatus]?.content;
  if (content && typeof content === 'object') {
    contentTypes.push(...Object.keys(content));
  }
  if (contentTypes.length === 0) return null;

  const mimeToFormat = (mime: string): string | null => {
    if (mime.includes('application/json') || mime.includes('+json'))
      return '"json"';
    if (mime.startsWith('text/')) return '"text"';
    if (mime.includes('form-data') || mime.includes('multipart'))
      return '"formData"';
    // binary: blob() in Fetch API — IANA binary types: application/*, image/*, audio/*, video/*, font/*, model/*, message/*, haptics/*
    if (
      mime.includes('octet-stream') ||
      mime.includes('spreadsheet') ||
      mime.includes('vnd.') ||
      mime.startsWith('application/') ||
      mime.startsWith('image/') ||
      mime.startsWith('audio/') ||
      mime.startsWith('video/') ||
      mime.startsWith('font/') ||
      mime.startsWith('model/') ||
      mime.startsWith('message/') ||
      mime.startsWith('haptics/')
    )
      return '"blob"';
    return null;
  };

  // Prefer json for typed responses, then first recognized format
  const preferredOrder = ['"json"', '"text"', '"formData"', '"blob"'] as const;
  for (const fmt of preferredOrder) {
    const found = contentTypes.map(mimeToFormat).find((f) => f === fmt);
    if (found) return found;
  }
  return null;
}

/** Resolve response format from contentKind, then from raw operation (produces / responses content) */
function getResponseFormat(
  responseBodyInfo: AnyObject,
  raw: AnyObject,
  configuration: AnyObject,
  path: string,
  method: string,
): string | null {
  const fromContentKind =
    responseContentKind[responseBodyInfo.success?.schema?.contentKind];
  if (fromContentKind) return fromContentKind;
  const swaggerSchema =
    configuration.config?.swaggerSchema ?? configuration.swaggerSchema;
  const schemaPaths = swaggerSchema?.paths;
  const pathKey = path?.startsWith('/') ? path : `/${path || ''}`;
  const methodKey = method?.toLowerCase?.() ?? method;
  const schemaOperation =
    pathKey && methodKey ? schemaPaths?.[pathKey]?.[methodKey] : null;
  const rawWithProduces =
    schemaOperation && typeof schemaOperation === 'object'
      ? { ...schemaOperation, ...raw }
      : raw;
  return inferResponseFormatFromRaw(rawWithProduces);
}

/** Infer request body contentType from raw OpenAPI operation (consumes or requestBody.content) */
function inferRequestBodyContentTypeFromRaw(raw: AnyObject): string | null {
  const contentTypes: string[] = [];
  if (Array.isArray(raw.consumes)) {
    contentTypes.push(...raw.consumes);
  }
  const requestBody = raw.requestBody;
  if (requestBody?.content && typeof requestBody.content === 'object') {
    contentTypes.push(...Object.keys(requestBody.content));
  }
  if (contentTypes.length === 0) return null;

  const mimeToContentType = (mime: string): string | null => {
    if (mime.includes('application/json') || mime.includes('+json'))
      return '"application/json"';
    if (mime.includes('application/x-www-form-urlencoded'))
      return '"application/x-www-form-urlencoded"';
    if (mime.includes('multipart/form-data') || mime.includes('multipart/'))
      return '"multipart/form-data"';
    if (mime.startsWith('text/')) return '"text/plain"';
    if (
      mime.includes('octet-stream') ||
      mime.startsWith('application/') ||
      mime.startsWith('image/') ||
      mime.startsWith('audio/') ||
      mime.startsWith('video/') ||
      mime.startsWith('font/') ||
      mime.startsWith('model/') ||
      mime.includes('vnd.')
    )
      return '"application/octet-stream"';
    return null;
  };

  const preferredOrder = [
    '"application/json"',
    '"application/x-www-form-urlencoded"',
    '"multipart/form-data"',
    '"text/plain"',
    '"application/octet-stream"',
  ] as const;
  for (const ct of preferredOrder) {
    const found = contentTypes.map(mimeToContentType).find((c) => c === ct);
    if (found) return found;
  }
  return null;
}

/** Resolve request body contentType from contentKind, then from raw (consumes / requestBody.content) */
function getRequestBodyContentType(
  requestBodyInfo: AnyObject,
  raw: AnyObject,
  configuration: AnyObject,
  path: string,
  method: string,
): string | null {
  const fromContentKind = requestContentKind[requestBodyInfo?.contentKind];
  if (fromContentKind) return fromContentKind;
  const swaggerSchema =
    configuration.config?.swaggerSchema ?? configuration.swaggerSchema;
  const schemaPaths = swaggerSchema?.paths;
  const pathKey = path?.startsWith('/') ? path : `/${path || ''}`;
  const methodKey = method?.toLowerCase?.() ?? method;
  const schemaOperation =
    pathKey && methodKey ? schemaPaths?.[pathKey]?.[methodKey] : null;
  const rawWithConsumes =
    schemaOperation && typeof schemaOperation === 'object'
      ? { ...schemaOperation, ...raw }
      : raw;
  return inferRequestBodyContentTypeFromRaw(rawWithConsumes);
}

export const newEndpointTmpl = ({
  route,
  codegenParams,
  importFileParams,
  utils,
  groupName,
  metaInfo,
  filterTypes,
  configuration,
  generateZodContracts,
  relativePathZodSchemas,
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: codegen template, many branches by design
}: NewEndpointTmplParams) => {
  const { _ } = utils;
  const positiveResponseTypes = route.raw.responsesTypes?.filter(
    (it) =>
      +it.status >= 200 &&
      +it.status < 300 &&
      (!(it as AnyObject).typeData || filterTypes((it as AnyObject).typeData)),
  );

  const { requestBodyInfo, responseBodyInfo } = route as AnyObject;
  const routeRequest = route.request as AnyObject;
  const routeResponse = route.response;

  const { parameters, path, method, payload, query, requestParams, security } =
    routeRequest;
  const { raw } = route;
  const queryName = query?.name || 'query';
  const pathParams = _.values(parameters);
  const pathParamsNames = _.map(pathParams, 'name');

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

  const getArgs = ({
    withPayload,
    withRequestConfigParam,
  }: {
    withPayload?: boolean;
    withRequestConfigParam?: boolean;
  }): RequestParam[] => {
    return _.sortBy(
      _.compact([
        ...(requestParams
          ? [
              {
                name:
                  pathParams.length > 0
                    ? `{ ${_.join(pathParamsNames, ', ')}, ...${queryName} }`
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
  const requestOutputDataTypes = positiveResponseTypes.map((it) => it.type);

  const foundErrorModelType =
    (routeResponse.errorType &&
      configuration.modelTypes.find(
        (it) => it.name === routeResponse.errorType,
      )) ||
    null;

  const requestOutputErrorType = foundErrorModelType
    ? routeResponse.errorType
    : 'any';

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

  const requestInfoMeta = codegenParams.getEndpointMeta?.(route, utils);
  const requestMeta = codegenParams.getRequestMeta?.(route, utils);
  const resultPath =
    (codegenParams.requestPathPrefix ?? '') +
    path +
    (codegenParams.requestPathSuffix ?? '');

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

  const reservedDataContractNames: string[] = _.uniq([
    ...requestOutputDataTypes,
    requestOutputErrorType || 'any',
    ...getArgs({
      withPayload: true,
    }).map((it) => it.type),
  ]);

  const pathDeclaration = resultPath.replaceAll('$', '');

  const getHttpRequestGenerics = () => {
    const defaultOkResponse = positiveResponseTypes?.[0]?.type || 'unknown';
    const defaultBadResponse = requestOutputErrorType;
    const responses =
      raw.responsesTypes?.filter(
        (it) =>
          it.status !== 'default' &&
          (!(it as AnyObject).typeData ||
            filterTypes((it as AnyObject).typeData)),
      ) || [];

    if (!responses?.length) {
      return `HttpResponse<unknown, ${requestOutputErrorType}>`;
    }

    if (responses.length === 1 && responses[0].isSuccess) {
      return `HttpResponse<${responses[0].type}, ${requestOutputErrorType}>`;
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
    name: _.upperFirst(_.camelCase(`${route.routeName.usage}Params`)),
    content: `{
    ${inputParams
      .map(({ name, optional, type }) => {
        return `${name}${optional ? '?' : ''}:${type}`;
      })
      .filter(Boolean)
      .join(', ')}
  }`,
  });

  const isAllowedInputType = filterTypes(requestInputTypeDc);

  const defaultOkResponseType = positiveResponseTypes?.[0]?.type ?? 'unknown';
  const contractsVarName = generateZodContracts
    ? `${_.camelCase(route.routeName.usage)}Contracts`
    : null;
  const swaggerSchema =
    (configuration.config as AnyObject)?.swaggerSchema ??
    (configuration as AnyObject)?.swaggerSchema;
  const componentsSchemas = swaggerSchema?.components?.schemas as Record<
    string,
    AnyObject
  > | null;
  let operationFromSpec: AnyObject | null = null;
  const pathKeyForSpec = path?.startsWith('/') ? path : `/${path || ''}`;
  const methodKey = method?.toLowerCase?.() ?? method;
  if (pathKeyForSpec && methodKey && swaggerSchema?.paths?.[pathKeyForSpec]) {
    operationFromSpec = swaggerSchema.paths[pathKeyForSpec][methodKey] ?? null;
  }
  if (!operationFromSpec && swaggerSchema?.paths && raw?.operationId) {
    for (const pathItem of Object.values(swaggerSchema.paths) as AnyObject[]) {
      const op = pathItem?.[methodKey];
      if (op?.operationId === raw.operationId) {
        operationFromSpec = op;
        break;
      }
    }
  }
  let responseSchemaKey = getResponseSchemaKeyFromOperation(
    operationFromSpec ?? raw,
  );
  if (!responseSchemaKey && componentsSchemas && configuration.modelTypes) {
    const aliasType = configuration.modelTypes.find(
      (m: AnyObject) => m.name === defaultOkResponseType,
    );
    if (
      aliasType?.typeIdentifier === 'type' &&
      typeof aliasType.content === 'string' &&
      /^[A-Za-z0-9_]+$/.test(aliasType.content.trim())
    ) {
      const resolved = typeNameToSchemaKey(aliasType.content.trim(), 'DC');
      if (resolved in componentsSchemas) responseSchemaKey = resolved;
    }
  }
  if (!responseSchemaKey && componentsSchemas) {
    const match = defaultOkResponseType.match(/^Get(.+)DataDC$/);
    if (match) {
      const candidate = match[1];
      if (candidate in componentsSchemas) responseSchemaKey = candidate;
    }
  }
  const contractsCode =
    generateZodContracts && contractsVarName
      ? buildEndpointZodContractsCode({
          routeNameUsage: route.routeName.usage,
          inputParams,
          responseDataTypeName: defaultOkResponseType,
          contractsVarName,
          utils,
          componentsSchemas: componentsSchemas ?? undefined,
          typeSuffix: 'DC',
          responseSchemaKey: responseSchemaKey ?? undefined,
          useExternalZodSchemas: Boolean(relativePathZodSchemas),
        })
      : null;

  const contractsLine =
    contractsVarName != null ? `contracts: ${contractsVarName},` : '';

  return {
    reservedDataContractNames,
    localModelTypes: isAllowedInputType ? [requestInputTypeDc] : [],
    contractsCode: contractsCode ?? undefined,
    contractsVarName: contractsVarName ?? undefined,
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
            path: \`${resultPath}\`,
            method: '${_.upperCase(method)}',
            ${requestMeta?.tmplData ? `meta: ${requestMeta.tmplData},` : ''}
            ${query == null ? '' : `query: ${query.name},`}
            ${payload?.name ? `body: ${payload.name},` : ''}
            ${security ? 'secure: true,' : ''}
            ${bodyContentType ? `contentType: ${bodyContentType},` : ''}
            ${responseFormat ? `format: ${responseFormat},` : ''}
            ...${requestConfigParam.name},
        }),
        requiredParams: [${inputParams.filter((it) => !it.optional).map((it) => `"${it.name}"`)}],
        operationId: "${raw.operationId || _.camelCase(route.routeName.usage)}",
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
        meta: ${requestInfoMeta?.tmplData ?? '{} as any'},
        ${contractsLine}
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
