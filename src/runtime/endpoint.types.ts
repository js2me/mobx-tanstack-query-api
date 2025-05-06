import { AllPropertiesOptional, AnyObject } from 'yummies/utils/types';

import type { Endpoint } from './endpoint.js';
import { FullRequestParams } from './http-client.js';

export interface EndpointConfiguration<
  TInput extends AnyObject,
  TMetaData extends AnyObject = AnyObject,
> {
  operationId: string;
  pathDeclaration: string;
  meta?: TMetaData;
  requiredParams: string[];
  params: (
    ...args: AllPropertiesOptional<TInput> extends true
      ? [input: Partial<TInput>]
      : [input: TInput]
  ) => FullRequestParams;
  tags: string[];
}

export type EndpointMutationInput<
  TBaseInput extends AnyObject,
  TMutationMeta extends AnyObject | void = void,
> = TBaseInput &
  (TMutationMeta extends void
    ? // eslint-disable-next-line @typescript-eslint/ban-types
      {}
    : AllPropertiesOptional<TMutationMeta> extends true
      ? { meta?: TMutationMeta }
      : { meta: TMutationMeta });

export type AnyEndpoint = Endpoint<any, any, any, any>;

export type InferEndpointData<TEndpoint extends AnyEndpoint> =
  TEndpoint extends Endpoint<infer T, any, any, any> ? T : never;

export type InferEndpointResponse<TEndpoint extends AnyEndpoint> = ReturnType<
  TEndpoint['request']
>;

export type InferEndpointError<TEndpoint extends AnyEndpoint> =
  TEndpoint extends Endpoint<any, infer T, any, any> ? T : never;

export type InferEndpointInput<TEndpoint extends AnyEndpoint> =
  TEndpoint extends Endpoint<any, any, infer T, any> ? T : never;

export type InferEndpointMetaData<TEndpoint extends AnyEndpoint> =
  TEndpoint extends Endpoint<any, any, any, infer T> ? T : never;
