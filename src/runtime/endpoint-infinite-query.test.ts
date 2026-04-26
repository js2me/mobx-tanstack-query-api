import { noop } from 'es-toolkit';
import {
  comparer,
  computed,
  makeObservable,
  observable,
  observe,
  reaction,
  runInAction,
} from 'mobx';
import { InfiniteQuery } from 'mobx-tanstack-query';
import { describe, expect, it, vi } from 'vitest';
import { sleep } from 'yummies/async';
import { mockEndpointRequestOnce } from '../testing/mock-endpoint-request-once.js';
import {
  createHttpClientWithGuardFetch,
  createTestEndpoint,
} from '../testing/vitest-test-helpers.js';
import { Endpoint } from './endpoint.js';
import { EndpointQueryClient } from './endpoint-query-client.js';

const createEndpointForInfiniteQueryTests = () => {
  const queryClient = new EndpointQueryClient({
    defaultOptions: {
      queries: {
        enableOnDemand: true,
      },
    },
  });
  return createTestEndpoint({ queryClient }).endpoint;
};

describe('EndpointInfiniteQuery structural-equal reaction updates', () => {
  it('does not write sync.params for structurally equal params', async () => {
    const endpoint = createEndpointForInfiniteQueryTests();
    const tick = observable.box(0);
    const getNextPageParam = () => undefined;

    const query = endpoint.toInfiniteQuery(() => {
      tick.get();
      return {
        enableOnDemand: true,
        initialPageParam: 0,
        getNextPageParam,
        params: { id: 1 },
      };
    });

    const sync = (query as any)._sync;
    const initialParamsRef = sync.params;
    let paramsWrites = 0;

    const disposeObserveParams = observe(sync, 'params', () => {
      paramsWrites += 1;
    });

    runInAction(() => {
      tick.set(1);
    });
    await sleep();

    runInAction(() => {
      tick.set(2);
    });
    await sleep();

    expect(paramsWrites).toBe(0);
    expect(sync.params).toBe(initialParamsRef);

    disposeObserveParams();
    query.destroy();
  });
});

describe('EndpointInfiniteQuery reactive options input updates', () => {
  const getNextPageParam = () => undefined;

  it('reactively updates queryKey when only uniqKey changes', async () => {
    const endpoint = createEndpointForInfiniteQueryTests();
    const uniqKeyBox = observable.box('first-key');

    const query = endpoint.toInfiniteQuery(() => ({
      enableOnDemand: true,
      initialPageParam: 0,
      getNextPageParam,
      params: { id: 1 },
      uniqKey: uniqKeyBox.get(),
    }));

    const disposeObserveResult = reaction(() => query.result, noop, {
      fireImmediately: true,
    });

    await sleep();

    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey({ id: 1 }, 'first-key'),
    );

    runInAction(() => {
      uniqKeyBox.set('second-key');
    });
    await sleep();

    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey({ id: 1 }, 'second-key'),
    );

    disposeObserveResult();
    query.destroy();
  });

  it('reactively updates params, uniqKey and dynamic options for function input', async () => {
    const endpoint = createEndpointForInfiniteQueryTests();
    const state = observable(
      {
        id: 1,
        uniqKey: 'first',
        includeUniqKey: true,
        includeDynamicOptions: false,
      },
      {},
      {
        deep: false,
      },
    );

    const query = endpoint.toInfiniteQuery(() => ({
      enableOnDemand: true,
      initialPageParam: 0,
      getNextPageParam,
      params: { id: state.id },
      ...(state.includeUniqKey ? { uniqKey: state.uniqKey } : {}),
      ...(state.includeDynamicOptions ? { staleTime: 1_337 } : {}),
    }));

    const disposeObserveResult = reaction(() => query.result, noop, {
      fireImmediately: true,
    });

    await sleep();

    expect(query.params).toEqual({ id: 1 });
    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey({ id: 1 }, 'first'),
    );
    expect(query.options.staleTime).toBeUndefined();

    runInAction(() => {
      state.id = 2;
      state.uniqKey = 'second';
      state.includeDynamicOptions = true;
    });

    await sleep();

    expect(query.params).toEqual({ id: 2 });
    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey({ id: 2 }, 'second'),
    );
    expect(query.options.staleTime).toBe(1_337);

    runInAction(() => {
      state.includeUniqKey = false;
      state.includeDynamicOptions = false;
    });

    await sleep();

    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey({ id: 2 }),
    );

    disposeObserveResult();
    query.destroy();
  });

  it('uses empty object params when function input omits params and updates on changes', async () => {
    const endpoint = createEndpointForInfiniteQueryTests();
    const paramsBox = observable.box<{ id: number } | null>(null, {
      deep: false,
    });

    const query = endpoint.toInfiniteQuery(() => {
      const params = paramsBox.get();
      return {
        enableOnDemand: true,
        initialPageParam: 0,
        getNextPageParam,
        uniqKey: 'stable-key',
        ...(params ? { params } : {}),
      };
    });

    const disposeObserveResult = reaction(() => query.result, noop, {
      fireImmediately: true,
    });

    await sleep();

    expect(query.params).toEqual({});
    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey(undefined, 'stable-key'),
    );

    runInAction(() => {
      paramsBox.set({ id: 7 });
    });

    await sleep();

    expect(query.params).toEqual({ id: 7 });
    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey({ id: 7 }, 'stable-key'),
    );

    runInAction(() => {
      paramsBox.set(null);
    });

    await sleep();

    expect(query.params).toEqual({});
    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey(undefined, 'stable-key'),
    );

    disposeObserveResult();
    query.destroy();
  });

  it('reactively resolves params and uniqKey for object input with params function', async () => {
    const endpoint = createEndpointForInfiniteQueryTests();
    const paramsBox = observable.box<{ id: number } | null>(null, {
      deep: false,
    });
    const uniqKeyBox = observable.box('first-uniq');

    const query = endpoint.toInfiniteQuery({
      enableOnDemand: true,
      initialPageParam: 0,
      getNextPageParam,
      params: () => paramsBox.get(),
      uniqKey: () => uniqKeyBox.get(),
    });

    const disposeObserveResult = reaction(() => query.result, noop, {
      fireImmediately: true,
    });

    await sleep();

    expect(query.params).toBe(null);
    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey(undefined, 'first-uniq'),
    );

    runInAction(() => {
      paramsBox.set({ id: 3 });
      uniqKeyBox.set('second-uniq');
    });

    await sleep();

    expect(query.params).toEqual({ id: 3 });
    expect(query.options.queryKey).toEqual(
      endpoint.toInfiniteQueryKey({ id: 3 }, 'second-uniq'),
    );

    disposeObserveResult();
    query.destroy();
  });
});

