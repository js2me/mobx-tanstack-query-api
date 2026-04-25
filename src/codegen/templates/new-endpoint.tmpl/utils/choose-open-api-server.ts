import { last } from 'es-toolkit';
import type { ParsedRoute } from 'swagger-typescript-api';
import type { AnyObject, Maybe } from 'yummies/types';

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

export interface CollectedOpenApiServers {
  root: OpenApiServer[];
  path: OpenApiServer[];
  route: OpenApiServer[];
}

export type ChooseOpenApiServerFn = (
  route: ParsedRoute,
  servers: CollectedOpenApiServers,
  swaggerSchema: AnyObject,
) => Maybe<OpenApiServer> | false;

export function chooseOpenApiServer(params: {
  swaggerSchema: AnyObject | null | undefined;
  route: ParsedRoute;
  chooseServer?: ChooseOpenApiServerFn;
}): OpenApiServer | undefined {
  const { swaggerSchema, route, chooseServer } = params;

  const pathItem =
    route.raw.route && swaggerSchema?.paths
      ? (swaggerSchema.paths as AnyObject)[route.raw.route]
      : undefined;

  const collectedServers = collectOpenApiServers(
    swaggerSchema,
    pathItem,
    route,
  );

  if (chooseServer != null) {
    const chosen = chooseServer(
      route,
      collectedServers,
      swaggerSchema as AnyObject,
    );
    if (chosen === false) {
      return undefined;
    }
    if (chosen != null) {
      return chosen;
    }
  }

  if (collectedServers.route.length > 0) {
    return last(collectedServers.route);
  }
  if (collectedServers.path.length > 0) {
    return last(collectedServers.path);
  }

  return last(collectedServers.root);
}

function collectOpenApiServers(
  schema: AnyObject | null | undefined,
  pathItem: AnyObject | undefined,
  parsedRoute: ParsedRoute,
): CollectedOpenApiServers {
  const root: OpenApiServer[] = Array.isArray(schema?.servers)
    ? (schema.servers as OpenApiServer[])
    : [];
  const path: OpenApiServer[] =
    Array.isArray(pathItem?.servers) && pathItem.servers.length > 0
      ? (pathItem.servers as OpenApiServer[])
      : [];
  const routeLevel: OpenApiServer[] =
    // @ts-expect-error operation-level servers
    Array.isArray(parsedRoute.raw?.servers) &&
    // @ts-expect-error operation-level servers
    parsedRoute.raw.servers.length > 0
      ? // @ts-expect-error
        (parsedRoute.raw.servers as OpenApiServer[])
      : [];

  return { root, path, route: routeLevel };
}
