import type { ParsedRoute } from 'swagger-typescript-api';
import type { AnyObject, Maybe } from 'yummies/types';
import type { BaseTmplParams } from '../types/base-tmpl-params.js';
import type { MetaInfo } from '../types/index.js';
import { createShortModelType } from '../utils/create-short-model-type.js';
import {
  formatGroupNameEnumKey,
  formatTagNameEnumKey,
} from './meta-info.tmpl.js';

export interface NewEndpointTmplParams extends BaseTmplParams {
  route: ParsedRoute;
  groupName: Maybe<string>;
  metaInfo: Maybe<MetaInfo>;
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

export const newEndpointTmpl = ({
  route,
  codegenParams,
  importFileParams,
  utils,
  groupName,
  metaInfo,
  filterTypes,
  configuration,
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
    requestContentKind[requestBodyInfo.contentKind] || null;
  const responseFormat =
    responseContentKind[responseBodyInfo.success?.schema?.contentKind] || null;

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

  return {
    reservedDataContractNames,
    localModelTypes: isAllowedInputType ? [requestInputTypeDc] : [],
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
