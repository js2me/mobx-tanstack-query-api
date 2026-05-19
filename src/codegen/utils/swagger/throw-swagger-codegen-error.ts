import type { AnyObject } from 'yummies/types';

const INVALID_SWAGGER_INPUT_MARKERS = [
  'error while fetching data from URL',
  'Unsupported swagger/OpenAPI version',
  'S2OError',
  "Cannot create property 'info' on string",
] as const;

export const collectErrorText = (error: unknown): string => {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current != null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(current.name, current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }

  return parts.join(' ');
};

export const isInvalidSwaggerInputError = (error: unknown): boolean => {
  const text = collectErrorText(error);
  return INVALID_SWAGGER_INPUT_MARKERS.some((marker) => text.includes(marker));
};

const FRIENDLY_LOAD_ERROR_PREFIX =
  '⛔ failed to load swagger schema based on input';

export const throwSwaggerCodegenError = (
  error: unknown,
  input: AnyObject,
): never => {
  if (
    error instanceof Error &&
    error.message.startsWith(FRIENDLY_LOAD_ERROR_PREFIX)
  ) {
    throw error;
  }

  const inputLabel =
    'spec' in input ? '<API Spec>' : String(input.input ?? input.url ?? '');

  const cause =
    error instanceof Error ? error : new Error(String(error), { cause: error });

  if (isInvalidSwaggerInputError(error)) {
    throw new Error(
      `⛔ failed to load swagger schema based on input ${inputLabel}`,
      { cause },
    );
  }

  throw new Error('⛔ failed to generate swagger schema', { cause });
};
