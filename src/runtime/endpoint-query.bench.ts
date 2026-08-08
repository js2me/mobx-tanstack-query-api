import { bench, describe } from 'vitest';
import { createTestEndpoint } from '../testing/vitest-test-helpers.js';
import { EndpointQueryClient } from './endpoint-query-client.js';

const createEndpoint = () => {
  const queryClient = new EndpointQueryClient({
    defaultOptions: {
      queries: {
        enableOnDemand: true,
      },
    },
  });
  return createTestEndpoint({ queryClient }).endpoint;
};

describe('EndpointQuery', () => {
  bench('endpoint.toQuery and destroy', () => {
    const endpoint = createEndpoint();
    const query = endpoint.toQuery({
      enableOnDemand: true,
      params: { id: 1 },
    });
    query.destroy();
  });

  bench('endpoint.toQuery with function input', () => {
    const endpoint = createEndpoint();
    const query = endpoint.toQuery(() => ({
      enableOnDemand: true,
      params: { id: 1 },
      uniqKey: 'uniq',
    }));
    query.destroy();
  });

  bench('query.params read', () => {
    const endpoint = createEndpoint();
    const query = endpoint.toQuery({
      enableOnDemand: true,
      params: { id: 1 },
    });
    void query.params;
    query.destroy();
  });
});

describe('EndpointInfiniteQuery', () => {
  const getNextPageParam = () => undefined;

  bench('endpoint.toInfiniteQuery and destroy', () => {
    const endpoint = createEndpoint();
    const query = endpoint.toInfiniteQuery({
      enableOnDemand: true,
      initialPageParam: 0,
      getNextPageParam,
      params: { id: 1 },
    });
    query.destroy();
  });

  bench('endpoint.toInfiniteQuery with function input', () => {
    const endpoint = createEndpoint();
    const query = endpoint.toInfiniteQuery(() => ({
      enableOnDemand: true,
      initialPageParam: 0,
      getNextPageParam,
      params: { id: 1 },
      uniqKey: 'uniq',
    }));
    query.destroy();
  });
});
