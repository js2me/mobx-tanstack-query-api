/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  DefaultError,
  InvalidateOptions,
  InvalidateQueryFilters,
} from '@tanstack/query-core';
import { callFunction } from 'yummies/common';
import { AllPropertiesOptional, AnyObject } from 'yummies/utils/types';

import { EndpointMutation } from './endpoint-mutation.js';
import { EndpointMutationOptions } from './endpoint-mutation.types.js';
import { EndpointQueryClient } from './endpoint-query-client.js';
import { EndpointQuery } from './endpoint-query.js';
import {
  EndpointQueryFlattenOptions,
  EndpointQueryMeta,
  EndpointQueryOptions,
  EndpointQueryUniqKey,
} from './endpoint-query.types.js';
import {
  EndpointConfiguration,
  EndpointMutationPresets,
} from './endpoint.types.js';
import type { HttpClient, HttpResponse } from './http-client.js';

export interface Endpoint<
  TResponse extends HttpResponse<any, any>,
  TParams extends AnyObject,
  TMetaData extends AnyObject = AnyObject,
> {
  (
    ...args: AllPropertiesOptional<TParams> extends true
      ? [params?: TParams]
      : [params: TParams]
  ): ReturnType<Endpoint<TResponse, TParams, TMetaData>['request']>;
}

export class Endpoint<
  TResponse extends HttpResponse<any, any>,
  TParams extends AnyObject,
  TMetaData extends AnyObject = AnyObject,
> {
  endpointId: string;

  presets: {
    mutations: EndpointMutationPresets;
  } = {
    mutations: {},
  };

  __params!: TParams;
  __response!: TResponse;

  meta!: TMetaData;

  constructor(
    public configuration: EndpointConfiguration<NoInfer<TParams>, TMetaData>,
    protected queryClient: EndpointQueryClient,
    protected http: HttpClient,
  ) {
    this.endpointId = globalThis.crypto.randomUUID();
    this.meta = configuration.meta ?? ({} as TMetaData);
    // Сохраняем оригинальный инстанс
    const instance = this;

    // Создаем функцию-обертку
    const callable = function (
      this: any,
      ...args: AllPropertiesOptional<TParams> extends true
        ? [input?: TParams]
        : [input: TParams]
    ) {
      return instance.request.apply(instance, args);
    } as unknown as Endpoint<TResponse, TParams, TMetaData>;

    // Копируем прототип
    Object.setPrototypeOf(callable, new.target.prototype);

    // Копируем методы из оригинального инстанса
    Object.getOwnPropertyNames(instance)
      .concat(Object.getOwnPropertyNames(new.target.prototype))
      .forEach((key) => {
        if (key === 'constructor') return;
        const desc =
          Object.getOwnPropertyDescriptor(instance, key) ||
          Object.getOwnPropertyDescriptor(new.target.prototype, key);
        if (desc) Object.defineProperty(callable, key, desc);
      });

    return callable;
  }

  getFullUrl(
    ...args: AllPropertiesOptional<TParams> extends true
      ? [input?: TParams]
      : [input: TParams]
  ): string {
    const params = this.configuration.params(args[0] ?? ({} as TParams));
    return this.http.buildUrl(params);
  }

  getPath(
    ...args: AllPropertiesOptional<TParams> extends true
      ? [input?: TParams]
      : [input: TParams]
  ): string {
    const params = this.configuration.params(args[0] ?? ({} as TParams));
    return params.path;
  }

  get tags() {
    return this.configuration.tags;
  }

  get path() {
    return this.configuration.path;
  }

  get operationId() {
    return this.configuration.operationId;
  }

  get group() {
    return this.configuration.group;
  }

  get namespace() {
    return this.configuration.namespace;
  }

  request(
    ...args: AllPropertiesOptional<TParams> extends true
      ? [input?: TParams]
      : [input: TParams]
  ) {
    return this.http.request<TResponse>(
      this.configuration.params(args[0] ?? ({} as TParams)),
    );
  }

  toQueryMeta = (meta?: AnyObject) =>
    ({
      ...meta,
      tags: this.tags,
      operationId: this.operationId,
      path: this.path,
      pathDeclaration: this.path.join('/'),
      endpointId: this.endpointId,
      endpointQuery: true,
    }) satisfies EndpointQueryMeta;

  toQueryKey(
    ...args: AllPropertiesOptional<TParams> extends true
      ? [input?: TParams, uniqKey?: EndpointQueryUniqKey]
      : [input: TParams, uniqKey?: EndpointQueryUniqKey]
  ): any {
    const params = args[0] ?? ({} as TParams);

    return [
      ...this.configuration.path,
      this.configuration.operationId,
      params,
      callFunction(args[1]),
    ];
  }

  invalidateQuery(
    ...args: AllPropertiesOptional<TParams> extends true
      ? [
          input?: TParams,
          filters?: InvalidateQueryFilters & { uniqKey?: EndpointQueryUniqKey },
          options?: InvalidateOptions,
        ]
      : [
          input: TParams,
          filters?: InvalidateQueryFilters & { uniqKey?: EndpointQueryUniqKey },
          options?: InvalidateOptions,
        ]
  ) {
    this.queryClient.invalidateQueries(
      {
        // @ts-ignore
        queryKey: this.toQueryKey(args[0], args[1]?.uniqKey),
        exact: true,
        ...(args[1] as any),
      },
      args[2],
    );
  }

  toMutation<
    TData = TResponse['data'],
    TMutationMeta extends AnyObject | void = void,
    TContext = unknown,
  >(
    options: EndpointMutationOptions<
      this,
      TData,
      TParams,
      TMutationMeta,
      TContext
    >,
  ) {
    return new EndpointMutation<this, TData, TParams, TMutationMeta, TContext>(
      this,
      this.queryClient,
      {
        ...options,
        invalidateEndpoints:
          options.invalidateEndpoints ??
          this.presets.mutations?.invalidateQueries,
      },
    );
  }

  toQuery<
    TQueryFnData = TResponse['data'],
    TError = DefaultError,
    TData = TQueryFnData,
    TQueryData = TQueryFnData,
  >(
    options:
      | EndpointQueryOptions<this, TQueryFnData, TError, TData, TQueryData>
      | (() => EndpointQueryFlattenOptions<
          this,
          TQueryFnData,
          TError,
          TData,
          TQueryData
        >),
  ) {
    return new EndpointQuery<this, TQueryFnData, TError, TData, TQueryData>(
      this,
      this.queryClient,
      options,
    );
  }
}
