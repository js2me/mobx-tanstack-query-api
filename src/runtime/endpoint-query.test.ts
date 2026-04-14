import { noop } from 'lodash-es';
import {
  comparer,
  computed,
  makeObservable,
  observable,
  observe,
  reaction,
  runInAction,
} from 'mobx';
import { Query } from 'mobx-tanstack-query';
import { describe, expect, it, vi } from 'vitest';
import { sleep } from 'yummies/async';
import {
  createHttpClientWithGuardFetch,
  createTestEndpoint,
} from '../testing/vitest-test-helpers.js';
import { Endpoint } from './endpoint.js';
import { EndpointQueryClient } from './endpoint-query-client.js';

const createEndpointForQueryTests = () => {
  const queryClient = new EndpointQueryClient({
    defaultOptions: {
      queries: {
        enableOnDemand: true,
      },
    },
  });
  return createTestEndpoint({ queryClient }).endpoint;
};

describe('EndpointQuery reactive options input updates', () => {
  it('reactively updates queryKey when only uniqKey changes', async () => {
    const endpoint = createEndpointForQueryTests();
    const uniqKeyBox = observable.box('first-key');

    const query = endpoint.toQuery(() => ({
      enableOnDemand: true,
      params: { id: 1 },
      uniqKey: uniqKeyBox.get(),
    }));

    const disposeObserveResult = reaction(() => query.result, noop, {
      fireImmediately: true,
    });

    await sleep();

    expect(query.options.queryKey).toEqual(
      endpoint.toQueryKey({ id: 1 }, 'first-key'),
    );

    runInAction(() => {
      uniqKeyBox.set('second-key');
    });
    await sleep();

    expect(query.options.queryKey).toEqual(
      endpoint.toQueryKey({ id: 1 }, 'second-key'),
    );

    disposeObserveResult();
    query.destroy();
  });

  it('reactively updates params, uniqKey and dynamic options for function input', async () => {
    const endpoint = createEndpointForQueryTests();
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

    const query = endpoint.toQuery(() => ({
      enableOnDemand: true,
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
      endpoint.toQueryKey({ id: 1 }, 'first'),
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
      endpoint.toQueryKey({ id: 2 }, 'second'),
    );
    expect(query.options.staleTime).toBe(1_337);
    expect((query as any)._observableData.dynamicOptions).toEqual({
      staleTime: 1_337,
    });

    runInAction(() => {
      state.includeUniqKey = false;
      state.includeDynamicOptions = false;
    });

    await sleep();

    expect(query.options.queryKey).toEqual(endpoint.toQueryKey({ id: 2 }));
    expect((query as any)._observableData.dynamicOptions).toBeUndefined();

    disposeObserveResult();
    query.destroy();
  });

  it('uses empty object params when function input omits params and updates on changes', async () => {
    const endpoint = createEndpointForQueryTests();
    const paramsBox = observable.box<{ id: number } | null>(null, {
      deep: false,
    });

    const query = endpoint.toQuery(() => {
      const params = paramsBox.get();
      return {
        enableOnDemand: true,
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
      endpoint.toQueryKey(undefined, 'stable-key'),
    );

    runInAction(() => {
      paramsBox.set({ id: 7 });
    });

    await sleep();

    expect(query.params).toEqual({ id: 7 });
    expect(query.options.queryKey).toEqual(
      endpoint.toQueryKey({ id: 7 }, 'stable-key'),
    );

    runInAction(() => {
      paramsBox.set(null);
    });

    await sleep();

    expect(query.params).toEqual({});
    expect(query.options.queryKey).toEqual(
      endpoint.toQueryKey(undefined, 'stable-key'),
    );

    disposeObserveResult();
    query.destroy();
  });

  it('reactively resolves params and uniqKey for object input with params function', async () => {
    const endpoint = createEndpointForQueryTests();
    const paramsBox = observable.box<{ id: number } | null>(null, {
      deep: false,
    });
    const uniqKeyBox = observable.box('first-uniq');

    const query = endpoint.toQuery({
      enableOnDemand: true,
      params: () => paramsBox.get(),
      uniqKey: () => uniqKeyBox.get(),
    });

    const disposeObserveResult = reaction(() => query.result, noop, {
      fireImmediately: true,
    });

    await sleep();

    expect(query.params).toBe(null);
    expect(query.options.queryKey).toEqual(
      endpoint.toQueryKey(undefined, 'first-uniq'),
    );

    runInAction(() => {
      paramsBox.set({ id: 3 });
      uniqKeyBox.set('second-uniq');
    });

    await sleep();

    expect(query.params).toEqual({ id: 3 });
    expect(query.options.queryKey).toEqual(
      endpoint.toQueryKey({ id: 3 }, 'second-uniq'),
    );

    disposeObserveResult();
    query.destroy();
  });
});

describe('EndpointQuery structural computed recreation loop', () => {
  const createRuntimeEndpoints = () => {
    const queryClient = new EndpointQueryClient();
    const { httpClient } = createHttpClientWithGuardFetch();
    const stableList = [{ id: 1 }];

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

    return { listEndpoint, nestedEndpoint };
  };

  it('does not enter structural-computed recreation loop when child model owns EndpointQuery', async () => {
    const { listEndpoint, nestedEndpoint } = createRuntimeEndpoints();
    let paramsCalls = 0;
    const createdQueries: Array<{ destroy: () => void }> = [];

    class RowNode {
      childrenQuery = nestedEndpoint.toQuery({
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
      listQuery = listEndpoint.toQuery({
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
        const items = this.listQuery.data ?? [];
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
    const { listEndpoint, nestedEndpoint } = createRuntimeEndpoints();
    let paramsCalls = 0;
    const createdQueries: Array<{ destroy: () => void }> = [];

    class RowNode {
      childrenQuery = nestedEndpoint.toQuery({
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
      listQuery = listEndpoint.toQuery({
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
        const items = this.listQuery.data ?? [];
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

describe('EndpointQuery structural-equal reaction updates', () => {
  it('does not write observableData.params for structurally equal params', async () => {
    const endpoint = createEndpointForQueryTests();
    const tick = observable.box(0);

    const query = endpoint.toQuery({
      enableOnDemand: true,
      params: () => {
        tick.get();
        return { id: 1 };
      },
    });

    const observableData = (query as any)._observableData;
    const initialParamsRef = observableData.params;
    let paramsWrites = 0;

    const disposeObserveParams = observe(observableData, 'params', () => {
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
    expect(observableData.params).toBe(initialParamsRef);

    disposeObserveParams();
    query.destroy();
  });
});

describe('EndpointInfiniteQuery structural-equal reaction updates', () => {
  it('does not write observableData.params for structurally equal params', async () => {
    const endpoint = createEndpointForQueryTests();
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

    const observableData = (query as any)._observableData;
    const initialParamsRef = observableData.params;
    let paramsWrites = 0;

    const disposeObserveParams = observe(observableData, 'params', () => {
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
    expect(observableData.params).toBe(initialParamsRef);

    disposeObserveParams();
    query.destroy();
  });
});

describe('regression: class field toQuery + structural parent', () => {
  const createRegressionEndpoints = () => {
    const queryClient = new EndpointQueryClient();
    const { httpClient } = createHttpClientWithGuardFetch();
    const stableList = [{ id: 1 }];

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

    return { listEndpoint, childrenEndpoint };
  };

  it('does not enter infinite reaction loop when params function returns structurally same object', async () => {
    const { listEndpoint, childrenEndpoint } = createRegressionEndpoints();
    const abortController = new AbortController();
    let paramsCalls = 0;
    const createdQueries: Array<{ destroy: () => void }> = [];

    class RowNode {
      private readonly childrenQuery = childrenEndpoint.toQuery({
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
      private readonly listQuery = listEndpoint.toQuery({
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
        const items = this.listQuery.data ?? [];
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
    const { listEndpoint, childrenEndpoint } = createRegressionEndpoints();
    const abortController = new AbortController();
    let paramsCalls = 0;
    const createdQueries: Array<{ destroy: () => void }> = [];

    class RowNode {
      private readonly childrenQuery = childrenEndpoint.toQuery({
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
      private readonly listQuery = listEndpoint.toQuery({
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
        const items = this.listQuery.data ?? [];
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

describe('EndpointQuery update branches', () => {
  it('updates params and builds options when update input includes params key', () => {
    const endpoint = createEndpointForQueryTests();
    const query = endpoint.toQuery({
      params: { id: 1 },
      uniqKey: 'stable-key',
      enableOnDemand: true,
    });
    const superUpdateSpy = vi
      .spyOn(Query.prototype, 'update')
      .mockImplementation((options: any) => options);

    const result = query.update({
      params: { id: 2 },
      staleTime: 5_000,
    });

    expect(query.params).toEqual({ id: 2 });
    expect(superUpdateSpy).toHaveBeenCalledWith({
      enabled: true,
      queryKey: endpoint.toQueryKey({ id: 2 }, 'stable-key'),
      staleTime: 5_000,
    });
    expect(result).toEqual({
      enabled: true,
      queryKey: endpoint.toQueryKey({ id: 2 }, 'stable-key'),
      staleTime: 5_000,
    });

    query.destroy();
  });

  it('reuses observable params when update input has no params key', () => {
    const endpoint = createEndpointForQueryTests();
    const query = endpoint.toQuery({
      params: { id: 3 },
      uniqKey: 'stable-key',
      enableOnDemand: true,
    });
    const superUpdateSpy = vi
      .spyOn(Query.prototype, 'update')
      .mockImplementation((options: any) => options);

    const result = query.update({
      staleTime: 7_000,
    });

    expect(superUpdateSpy).toHaveBeenCalledWith({
      enabled: true,
      queryKey: endpoint.toQueryKey({ id: 3 }, 'stable-key'),
      staleTime: 7_000,
    });
    expect(result).toEqual({
      enabled: true,
      queryKey: endpoint.toQueryKey({ id: 3 }, 'stable-key'),
      staleTime: 7_000,
    });

    query.destroy();
  });
});
