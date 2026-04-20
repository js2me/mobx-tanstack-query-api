import type { ParsedRoute } from 'swagger-typescript-api';
import type { AnyObject } from 'yummies/types';
import type { CodegenDataUtils } from '../types/codegen-data-utils.js';
import type {
  EndpointMetaOption,
  GenerateQueryApiParams,
  RequestMetaOption,
} from '../types/generate-query-api-params.js';

const warnedDeprecatedGetEndpointMeta = new WeakMap<object, true>();
const warnedDeprecatedGetRequestMeta = new WeakMap<object, true>();

const DEPRECATED_GET_ENDPOINT_META =
  '[mobx-tanstack-query-api/codegen] `getEndpointMeta` is deprecated and will be removed in a future release. Use `endpointMeta` instead.';

const DEPRECATED_GET_REQUEST_META =
  '[mobx-tanstack-query-api/codegen] `getRequestMeta` is deprecated and will be removed in a future release. Use `requestMeta` instead.';

function resolveEndpointMetaOption(
  option: EndpointMetaOption,
  route: ParsedRoute,
  utils: CodegenDataUtils,
  swaggerSchema: AnyObject,
) {
  return typeof option === 'function'
    ? option(route, utils, swaggerSchema)
    : option;
}

function resolveRequestMetaOption(
  option: RequestMetaOption,
  route: ParsedRoute,
  utils: CodegenDataUtils,
  swaggerSchema: AnyObject,
) {
  return typeof option === 'function'
    ? option(route, utils, swaggerSchema)
    : option;
}

export function callEndpointMeta(
  params: GenerateQueryApiParams,
  route: ParsedRoute,
  utils: CodegenDataUtils,
  swaggerSchema: AnyObject,
) {
  if (params.endpointMeta) {
    return resolveEndpointMetaOption(
      params.endpointMeta,
      route,
      utils,
      swaggerSchema,
    );
  }
  if (params.getEndpointMeta) {
    if (!warnedDeprecatedGetEndpointMeta.has(params)) {
      console.warn(DEPRECATED_GET_ENDPOINT_META);
      warnedDeprecatedGetEndpointMeta.set(params, true);
    }
    return resolveEndpointMetaOption(
      params.getEndpointMeta,
      route,
      utils,
      swaggerSchema,
    );
  }
}

export function callRequestMeta(
  params: GenerateQueryApiParams,
  route: ParsedRoute,
  utils: CodegenDataUtils,
  swaggerSchema: AnyObject,
) {
  if (params.requestMeta) {
    return resolveRequestMetaOption(
      params.requestMeta,
      route,
      utils,
      swaggerSchema,
    );
  }
  if (params.getRequestMeta) {
    if (!warnedDeprecatedGetRequestMeta.has(params)) {
      console.warn(DEPRECATED_GET_REQUEST_META);
      warnedDeprecatedGetRequestMeta.set(params, true);
    }
    return resolveRequestMetaOption(
      params.getRequestMeta,
      route,
      utils,
      swaggerSchema,
    );
  }
}
