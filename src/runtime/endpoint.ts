/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  DefaultError,
  InvalidateOptions,
  InvalidateQueryFilters,
} from '@tanstack/query-core';
import { resolveFnValue } from 'yummies/common';
import { AllPropertiesOptional, AnyObject } from 'yummies/utils/types';

import { EndpointMutation } from './endpoint-mutation.js';
import { EndpointMutationOptions } from './endpoint-mutation.types.js';
import { EndpointQueryClient } from './endpoint-query-client.js';
import { EndpointQuery } from './endpoint-query.js';
import {
  EndpointQueryOptions,
  EndpointQueryUnitKey,
} from './endpoint-query.types.js';
import { EndpointConfiguration } from './endpoint.types.js';
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

  request(
    ...args: AllPropertiesOptional<TParams> extends true
      ? [input?: TParams]
      : [input: TParams]
  ) {
    return this.http.request<TResponse>(
      this.configuration.params(args[0] ?? ({} as TParams)),
    );
  }

  /**
   * segment - last segment number in path which need to crop for invalidate
   * @example
   * // endpoint path ["v1", "api", "kek"]
   * endpoint.invalidateByPath({ segment: 1 }) // "v1/api*"
   */
  invalidateByPath(
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'> & {
      segment?: number;
    },
    options?: InvalidateOptions,
  ) {
    return this.queryClient.invalidateByPath(
      this.configuration.path,
      filters,
      options,
    );
  }

  invalidateByOperationId(
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'>,
    options?: InvalidateOptions,
  ) {
    return this.queryClient.invalidateByOperationId(
      this.operationId,
      filters,
      options,
    );
  }

  invalidateByTags(
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'>,
    options?: InvalidateOptions,
  ) {
    return this.queryClient.invalidateByTags(this.tags, filters, options);
  }

  invalidate(
    input: TParams,
    filters?: Omit<InvalidateQueryFilters<any[]>, 'queryKey' | 'predicate'> & {
      queryKeyIndex?: number;
    },
    options?: InvalidateOptions,
  ) {
    return this.queryClient.invalidateQueries<any[]>(
      {
        ...filters,
        queryKey: this.getQueryKey(input).slice(0, filters?.queryKeyIndex),
        exact: filters?.exact ?? false,
      },
      options,
    );
  }

  getQueryKey(
    ...args: AllPropertiesOptional<TParams> extends true
      ? [input?: TParams, uniqKey?: EndpointQueryUnitKey]
      : [input: TParams, uniqKey?: EndpointQueryUnitKey]
  ): any[] {
    const params = args[0] ?? ({} as TParams);

    return [
      ...this.configuration.path,
      this.configuration.operationId,
      params,
      resolveFnValue(args[1]),
    ];
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
      options,
    );
  }

  toQuery<
    TQueryFnData = TResponse['data'],
    TError = DefaultError,
    TData = TQueryFnData,
    TQueryData = TQueryFnData,
  >(
    options: EndpointQueryOptions<
      this,
      TQueryFnData,
      TError,
      TData,
      TQueryData
    >,
  ) {
    return new EndpointQuery<this, TQueryFnData, TError, TData, TQueryData>(
      this,
      this.queryClient,
      options,
    );
  }
}
