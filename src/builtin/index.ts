import { HttpClient } from '../runtime/http-client.js';

export { queryClient } from 'mobx-tanstack-query/preset';

export const http = new HttpClient({});
