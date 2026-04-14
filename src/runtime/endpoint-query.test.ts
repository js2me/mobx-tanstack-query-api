import { noop } from 'lodash-es';
import { observable, reaction, runInAction } from 'mobx';
import { describe, expect, it } from 'vitest';
import { sleep } from 'yummies/async';
import { createTestEndpoint } from '../testing/vitest-test-helpers.js';
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
      params: () => ({ id: state.id }),
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
      endpoint.toQueryKey({}, 'stable-key'),
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
      endpoint.toQueryKey({}, 'stable-key'),
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
      endpoint.toQueryKey({}, 'first-uniq'),
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