describe('EndpointInfiniteQuery update branches', () => {
  const getNextPageParam = () => undefined;

  it('updates params and builds options when update input includes params key', () => {
    const endpoint = createEndpointForInfiniteQueryTests();
    const query = endpoint.toInfiniteQuery({
      params: { id: 1 },
      uniqKey: 'stable-key',
      initialPageParam: 0,
      getNextPageParam,
      enableOnDemand: true,
    });
    const superUpdateSpy = vi
      .spyOn(InfiniteQuery.prototype, 'update')
      .mockImplementation((options: any) => options);

    const result = query.update({
      params: { id: 2 },
      staleTime: 5_000,
    } as any);

    expect(query.params).toEqual({ id: 2 });
    expect(superUpdateSpy).toHaveBeenCalledWith({
      enabled: true,
      queryKey: endpoint.toInfiniteQueryKey({ id: 2 }, 'stable-key'),
      staleTime: 5_000,
    });
    expect(result).toEqual({
      enabled: true,
      queryKey: endpoint.toInfiniteQueryKey({ id: 2 }, 'stable-key'),
      staleTime: 5_000,
    });

    query.destroy();
  });

  it('reuses observable params when update input has no params key', () => {
    const endpoint = createEndpointForInfiniteQueryTests();
    const query = endpoint.toInfiniteQuery({
      params: { id: 3 },
      uniqKey: 'stable-key',
      initialPageParam: 0,
      getNextPageParam,
      enableOnDemand: true,
    });
    const superUpdateSpy = vi
      .spyOn(InfiniteQuery.prototype, 'update')
      .mockImplementation((options: any) => options);

    const result = query.update({
      staleTime: 7_000,
    } as any);

    expect(superUpdateSpy).toHaveBeenCalledWith({
      enabled: true,
      queryKey: endpoint.toInfiniteQueryKey({ id: 3 }, 'stable-key'),
      staleTime: 7_000,
    });
    expect(result).toEqual({
      enabled: true,
      queryKey: endpoint.toInfiniteQueryKey({ id: 3 }, 'stable-key'),
      staleTime: 7_000,
    });

    query.destroy();
  });
});

