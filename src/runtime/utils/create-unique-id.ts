import { createCounter } from 'yummies/complex';

const instancePrefix = Math.random().toString(36).slice(2, 10);

export const createUniqueId = createCounter(
  (counter) => `${instancePrefix}-${counter}`,
);
