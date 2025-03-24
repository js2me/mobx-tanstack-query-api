import {
  InvalidateOptions,
  InvalidateQueryFilters,
  QueryClient,
  QueryFunctionContext,
} from '@tanstack/query-core';
import {
  MobxMutation,
  MobxMutationConfig,
  MobxQuery,
  MobxQueryConfig,
} from 'mobx-tanstack-query';
import { AnyObject, MaybeFalsy } from 'yummies/utils/types';

import { EndpointMutationInput } from './endpoint.types.js';
import type {
  FullRequestParams,
  HttpClient,
  HttpResponse,
} from './http-client.js';

export interface Endpoint<
  TData,
  TError,
  TInput extends AnyObject,
  TParams extends any[] = any[],
> {
  (
    ...params: TParams
  ): ReturnType<Endpoint<TData, TError, TInput, TParams>['request']>;
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
    protected cfg: {
      operationId: string;
      meta?: TMetaData;
      params: (...params: TParams) => FullRequestParams;
      keys: (
        | string
        | { name: string; param: number }
        | { name: string; rest: true }
      )[];
      tags: string[];
    },
    protected queryClient: QueryClient,
    protected http: HttpClient,
  ) {
    this.meta = cfg.meta ?? ({} as TMetaData);
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

  private get hasRestParam(): boolean {
    return this.cfg.keys.some((key) => {
      if (typeof key !== 'string' && 'rest' in key) {
        return true;
      }
    });
  }

  protected buildParamsFromContext(ctx: QueryFunctionContext<any, any>) {
    const input = this.buildInputFromQueryKey(ctx.queryKey);
    return this.buildParamsFromInput(input);
  }

  protected buildParamsFromInput(input: TInput): TParams {
    const args: any[] = [];

    const restParams: any = {};

    if (this.hasRestParam) {
      args[0] = restParams;
    }

    this.cfg.keys.forEach((key) => {
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

  protected buildQueryKeyFromInput(input: TInput): any[] {
    const restParams: AnyObject = this.hasRestParam ? { ...input } : {};

    return this.cfg.keys.map((key) => {
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

  protected buildInputFromQueryKey(queryKey: any[]): TInput {
    const input: AnyObject = {};

    this.cfg.keys.forEach((key, index) => {
      const keyPart = queryKey[index];

      if (typeof key === 'string') {
        return;
      }

      if (key.name === 'request') {
        input[key.name] = keyPart;
        return;
      }

      if ('rest' in key) {
        Object.assign(input, keyPart);
        return;
      }

      if ('param' in key) {
        input[key.name] = keyPart;
      }
    });

    return input as TInput;
  }

  getFullUrl(input: TInput): string {
    const params = this.cfg.params(...this.buildParamsFromInput(input));
    return this.http.buildUrl(params);
  }

  getPath(input: TInput): string {
    return this.cfg.params(...this.buildParamsFromInput(input)).path;
  }

  getTags() {
    return this.cfg.tags;
  }

  request(...params: TParams) {
    return this.http.request<TData, TError>(this.cfg.params(...params));
  }

  toQueryKey(input: TInput): any[] {
    return this.buildQueryKeyFromInput(input);
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
            return query.meta?.operationId === this.cfg.operationId;
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
    const tags = this.getTags();

    return this.queryClient.invalidateQueries(
      {
        ...filters,
        predicate: (query) => {
          if (Array.isArray(query.meta?.tags)) {
            return query.meta.tags.some((tag) => tags.includes(tag));
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
        queryKey: this.toQueryKey(input).slice(0, filters?.queryKeyIndex),
        exact: filters?.exact ?? false,
      },
      options,
    );
  }

  toMutation<TMutationMeta extends AnyObject | void = void>(
    options: Omit<
      MobxMutationConfig<
        HttpResponse<TData, TError>,
        EndpointMutationInput<TInput, TMutationMeta>,
        TError
      >,
      'queryClient' | 'mutationFn'
    >,
  ) {
    return new MobxMutation<
      HttpResponse<TData, TError>,
      EndpointMutationInput<TInput, TMutationMeta>,
      TError
    >({
      ...options,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      queryClient: this.queryClient,
      mutationFn: (input) => this.request(...this.buildParamsFromInput(input)),
    });
  }

  toQuery({
    input: getInput,
    ...options
  }: Omit<
    MobxQueryConfig<HttpResponse<TData, TError>, TError>,
    'options' | 'queryFn' | 'queryClient'
  > & {
    input: () => MaybeFalsy<TInput>;
  }) {
    return new MobxQuery<HttpResponse<TData, TError>, TError>({
      ...options,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      queryClient: this.queryClient,
      options: () => {
        const input = getInput();

        return {
          meta: {
            tags: this.getTags(),
            operationId: this.cfg.operationId,
            ...options.meta,
          },
          enabled: !!input,
          queryKey: input ? this.toQueryKey(input) : ('__SKIP__' as any),
        };
      },
      queryFn: async (ctx) => {
        const args = this.buildParamsFromContext(ctx as any);
        const requestParamsIndex = args.length - 1;

        if (args[requestParamsIndex]) {
          if (!args[requestParamsIndex].signal) {
            args[requestParamsIndex].signal = ctx.signal;
          }
        } else {
          args[requestParamsIndex] = { signal: ctx.signal };
        }

        const response = await this.request(...args);
        return response;
      },
    });
  }
}
