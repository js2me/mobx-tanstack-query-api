/**
 * Matches swagger-typescript-api `responsesTypes` entries that represent a successful HTTP response.
 */
export function isSuccessHttpResponseStatus(response: {
  status?: unknown;
  isSuccess?: boolean;
}): boolean {
  if (!response.isSuccess) return false;
  const code = +String(response.status);
  return code >= 200 && code < 300;
}
