/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  InvalidateOptions,
  InvalidateQueryFilters,
} from '@tanstack/query-core';
import { AllPropertiesOptional, AnyObject } from 'yummies/utils/types';

import {
  EndpointMutation,
  EndpointMutationOptions,
} from './endpoint-mutation.js';
import { EndpointQueryClient } from './endpoint-query-client.js';
import { EndpointQuery } from './endpoint-query.js';
import { EndpointQueryOptions } from './endpoint-query.types.js';
import { EndpointConfiguration } from './endpoint.types.js';
import type { HttpClient, HttpResponse } from './http-client.js';

export interface Endpoint<
  TResponse extends HttpResponse<any, any>,
  TInput extends AnyObject,
  TMetaData extends AnyObject = AnyObject,
> {
  (
    ...args: AllPropertiesOptional<TInput> extends true
      ? [input?: TInput]
      : [input: TInput]
  ): ReturnType<Endpoint<TResponse, TInput, TMetaData>['request']>;
}

export class Endpoint<
  TResponse extends HttpResponse<any, any>,
  TInput extends AnyObject,
  TMetaData extends AnyObject = AnyObject,
> {
  meta!: TMetaData;

  constructor(
    public configuration: EndpointConfiguration<NoInfer<TInput>, TMetaData>,
    protected queryClient: EndpointQueryClient,
    protected http: HttpClient,
  ) {
    this.meta = configuration.meta ?? ({} as TMetaData);
    // Сохраняем оригинальный инстанс
    const instance = this;

    // Создаем функцию-обертку
    const callable = function (
      this: any,
      ...args: AllPropertiesOptional<TInput> extends true
        ? [input?: TInput]
        : [input: TInput]
    ) {
      return instance.request.apply(instance, args);
    } as unknown as Endpoint<TResponse, TInput, TMetaData>;

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
    ...args: AllPropertiesOptional<TInput> extends true
      ? [input?: TInput]
      : [input: TInput]
  ): string {
    const params = this.configuration.params(args[0] ?? ({} as TInput));
    return this.http.buildUrl(params);
  }

  getPath(
    ...args: AllPropertiesOptional<TInput> extends true
      ? [input?: TInput]
      : [input: TInput]
  ): string {
    const params = this.configuration.params(args[0] ?? ({} as TInput));
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
    ...args: AllPropertiesOptional<TInput> extends true
      ? [input?: TInput]
      : [input: TInput]
  ) {
    return this.http.request<TResponse>(
      this.configuration.params(args[0] ?? ({} as TInput)),
    );
  }

  getQueryKey(
    ...args: AllPropertiesOptional<TInput> extends true
      ? [input?: TInput]
      : [input: TInput]
  ): any[] {
    const input = args[0] ?? ({} as TInput);

    return [...this.configuration.path, this.configuration.operationId, input];
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
    input: TInput,
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

  toMutation<
    TOutput = TResponse,
    TMutationMeta extends AnyObject | void = void,
  >(
    options: EndpointMutationOptions<TOutput, TInput, TResponse, TMutationMeta>,
  ) {
    return new EndpointMutation(this, this.queryClient, options);
  }

  toQuery<TOutput = TResponse>(
    options: EndpointQueryOptions<TOutput, TInput, TResponse>,
  ) {
    return new EndpointQuery<TOutput, TInput, TResponse>(
      this,
      this.queryClient,
      options,
    );
  }
}
