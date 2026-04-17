import { last } from 'lodash-es';
import type { ParsedRoute } from 'swagger-typescript-api';
import type { AnyObject } from 'yummies/types';

export interface OpenApiServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

export interface OpenApiServer {
  /**
   * OpenAPI Server Object field.
   * URL is required by spec but may still be absent in malformed schemas.
   */
  url?: string;
  description?: string;
  variables?: Record<string, OpenApiServerVariable>;
}

export function chooseOpenApiServer(params: {
  swaggerSchema: AnyObject | null | undefined;
  route: ParsedRoute;
}): OpenApiServer | undefined {
  const { swaggerSchema, route } = params;

  const pathItem =
    route.raw.route && swaggerSchema?.paths
      ? (swaggerSchema.paths as AnyObject)[route.raw.route]
      : undefined;

  if (
    // @ts-expect-error
    Array.isArray(route.raw?.servers) &&
    // @ts-expect-error
    route.raw.servers.length > 0
  ) {
    // @ts-expect-error
    return last<AnyObject>(route.raw.servers);
  }
  if (Array.isArray(pathItem?.servers) && pathItem.servers.length > 0) {
    return last<AnyObject>(pathItem.servers);
  }

  return last<AnyObject>(swaggerSchema?.servers);
}