describe('EndpointInfiniteQuery structural computed recreation loop', () => {
  const createRuntimeEndpoints = () => {
    const queryClient = new EndpointQueryClient();
    const { httpClient } = createHttpClientWithGuardFetch();
    const stableList = [{ id: 1 }];
    const getNextPageParam = () => undefined;

    const listEndpoint = new Endpoint<any, Record<string, never>>(
      {
        params: () => ({
          path: '/struct-loop-parent-list',
          method: 'GET',
          format: 'json',
        }),
        requiredParams: [],
        operationId: 'structLoopParentList',
        path: ['struct-loop-parent-list'],
        tags: [],
        meta: {},
      },
      queryClient,
      httpClient,
    );
    vi.spyOn(listEndpoint, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      data: stableList,
      error: null,
      headers: new Headers(),
      raw: null,
    } as any);

    const nestedEndpoint = new Endpoint<any, { parentId: number }>(
      {
        params: ({ parentId }) => ({
          path: `/struct-loop-parent-list/${parentId}/nested`,
          method: 'GET',
          format: 'json',
        }),
        requiredParams: ['parentId'],
        operationId: 'structLoopNested',
        path: ['struct-loop-parent-list', '{parentId}', 'nested'],
        tags: [],
        meta: {},
      },
      queryClient,
      httpClient,
    );
    vi.spyOn(nestedEndpoint, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      data: [],
      error: null,
      headers: new Headers(),
      raw: null,
    } as any);

    return { listEndpoint, nestedEndpoint, getNextPageParam };
  };

  it('does not enter structural-computed recreation loop when child model owns EndpointInfiniteQuery', async () => {
    const { listEndpoint, nestedEndpoint, getNextPageParam } =
      createRuntimeEndpoints();
    let paramsCalls = 0;
    const createdQueries: Array<{ destroy: () => void }> = [];

    class RowNode {
      childrenQuery = nestedEndpoint.toInfiniteQuery({
        initialPageParam: 0,
        getNextPageParam,
        params: () => {
          paramsCalls += 1;
          if (paramsCalls > 100) {
            throw new Error('infinite loop detected');
          }
          return { parentId: this.item.id };
        },
      });

      constructor(private item: { id: number }) {
        createdQueries.push(this.childrenQuery);
      }

      get row() {
        return {
          parentId: this.item.id,
          isFetching: this.childrenQuery.isFetching,
          hasData: !!this.childrenQuery.data,
        };
      }
    }

    class TreeVm {
      listQuery = listEndpoint.toInfiniteQuery({
        initialPageParam: 0,
        getNextPageParam,
        params: () => ({}),
      });

      constructor() {
        makeObservable(this, {
          data: computed({
            equals: comparer.structural,
          }),
          rows: computed,
        });
      }

      get data() {
        const items = this.listQuery.data?.pages?.flat() ?? [];
        return items.map((item: { id: number }) => new RowNode(item));
      }

      get rows() {
        return this.data.map((item: RowNode) => item.row);
      }
    }

    const vm = new TreeVm();
    const dispose = reaction(() => vm.rows, noop, {
      fireImmediately: true,
    });

    await sleep();
    expect(paramsCalls).toBeLessThanOrEqual(5);

    dispose();
    vm.listQuery.destroy();
    createdQueries.forEach((query) => {
      query.destroy();
    });
  });

  it('does not loop when child params are falsy', async () => {
    const { listEndpoint, nestedEndpoint, getNextPageParam } =
      createRuntimeEndpoints();
    let paramsCalls = 0;
    const createdQueries: Array<{ destroy: () => void }> = [];

    class RowNode {
      childrenQuery = nestedEndpoint.toInfiniteQuery({
        initialPageParam: 0,
        getNextPageParam,
        params: () => {
          paramsCalls += 1;
          if (paramsCalls > 100) {
            throw new Error('infinite loop detected');
          }
          return false;
        },
      });

      constructor(private item: { id: number }) {
        createdQueries.push(this.childrenQuery);
      }

      get row() {
        return {
          parentId: this.item.id,
          isFetching: this.childrenQuery.isFetching,
        };
      }
    }

    class TreeVm {
      listQuery = listEndpoint.toInfiniteQuery({
        initialPageParam: 0,
        getNextPageParam,
        params: () => ({}),
      });

      constructor() {
        makeObservable(this, {
          data: computed({
            equals: comparer.structural,
          }),
          rows: computed,
        });
      }

      get data() {
        const items = this.listQuery.data?.pages?.flat() ?? [];
        return items.map((item: { id: number }) => new RowNode(item));
      }

      get rows() {
        return this.data.map((item: RowNode) => item.row);
      }
    }

    const vm = new TreeVm();
    const dispose = reaction(() => vm.rows, noop, {
      fireImmediately: true,
    });

    await sleep();
    expect(paramsCalls).toBeLessThanOrEqual(100);

    dispose();
    vm.listQuery.destroy();
    createdQueries.forEach((query) => {
      query.destroy();
    });
  });
});

