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
    const stableClusters = [{ id: 1 }];

    const clustersEndpoint = new Endpoint<any, Record<string, never>>(
      {
        params: () => ({
          path: '/clusters',
          method: 'GET',
          format: 'json',
        }),
        requiredParams: [],
        operationId: 'getClusters',
        path: ['clusters'],
        tags: [],
        meta: {},
      },
      queryClient,
      httpClient,
    );
    vi.spyOn(clustersEndpoint, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      data: stableClusters,
      error: null,
      headers: new Headers(),
      raw: null,
    } as any);

    const childrenEndpoint = new Endpoint<any, { clusterId: number }>(
      {
        params: ({ clusterId }) => ({
          path: `/clusters/${clusterId}/children`,
          method: 'GET',
          format: 'json',
        }),
        requiredParams: ['clusterId'],
        operationId: 'getClusterChildren',
        path: ['clusters', '{clusterId}', 'children'],
        tags: [],
        meta: {},
      },
      queryClient,
      httpClient,
    );
    vi.spyOn(childrenEndpoint, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      data: [],
      error: null,
      headers: new Headers(),
      raw: null,
    } as any);

    return { clustersEndpoint, childrenEndpoint };
  };

  it('does not enter structural-computed recreation loop when child model owns EndpointQuery', async () => {
    const { clustersEndpoint, childrenEndpoint } = createRuntimeEndpoints();
    let paramsCalls = 0;
    const createdQueries: Array<{ destroy: () => void }> = [];

    class ClusterNode {
      childrenQuery = childrenEndpoint.toQuery({
        params: () => {
          paramsCalls += 1;
          if (paramsCalls > 100) {
            throw new Error('infinite loop detected');
          }
          return { clusterId: this.cluster.id };
        },
      });

      constructor(private cluster: { id: number }) {
        createdQueries.push(this.childrenQuery);
      }

      get row() {
        return {
          clusterId: this.cluster.id,
          isFetching: this.childrenQuery.isFetching,
          hasData: !!this.childrenQuery.data,
        };
      }
    }

    class TreeVm {
      clustersQuery = clustersEndpoint.toQuery({
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
        const clusters = this.clustersQuery.data ?? [];
        return clusters.map(
          (cluster: { id: number }) => new ClusterNode(cluster),
        );
      }

      get rows() {
        return this.data.map((item: ClusterNode) => item.row);
      }
    }

    const vm = new TreeVm();
    const dispose = reaction(() => vm.rows, noop, {
      fireImmediately: true,
    });

    await sleep();
    expect(paramsCalls).toBeLessThanOrEqual(5);

    dispose();
    vm.clustersQuery.destroy();
    createdQueries.forEach((query) => {
      query.destroy();
    });
  });

  it('does not loop when child params are falsy', async () => {
    const { clustersEndpoint, childrenEndpoint } = createRuntimeEndpoints();
    let paramsCalls = 0;
    const createdQueries: Array<{ destroy: () => void }> = [];

    class ClusterNode {
      childrenQuery = childrenEndpoint.toQuery({
        params: () => {
          paramsCalls += 1;
          if (paramsCalls > 100) {
            throw new Error('infinite loop detected');
          }
          return false;
        },
      });

      constructor(private cluster: { id: number }) {
        createdQueries.push(this.childrenQuery);
      }

      get row() {
        return {
          clusterId: this.cluster.id,
          isFetching: this.childrenQuery.isFetching,
        };
      }
    }

    class TreeVm {
      clustersQuery = clustersEndpoint.toQuery({
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
        const clusters = this.clustersQuery.data ?? [];
        return clusters.map(
          (cluster: { id: number }) => new ClusterNode(cluster),
        );
      }

      get rows() {
        return this.data.map((item: ClusterNode) => item.row);
      }
    }

    const vm = new TreeVm();
    const dispose = reaction(() => vm.rows, noop, {
      fireImmediately: true,
    });

    await sleep();
    expect(paramsCalls).toBeLessThanOrEqual(100);

    dispose();
    vm.clustersQuery.destroy();
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
