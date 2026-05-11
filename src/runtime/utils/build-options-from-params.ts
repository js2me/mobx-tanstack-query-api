import type { AnyObject, Maybe, MaybeFalsy } from 'yummies/types';
import type { AnyEndpoint } from '../endpoint.types.js';
import type { EndpointQueryUniqKey } from '../endpoint-query.types.js';

export const buildOptionsFromParams = (
  endpoint: AnyEndpoint,
  params: MaybeFalsy<AnyObject>,
  uniqKey: Maybe<EndpointQueryUniqKey>,
  isInfinite?: boolean,
): { enabled: boolean; queryKey: any[] } => {
  const { requiredParams } = endpoint.configuration;
  let hasRequiredParams = false;

  if (requiredParams.length > 0) {
    hasRequiredParams =
      !!params && requiredParams.every((param) => param in params);
  } else {
    hasRequiredParams = !!params;
  }

  return {
    enabled: hasRequiredParams,
    queryKey: isInfinite
      ? endpoint.toInfiniteQueryKey(params || {}, uniqKey)
      : endpoint.toQueryKey(params || {}, uniqKey),
  };
};
