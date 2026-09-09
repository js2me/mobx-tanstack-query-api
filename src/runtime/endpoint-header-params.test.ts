import { describe, expectTypeOf, it } from 'vitest';
import type { Endpoint } from './endpoint.js';
import type { EndpointMutationParams } from './endpoint-mutation.types.js';
import type { HttpResponse } from './http-response.js';

type HeaderParams = {
  headers: Record<string, any> & {
    'X-Request-Id': string;
  };
};

type HeaderEndpoint = Endpoint<HttpResponse<{ ok: true }, never>, HeaderParams>;

type MutationInput = EndpointMutationParams<HeaderParams>;

describe('Endpoint header params', () => {
  it('keeps arbitrary headers in toMutation payload types', () => {
    expectTypeOf<HeaderEndpoint['toMutation']>().toBeFunction();
    expectTypeOf<MutationInput>().toMatchTypeOf<HeaderParams>();

    const input: MutationInput = {
      headers: {
        'X-Request-Id': 'request-123',
        'X-Debug': 'true',
      },
    };

    expectTypeOf(input).toMatchTypeOf<HeaderParams>();
  });
});
