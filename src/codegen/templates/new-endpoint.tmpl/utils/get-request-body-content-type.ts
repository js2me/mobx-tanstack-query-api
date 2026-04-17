import type { AnyObject } from 'yummies/types';

// RequestParams["type"]
const requestContentKind: AnyObject = {
  URL_ENCODED: '"application/x-www-form-urlencoded"',
  FORM_DATA: '"multipart/form-data"',
  TEXT: '"text/plain"',
  JSON: '"application/json"',
  BINARY: '"application/octet-stream"',
};

/** Infer request body contentType from raw OpenAPI operation (consumes or requestBody.content) */
function inferRequestBodyContentTypeFromRaw(raw: AnyObject): string | null {
  const contentTypes: string[] = [];
  if (Array.isArray(raw.consumes)) {
    contentTypes.push(...raw.consumes);
  }
  const requestBody = raw.requestBody;
  if (requestBody?.content && typeof requestBody.content === 'object') {
    contentTypes.push(...Object.keys(requestBody.content));
  }
  if (contentTypes.length === 0) return null;

  const mimeToContentType = (mime: string): string | null => {
    if (mime.includes('application/json') || mime.includes('+json'))
      return '"application/json"';
    if (mime.includes('application/x-www-form-urlencoded'))
      return '"application/x-www-form-urlencoded"';
    if (mime.includes('multipart/form-data') || mime.includes('multipart/'))
      return '"multipart/form-data"';
    if (mime.startsWith('text/')) return '"text/plain"';
    if (
      mime.includes('octet-stream') ||
      mime.startsWith('application/') ||
      mime.startsWith('image/') ||
      mime.startsWith('audio/') ||
      mime.startsWith('video/') ||
      mime.startsWith('font/') ||
      mime.startsWith('model/') ||
      mime.includes('vnd.')
    )
      return '"application/octet-stream"';
    return null;
  };

  const preferredOrder = [
    '"application/json"',
    '"application/x-www-form-urlencoded"',
    '"multipart/form-data"',
    '"text/plain"',
    '"application/octet-stream"',
  ] as const;
  for (const ct of preferredOrder) {
    const found = contentTypes.map(mimeToContentType).find((c) => c === ct);
    if (found) return found;
  }
  return null;
}

/** Resolve request body contentType from contentKind, then from raw (consumes / requestBody.content) */
export function getRequestBodyContentType(
  requestBodyInfo: AnyObject,
  raw: AnyObject,
  configuration: AnyObject,
  path: string,
  method: string,
): string | null {
  const fromContentKind = requestContentKind[requestBodyInfo?.contentKind];
  if (fromContentKind) return fromContentKind;
  const swaggerSchema =
    configuration.config?.swaggerSchema ?? configuration.swaggerSchema;
  const schemaPaths = swaggerSchema?.paths;
  const pathKey = path?.startsWith('/') ? path : `/${path || ''}`;
  const methodKey = method?.toLowerCase?.() ?? method;
  const schemaOperation =
    pathKey && methodKey ? schemaPaths?.[pathKey]?.[methodKey] : null;
  const rawWithConsumes =
    schemaOperation && typeof schemaOperation === 'object'
      ? { ...schemaOperation, ...raw }
      : raw;
  return inferRequestBodyContentTypeFromRaw(rawWithConsumes);
}
