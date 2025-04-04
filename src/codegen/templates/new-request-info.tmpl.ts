import { GenerateApiConfiguration, ParsedRoute } from 'swagger-typescript-api';
import { AnyObject } from 'yummies/utils/types';

import type {
  AllImportFileParams,
  CodegenDataUtils,
  GenerateQueryApiParams,
} from '../index.js';

export interface NewRequestInfoTmplParams {
  route: ParsedRoute;
  configuration: GenerateApiConfiguration;
  apiParams: GenerateQueryApiParams;
  importFileParams: AllImportFileParams;
  utils: CodegenDataUtils;
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

export const newRequestInfoTmpl = ({
  route,
  apiParams,
  importFileParams,
  utils,
}: NewRequestInfoTmplParams) => {
  const { _ } = utils;
  const positiveResponseTypes = route.raw.responsesTypes?.filter(
    (it) => +it.status >= 200 && +it.status < 300,
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
    name: 'request',
    optional: true,
    type: 'RequestParams',
    defaultValue: '{}',
  };

  const getArgs = ({
    withPayload,
    withRequestConfigParam,
    withRequestParams,
  }: {
    withPayload?: boolean;
    withRequestConfigParam?: boolean;
    withRequestParams?: boolean;
  }): RequestParam[] => {
    return _.sortBy(
      _.compact([
        ...(withRequestParams && requestParams
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
      [(o) => o.optional],
    );
  };

  const requestOutputDataTypes = positiveResponseTypes.map((it) => it.type);
  const requestOutputErrorType = routeResponse.errorType;

  let requestInputCombinedType: RequestParam | undefined;

  const requestInfoFnArgNames = getArgs({
    withRequestParams: true,
    withRequestConfigParam: true,
    withPayload: true,
  }).map(({ name }) => name);

  const pathParamsToInline = path.split('/').slice(1) as string[];

  let lastDynamicStructPos = 0;

  const pathParamsStructs = pathParamsToInline.map((param, i) => {
    if (param.includes('${')) {
      const paramName = param.replace('${', '').replace('}', '');

      return {
        type: 'dynamic',
        key: paramName,
        i,
        param: lastDynamicStructPos++,
      };
    }

    return {
      type: 'static',
      value: param,
    };
  });

  const dataParamStruct =
    payload == null
      ? null
      : {
          type: 'dynamic',
          key: payload.name,
          param: lastDynamicStructPos++,
        };

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

  let requestInputType = `{
  ${getArgs({
    withRequestParams: true,
    withRequestConfigParam: true,
    withPayload: true,
  })
    .map(({ name, optional, type, defaultValue }) => {
      const isCombinedType = name.includes('...') || name === 'query';

      if (isCombinedType) {
        requestInputCombinedType = { name, optional, type, defaultValue };
        return;
      }

      return `${name}${optional ? '?' : ''}:${type}`;
    })
    .filter(Boolean)
    .join(', ')}
}`;

  if (requestInputCombinedType) {
    requestInputType = `${requestInputCombinedType.type} & ${requestInputType}`;
  }

  const requestKeyType = `[
  ${getArgs({
    withRequestParams: true,
    withRequestConfigParam: true,
    withPayload: true,
  })
    .map(({ name, optional, type }) => {
      return `${name.includes('...') || name === 'query' ? 'params' : name}${optional ? '?' : ''}:${type}`;
    })
    .join(', ')}
]`;

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
      withRequestParams: true,
      withPayload: true,
    }).map((it) => it.type),
  ]);

  return {
    reservedDataContractNames,
    content: `
new ${importFileParams.endpoint.exportName}<
  ${requestOutputDataTypes.join('|') || 'any'},
  ${requestOutputErrorType},
  ${requestInputType},
  ${requestKeyType},
  ${requestInfoMeta?.typeName ?? 'any'}
>(
    {
        params: (${requestInfoFnArgNames.join(', ')}) => ({
            path: \`${resultPath}\`,
            method: '${_.upperCase(method)}',
            ${requestMeta?.tmplData ? `meta: ${requestMeta.tmplData},` : ''}
            ${query == null ? '' : `query: ${query.name},`}
            ${payload?.name ? `body: ${payload.name},` : ''}
            ${security ? 'secure: true,' : ''}
            ${bodyContentType ? `contentType: ${bodyContentType},` : ''}
            ${responseFormat ? `format: ${responseFormat},` : ''}
            ...${requestInfoFnArgNames.at(-1)},  
        }),
        operationId: "${raw.operationId}",
        tags: [
          ${raw.tags?.map((tag) => `"${tag}"`).join(',')}
        ],
        meta: ${requestInfoMeta?.tmplData ?? '{} as any'},
        keys: [
            ${_.compact([
              ...pathParamsStructs.map((struct) => {
                if (struct.type === 'dynamic') {
                  return `{ name: '${struct.key}', param: ${struct.param} }`;
                }
                return `"${struct.value}"`;
              }),
              dataParamStruct &&
                `
                { name: "${dataParamStruct.key}", param: ${dataParamStruct.param} }
              `,
              queryParamStruct &&
                `{ name: "${queryParamStruct.key}", rest: true }`,
              requestConfigParam &&
                `{ name: "${requestConfigParam.name}", param: ${lastDynamicStructPos} }`,
            ]).join(',')}
        ],
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
