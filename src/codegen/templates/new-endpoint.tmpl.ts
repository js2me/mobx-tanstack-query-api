import { AnyObject, Maybe } from 'yummies/utils/types';

import type {
  AllImportFileParams,
  CodegenDataUtils,
  GenerateQueryApiParams,
} from '../index.js';

export interface NewEndpointTmplParams {
  route: AnyObject;
  configuration: AnyObject;
  apiParams: GenerateQueryApiParams;
  importFileParams: AllImportFileParams;
  utils: CodegenDataUtils;
  groupName: Maybe<string>;
  namespace?: Maybe<string>;
}

// RequestParams["type"]
const requestContentKind: AnyObject = {
  URL_ENCODED: '"application/x-www-form-urlencoded"',
  FORM_DATA: '"multipart/form-data"',
  TEXT: '"text/plain"',
  BINARY: '"application/octet-stream"',
};
// RequestParams["format"]
const responseContentKind: AnyObject = {
  TEXT: '"text"',
  IMAGE: '"blob"',
  FORM_DATA: '"formData"',
  BYTES: '"bytes"',
};

export const newEndpointTmpl = ({
  route,
  apiParams,
  importFileParams,
  utils,
  groupName,
  namespace,
}: NewEndpointTmplParams) => {
  const { _ } = utils;
  const positiveResponseTypes = route.raw.responsesTypes?.filter(
    (it: AnyObject) => +it.status >= 200 && +it.status < 300,
  );

  const { requestBodyInfo, responseBodyInfo } = route as AnyObject;
  const routeRequest = route.request as AnyObject;
  const routeResponse = route.response as AnyObject;

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
  const requestOutputDataTypes = positiveResponseTypes.map(
    (it: AnyObject) => it.type,
  );
  const requestOutputErrorType = routeResponse.errorType;

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

  const requestInfoMeta = apiParams.getEndpointMeta?.(route, utils);
  const requestMeta = apiParams.getRequestMeta?.(route, utils);
  const resultPath =
    (apiParams.requestPathPrefix ?? '') +
    path +
    (apiParams.requestPathSuffix ?? '');

  const bodyContentType =
    requestContentKind[requestBodyInfo.contentKind] || null;
  const responseFormat =
    responseContentKind[responseBodyInfo.success?.schema?.contentKind] || null;

  const reservedDataContractNames: string[] = _.uniq([
    ...requestOutputDataTypes,
    requestOutputErrorType,
    ...getArgs({
      withPayload: true,
    }).map((it) => it.type),
  ]);

  const pathDeclaration = resultPath.replaceAll('$', '');

  const getHttpRequestGenerics = () => {
    const defaultOkResponse = positiveResponseTypes?.[0]?.type || 'unknown';
    const defaultBadResponse = routeResponse.errorType;
    const responses =
      raw.responsesTypes?.filter((it: AnyObject) => it.status !== 'default') ||
      [];

    if (!responses?.length) {
      return `HttpResponse<unknown, ${routeResponse.errorType}>`;
    }

    if (responses.length === 1 && responses[0].isSuccess) {
      return `HttpResponse<${responses[0].type}, ${routeResponse.errorType}>`;
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

  const requestInputTypeDc = {
    typeIdentifier: 'type',
    name: _.upperFirst(_.camelCase(`${route.routeName.usage}Input`)),
    content: `{
    ${inputParams
      .map(({ name, optional, type }) => {
        return `${name}${optional ? '?' : ''}:${type}`;
      })
      .filter(Boolean)
      .join(', ')}
  }`,
  };

  return {
    reservedDataContractNames,
    localModelTypes: [requestInputTypeDc],
    content: `
new ${importFileParams.endpoint.exportName}<
  ${getHttpRequestGenerics()},
  ${requestInputTypeDc.name},
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
        operationId: "${raw.operationId}",
        path: [${pathDeclaration
          .split('/')
          .filter(Boolean)
          .map((it) => `"${it}"`)}],
        tags: [${tags.map((tag: string) => `"${tag}"`)}],
        ${groupName ? `group: "${groupName}",` : ''}
        ${namespace ? `namespace: "${namespace}",` : ''}
        meta: ${requestInfoMeta?.tmplData ?? '{} as any'},
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
