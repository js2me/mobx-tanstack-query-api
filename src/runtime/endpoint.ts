import {
  InvalidateOptions,
  InvalidateQueryFilters,
  QueryClient,
} from '@tanstack/query-core';
import { AnyObject } from 'yummies/utils/types';

import {
  EndpointMutation,
  EndpointMutationOptions,
} from './endpoint-mutation.js';
import { EndpointQuery, EndpointQueryOptions } from './endpoint-query.js';
import type {
  FullRequestParams,
  HttpClient,
  HttpResponse,
} from './http-client.js';

export interface EndpointConfiguration<
  TParams extends any[] = any[],
  TMetaData extends AnyObject = AnyObject,
> {
  operationId: string;
  meta?: TMetaData;
  params: (...params: TParams) => FullRequestParams;
  keys: (
    | string
    | { name: string; param: number }
    | { name: string; rest: true }
  )[];
  tags: string[];
}

export interface Endpoint<
  TData,
  TError,
  TInput extends AnyObject,
  TParams extends any[] = any[],
  TMetaData extends AnyObject = AnyObject,
> {
  (
    ...params: TParams
  ): ReturnType<Endpoint<TData, TError, TInput, TParams, TMetaData>['request']>;
}

export class Endpoint<
  TData,
  TError,
  TInput extends AnyObject,
  TParams extends any[] = any[],
  TMetaData extends AnyObject = AnyObject,
> {
  meta!: TMetaData;

  constructor(
    public configuration: EndpointConfiguration<TParams, TMetaData>,
    protected queryClient: QueryClient,
    protected http: HttpClient,
  ) {
    this.meta = configuration.meta ?? ({} as TMetaData);
    // Сохраняем оригинальный инстанс
    const instance = this;

    // Создаем функцию-обертку
    const callable = function (this: any, ...params: TParams) {
      return instance.request.apply(instance, params);
    } as unknown as Endpoint<TData, TError, TInput, TParams, TMetaData>;

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

  private _hasRestParam?: boolean;
  private get hasRestParam(): boolean {
    if (this._hasRestParam === undefined) {
      this._hasRestParam = this.configuration.keys.some((key) => {
        if (typeof key !== 'string' && 'rest' in key) {
          return true;
        }
      });
    }

    return this._hasRestParam;
  }

  getParamsFromInput(input: TInput): TParams {
    const args: any[] = [];

    const restParams: any = {};

    if (this.hasRestParam) {
      args[0] = restParams;
    }

    this.configuration.keys.forEach((key) => {
      if (typeof key === 'object') {
        if (key.name === 'request') {
          args.push(input[key.name]);
        } else if (this.hasRestParam) {
          if ('rest' in key) {
            Object.assign(restParams, input);
          }
        } else if ('param' in key) {
          args[key.param] = input[key.name];
        }
      }
    });

    return args as TParams;
  }

  getFullUrl(input: TInput): string {
    const params = this.configuration.params(...this.getParamsFromInput(input));
    return this.http.buildUrl(params);
  }

  getPath(input: TInput): string {
    return this.configuration.params(...this.getParamsFromInput(input)).path;
  }

  get tags() {
    return this.configuration.tags;
  }

  get operationId() {
    return this.configuration.operationId;
  }

  request(...params: TParams) {
    return this.http.request<TData, TError>(
      this.configuration.params(...params),
    );
  }

  getQueryKey(input: TInput): any[] {
    const restParams: AnyObject = this.hasRestParam ? { ...input } : {};

    return this.configuration.keys.map((key) => {
      if (typeof key === 'string') {
        return key;
      }

      if (this.hasRestParam) {
        if ('rest' in key) {
          return restParams;
        } else {
          const param = restParams[key.name];
          delete restParams[key.name];
          return param;
        }
      } else {
        return input[key.name];
      }
    });
  }

  invalidateByOperationId(
    filters?: Omit<
      InvalidateQueryFilters<HttpResponse<TData, TError>>,
      'queryKey' | 'predicate'
    >,
    options?: InvalidateOptions,
  ) {
    return this.queryClient.invalidateQueries(
      {
        ...filters,
        predicate: (query) => {
          if (query.meta?.operationId) {
            return query.meta?.operationId === this.configuration.operationId;
          }

          return false;
        },
      },
      options,
    );
  }

  invalidateByTags(
    filters?: Omit<
      InvalidateQueryFilters<HttpResponse<TData, TError>>,
      'queryKey' | 'predicate'
    >,
    options?: InvalidateOptions,
  ) {
    return this.queryClient.invalidateQueries(
      {
        ...filters,
        predicate: (query) => {
          if (Array.isArray(query.meta?.tags)) {
            return query.meta.tags.some((tag) => this.tags.includes(tag));
          }

          return false;
        },
      },
      options,
    );
  }

  invalidate(
    input: TInput,
    filters?: Omit<
      InvalidateQueryFilters<HttpResponse<TData, TError>>,
      'queryKey' | 'predicate'
    > & { queryKeyIndex?: number },
    options?: InvalidateOptions,
  ) {
    return this.queryClient.invalidateQueries<HttpResponse<TData, TError>>(
      {
        ...filters,
        queryKey: this.getQueryKey(input).slice(0, filters?.queryKeyIndex),
        exact: filters?.exact ?? false,
      },
      options,
    );
  }

  toMutation<TMutationMeta extends AnyObject | void = void>(
    options: EndpointMutationOptions<typeof this, TMutationMeta>,
  ) {
    return new EndpointMutation(this, this.queryClient, options);
  }

  toQuery(options: EndpointQueryOptions<typeof this>) {
    return new EndpointQuery(this, this.queryClient, options);
  }
}