describe('regression: class field toInfiniteQuery + structural parent', () => {
  const createRegressionEndpoints = () => {
    const queryClient = new EndpointQueryClient();
    const { httpClient } = createHttpClientWithGuardFetch();
    const stableList = [{ id: 1 }];
    const getNextPageParam = () => undefined;

    const listEndpoint = new Endpoint<any, Record<string, never>>(
      {
        params: () => ({
          path: '/regression-parent-list',
          method: 'GET',
          format: 'json',
        }),
        requiredParams: [],
        operationId: 'regressionParentList',
        path: ['regression-parent-list'],
        tags: [],
        meta: {},
      },
      queryClient,
      httpClient,
    );
    vi.spyOn(listEndpoint, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      data: stableList,
      error: null,
      headers: new Headers(),
      raw: null,
    } as any);

    const childrenEndpoint = createTestEndpoint({ queryClient }).endpoint;
    vi.spyOn(childrenEndpoint, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      data: [],
      error: null,
      headers: new Headers(),
      raw: null,
    } as any);

    return { listEndpoint, childrenEndpoint, getNextPageParam };
  };

  it('does not enter infinite reaction loop when params function returns structurally same object', async () => {
    const { listEndpoint, childrenEndpoint, getNextPageParam } =
      createRegressionEndpoints();
    const abortController = new AbortController();
    let paramsCalls = 0;
    const createdQueries: Array<{ destroy: () => void }> = [];

    class RowNode {
      private readonly childrenQuery = childrenEndpoint.toInfiniteQuery({
        initialPageParam: 0,
        getNextPageParam,
        params: () => {
          paramsCalls += 1;
          if (paramsCalls > 100) {
            throw new Error('infinite loop detected');
          }
          return { id: this.data.id };
        },
        abortSignal: abortController.signal,
      });

      constructor(
        private readonly data: { id: number },
        private readonly signal: AbortSignal,
      ) {
        createdQueries.push(this.childrenQuery);
      }

      get row() {
        return {
          id: this.data.id,
          aborted: this.signal.aborted,
          isFetching: this.childrenQuery.isFetching,
          hasData: !!this.childrenQuery.data,
        };
      }
    }

    class TreeVm {
      private readonly listQuery = listEndpoint.toInfiniteQuery({
        initialPageParam: 0,
        getNextPageParam,
        params: () => ({}),
      });

      constructor(private readonly signal: AbortSignal) {
        makeObservable(this, {
          data: computed({
            equals: comparer.structural,
          }),
          rows: computed,
        });
      }

      get data() {
        const items = this.listQuery.data?.pages?.flat() ?? [];
        return items.map((item: { id: number }) => {
          return new RowNode(item, this.signal);
        });
      }

      get rows() {
        return this.data.map((node: RowNode) => node.row);
      }

      destroy() {
        this.listQuery.destroy();
      }
    }

    const vm = new TreeVm(abortController.signal);
    const dispose = reaction(() => vm.rows, noop, {
      fireImmediately: true,
    });

    await sleep();
    expect(paramsCalls).toBeLessThanOrEqual(5);

    dispose();
    vm.destroy();
    createdQueries.forEach((query) => {
      query.destroy();
    });
  });

  it('stays stable when params returns falsy', async () => {
    const { listEndpoint, childrenEndpoint, getNextPageParam } =
      createRegressionEndpoints();
    const abortController = new AbortController();
    let paramsCalls = 0;
    const createdQueries: Array<{ destroy: () => void }> = [];

    class RowNode {
      private readonly childrenQuery = childrenEndpoint.toInfiniteQuery({
        initialPageParam: 0,
        getNextPageParam,
        params: () => {
          paramsCalls += 1;
          if (paramsCalls > 100) {
            throw new Error('infinite loop detected');
          }
          return false;
        },
        abortSignal: abortController.signal,
      });

      constructor(
        private readonly data: { id: number },
        private readonly signal: AbortSignal,
      ) {
        createdQueries.push(this.childrenQuery);
      }

      get row() {
        return {
          id: this.data.id,
          aborted: this.signal.aborted,
          isFetching: this.childrenQuery.isFetching,
        };
      }
    }

    class TreeVm {
      private readonly listQuery = listEndpoint.toInfiniteQuery({
        initialPageParam: 0,
        getNextPageParam,
        params: () => ({}),
      });

      constructor(private readonly signal: AbortSignal) {
        makeObservable(this, {
          data: computed({
            equals: comparer.structural,
          }),
          rows: computed,
        });
      }

      get data() {
        const items = this.listQuery.data?.pages?.flat() ?? [];
        return items.map((item: { id: number }) => {
          return new RowNode(item, this.signal);
        });
      }

      get rows() {
        return this.data.map((node: RowNode) => node.row);
      }

      destroy() {
        this.listQuery.destroy();
      }
    }

    const vm = new TreeVm(abortController.signal);
    const dispose = reaction(() => vm.rows, noop, {
      fireImmediately: true,
    });

    await sleep();
    expect(paramsCalls).toBeLessThanOrEqual(100);

    dispose();
    vm.destroy();
    createdQueries.forEach((query) => {
      query.destroy();
    });
  });
});

