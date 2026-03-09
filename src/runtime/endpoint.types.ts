import type { AnyObject } from 'yummies/types';
import type { Endpoint } from './endpoint.js';
import type { InvalidateEndpointsFilters } from './endpoint-query-client.types.js';
import type { FullRequestParams } from './http-client.js';

/**
 * Optional Zod (or compatible) contracts for params and response data validation.
 * When using zod, pass { params: zSchemaForParams, data: zSchemaForResponseData }.
 */
export interface EndpointContracts {
  params?: unknown;
  data?: unknown;
}

export interface EndpointConfiguration<
  TInput extends AnyObject,
  TMetaData extends AnyObject = AnyObject,
> {
  group?: string;
  namespace?: string;
  operationId: string;
  path: string[];
  meta?: TMetaData;
  requiredParams: string[];
  params: (input: Partial<TInput>) => FullRequestParams;
  tags: string[];
  /** Optional validation contracts (e.g. zod schemas) for params and data */
  contracts?: EndpointContracts;
}

export type AnyEndpoint = Endpoint<any, any, any>;

export type InferEndpointData<TEndpoint extends AnyEndpoint> =
  TEndpoint extends Endpoint<infer T, any, any> ? T : never;

export type InferEndpointResponse<TEndpoint extends AnyEndpoint> =
  TEndpoint extends Endpoint<infer T, any, any> ? T : never;

export type InferEndpointInput<TEndpoint extends AnyEndpoint> =
  TEndpoint extends Endpoint<any, infer T, any> ? T : never;

export type InferEndpointMetaData<TEndpoint extends AnyEndpoint> =
  TEndpoint extends Endpoint<any, any, infer T> ? T : never;

export interface EndpointMutationPresets {
  invalidateQueries?: InvalidateEndpointsFilters;
}

export type ToEndpoint<T> = T extends AnyEndpoint ? T : AnyEndpoint;
