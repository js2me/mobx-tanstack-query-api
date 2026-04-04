# `createMockHttpClientRequestHandler`

Builds the implementation function for **`vi.spyOn(httpClient, 'request').mockImplementation(...)`**: waits for optional `delay`, builds a mock **`HttpResponse`**, and applies your **`success`** or **`error`** payload (including default statuses). **`mockHttpClientRequest`** and **`mockHttpClientRequestOnce`** use this internally; call it directly only when you need a custom spy setup.

**Example:**

```ts
import { createMockHttpClientRequestHandler } from 'mobx-tanstack-query-api/testing';
import { vi } from 'vitest';

const handler = createMockHttpClientRequestHandler(httpClient, {
  success: { ok: true },
});
const spy = vi.spyOn(httpClient, 'request').mockImplementation(handler);
// …run code under test…
spy.mockRestore();
```
