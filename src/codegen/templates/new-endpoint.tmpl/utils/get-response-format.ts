import type { AnyObject } from 'yummies/types';

// RequestParams["format"]
const responseContentKind: AnyObject = {
  TEXT: '"text"',
  IMAGE: '"blob"',
  JSON: '"json"',
  FORM_DATA: '"formData"',
  BYTES: '"bytes"',
};

/** Infer response format from raw OpenAPI operation (produces or responses content) when contentKind is not set */
function inferResponseFormatFromRaw(raw: AnyObject): string | null {
  const contentTypes: string[] = [];
  if (Array.isArray(raw.produces)) {
    contentTypes.push(...raw.produces);
  }
  const successStatus =
    raw.responses &&
    Object.keys(raw.responses).find((s) => {
      const code = Number.parseInt(s, 10);
      return code >= 200 && code < 300;
    });
  const content = successStatus && raw.responses[successStatus]?.content;
  if (content && typeof content === 'object') {
    contentTypes.push(...Object.keys(content));
  }
  if (contentTypes.length === 0) return null;

  const mimeToFormat = (mime: string): string | null => {
    if (mime.includes('application/json') || mime.includes('+json'))
      return '"json"';
    if (mime.startsWith('text/')) return '"text"';
    if (mime.includes('form-data') || mime.includes('multipart'))
      return '"formData"';
    // binary: blob() in Fetch API — IANA binary types: application/*, image/*, audio/*, video/*, font/*, model/*, message/*, haptics/*
    if (
      mime.includes('octet-stream') ||
      mime.includes('spreadsheet') ||
      mime.includes('vnd.') ||
      mime.startsWith('application/') ||
      mime.startsWith('image/') ||
      mime.startsWith('audio/') ||
      mime.startsWith('video/') ||
      mime.startsWith('font/') ||
      mime.startsWith('model/') ||
      mime.startsWith('message/') ||
      mime.startsWith('haptics/')
    )
      return '"blob"';
    return null;
  };

  // Prefer json for typed responses, then first recognized format
  const preferredOrder = ['"json"', '"text"', '"formData"', '"blob"'] as const;
  for (const fmt of preferredOrder) {
    const found = contentTypes.map(mimeToFormat).find((f) => f === fmt);
    if (found) return found;
  }
  return null;
}

/** Resolve response format from contentKind, then from raw operation (produces / responses content) */
export function getResponseFormat(
  responseBodyInfo: AnyObject,
  raw: AnyObject,
  configuration: AnyObject,
  path: string,
  method: string,
): string | null {
  const fromContentKind =
    responseContentKind[responseBodyInfo.success?.schema?.contentKind];
  if (fromContentKind) return fromContentKind;
  const swaggerSchema =
    configuration.config?.swaggerSchema ?? configuration.swaggerSchema;
  const schemaPaths = swaggerSchema?.paths;
  const pathKey = path?.startsWith('/') ? path : `/${path || ''}`;
  const methodKey = method?.toLowerCase?.() ?? method;
  const schemaOperation =
    pathKey && methodKey ? schemaPaths?.[pathKey]?.[methodKey] : null;
  const rawWithProduces =
    schemaOperation && typeof schemaOperation === 'object'
      ? { ...schemaOperation, ...raw }
      : raw;
  return inferResponseFormatFromRaw(rawWithProduces);
}