describe('derived class constructor order regression', () => {
  it('binds queryRef from options callback before first queryFn write', async () => {
    const queryClient = new EndpointQueryClient({
      defaultOptions: {
        queries: {
          enableOnDemand: false,
          retry: false,
        },
      },
    });
    const { endpoint } = createTestEndpoint({ queryClient });
    const onErrorSpy = vi.fn();
    const getNextPageParam = () => undefined;

    mockEndpointRequestOnce(endpoint, {
      success: {
        value: 'early',
      },
    });

    class BaseUnit {
      constructor(protected readonly signal?: AbortSignal) {}
    }

    class DerivedUnit extends BaseUnit {
      private readonly query = endpoint.toInfiniteQuery(() => ({
        abortSignal: this.signal,
        params: { id: 1 },
        initialPageParam: 0,
        getNextPageParam,
        enableOnDemand: false,
        onError: onErrorSpy,
      }));

      get response() {
        return this.query.response;
      }

      destroy() {
        this.query.destroy();
      }
    }

    const unit = new DerivedUnit(new AbortController().signal);
    await sleep();

    expect(onErrorSpy).not.toHaveBeenCalled();
    expect(unit.response?.data).toEqual({ value: 'early' });

    unit.destroy();
  });

  it("Must call super constructor in derived class before accessing 'this' or returning from derived constructor", async () => {
    const queryClient = new EndpointQueryClient({
      defaultOptions: {
        queries: {
          autoRemovePreviousQuery: true,
          enableOnDemand: true,
          throwOnError: true,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          staleTime: (query) => {
            if (query.getObserversCount() > 1) {
              return Infinity;
            }

            return 0;
          },
          retry: false,
          gcTime: 0,
          dynamicOptionsComparer: comparer.structural,
        },
        mutations: {
          gcTime: 0,
          networkMode: 'always',
          throwOnError: true,
        },
      },
    });
    const { endpoint } = createTestEndpoint({ queryClient });
    const getNextPageParam = () => undefined;

    mockEndpointRequestOnce(endpoint, {
      success: {
        value: '1',
      },
    });

    class BaseUnit {
      constructor(protected readonly signal?: AbortSignal) {}
    }

    const onErrorSpy = vi.fn();

    class NeutralUnit extends BaseUnit {
      private readonly primaryMap = observable.map<string, any>();
      private readonly secondaryMap = observable.map<string, any>();

      private readonly listQuery = endpoint.toInfiniteQuery(() => ({
        abortSignal: this.signal,
        params: { id: 1 },
        initialPageParam: 0,
        getNextPageParam,
        enableOnDemand: false,
        select: (data: any) => data.pages.flat(),
        onDone: (items) => {
          items?.forEach((item: any) => {
            if (item?.code?.startsWith('S_')) {
              this.secondaryMap.set(item.code, item);
            } else {
              this.primaryMap.set(item?.code ?? 'unknown', item);
            }
          });
        },
        onError: onErrorSpy,
      }));

      get all() {
        return [
          ...Array.from(this.primaryMap.values()),
          ...Array.from(this.secondaryMap.values()),
        ];
      }

      destroy() {
        this.listQuery.destroy();
      }
    }

    const createInstance = () => new NeutralUnit(new AbortController().signal);
    expect(createInstance).not.toThrow();

    const instance = createInstance();
    expect(instance.all).toEqual([]);

    await sleep();

    expect(onErrorSpy).not.toHaveBeenCalled();

    instance.destroy();
  });
});
