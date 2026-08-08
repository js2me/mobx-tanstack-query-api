import { bench, describe } from 'vitest';
import { createTestEndpoint } from '../testing/vitest-test-helpers.js';
import { EndpointQueryClient } from './endpoint-query-client.js';

const createEndpoint = () => {
  const queryClient = new EndpointQueryClient();
  return createTestEndpoint({ queryClient }).endpoint;
};

describe('EndpointMutation', () => {
  bench('endpoint.toMutation and destroy', () => {
    const endpoint = createEndpoint();
    const mutation = endpoint.toMutation({});
    mutation.destroy();
  });

  bench('endpoint.toMutation with invalidateEndpoints', () => {
    const endpoint = createEndpoint();
    const mutation = endpoint.toMutation({
      invalidateEndpoints: 'by-tag',
    });
    mutation.destroy();
  });

  bench('endpoint.toMutation with transform', () => {
    const endpoint = createEndpoint();
    const mutation = endpoint.toMutation({
      transform: (response) => response.data,
    });
    mutation.destroy();
  });
});
