import { splitTextByLines } from 'yummies/text';
import type { AnyObject } from 'yummies/types';
import type { BaseTmplParams } from '../types/base-tmpl-params.js';

export interface EndpointJSDocTmplParams extends BaseTmplParams {
  route: AnyObject;
  offset?: number;
}

function getResponseContentTypes(raw: AnyObject): string[] {
  const out: string[] = [];
  if (Array.isArray(raw.produces)) out.push(...raw.produces);
  const status =
    raw.responses &&
    Object.keys(raw.responses).find((s) => {
      const code = Number.parseInt(s, 10);
      return code >= 200 && code < 300;
    });
  const content = status && raw.responses[status]?.content;
  if (content && typeof content === 'object') out.push(...Object.keys(content));
  return [...new Set(out)];
}

function getRequestContentTypes(raw: AnyObject): string[] {
  const out: string[] = [];
  if (Array.isArray(raw.consumes)) out.push(...raw.consumes);
  const body = raw.requestBody?.content;
  if (body && typeof body === 'object') out.push(...Object.keys(body));
  return [...new Set(out)];
}
type JSDocLine = { name?: string; content?: string };

function getSecuritySchemeNames(security: unknown): string[] {
  if (!Array.isArray(security)) return [];
  return security
    .flatMap((s: AnyObject) =>
      typeof s === 'object' && s !== null ? Object.keys(s) : [],
    )
    .filter(Boolean);
}

function getExternalDocsLine(
  externalDocs: unknown,
  formatDescription: (s: string, b: boolean) => string,
): JSDocLine | null {
  if (
    !externalDocs ||
    typeof externalDocs !== 'object' ||
    !('url' in externalDocs)
  )
    return null;
  const url = (externalDocs as AnyObject).url;
  if (!url) return null;
  const desc = (externalDocs as AnyObject).description;
  const extDesc = desc
    ? ` ${formatDescription(String(desc).slice(0, 60), true)}`
    : '';
  return { name: 'see', content: `${url}${extDesc}`.trim() };
}

function getSummaryAndDescriptionLines(
  rawRoute: AnyObject,
  formatDescription: (s: string, b: boolean) => string,
): JSDocLine[] {
  const out: JSDocLine[] = [];
  if (rawRoute.summary) {
    const summaryLines = splitTextByLines(rawRoute.summary, 60)
      .filter(Boolean)
      .map((line) => ({ content: `**${formatDescription(line, true)}**` }));
    if (summaryLines.length > 0) out.push(...summaryLines, { content: '' });
  }
  if (rawRoute.description) {
    const descriptionLines = splitTextByLines(rawRoute.description, 60)
      .filter(Boolean)
      .map((line) => ({ content: formatDescription(line, true) }));
    if (descriptionLines.length > 0)
      out.push(...descriptionLines, { content: '' });
  } else if (!rawRoute.summary) {
    out.push({ content: 'No description' });
  }
  return out;
}

export const endpointJSDocTmpl = (params: EndpointJSDocTmplParams) => {
  const { route, configuration, offset = 0 } = params;
  const { routeName } = route;
  const rawRoute = route.raw as AnyObject;
  const routeRequest = route.request as AnyObject;
  const path = routeRequest?.path as string | undefined;
  const method = routeRequest?.method as string | undefined;

  const { utils } = configuration;

  const { _, formatDescription } = utils;

  const schema =
    (configuration as AnyObject).config?.swaggerSchema ??
    (configuration as AnyObject).swaggerSchema;
  const pathKey = path?.startsWith('/') ? path : `/${path || ''}`;
  const methodKey = method?.toLowerCase?.() ?? method;
  const schemaOp =
    pathKey && methodKey ? schema?.paths?.[pathKey]?.[methodKey] : null;
  const rawWithSpec =
    schemaOp && typeof schemaOp === 'object'
      ? { ...schemaOp, ...rawRoute }
      : rawRoute;

  const jsDocLines: JSDocLine[] = [];
  jsDocLines.push(
    ...getSummaryAndDescriptionLines(rawRoute, formatDescription),
  );

  if (rawRoute.operationId) {
    jsDocLines.push({
      name: 'operationId',
      content: rawRoute.operationId,
    });
  }

  if (_.size(rawRoute.tags)) {
    jsDocLines.push({
      name: 'tags',
      content: rawRoute.tags.join(', '),
    });
  }

  jsDocLines.push({
    name: 'request',
    content: `**${_.upperCase(routeRequest.method)}:${rawRoute.route}**`,
  });

  const responseTypes = getResponseContentTypes(rawWithSpec);
  if (responseTypes.length > 0) {
    jsDocLines.push({
      name: 'produces',
      content: responseTypes.join(', '),
    });
  }

  const requestTypes = getRequestContentTypes(rawWithSpec);
  if (requestTypes.length > 0) {
    jsDocLines.push({
      name: 'consumes',
      content: requestTypes.join(', '),
    });
  }

  if (rawRoute.deprecated) {
    jsDocLines.push({
      name: 'deprecated',
    });
  }

  if (routeName.duplicate) {
    jsDocLines.push(
      {
        name: 'duplicate',
      },
      {
        name: 'originalName',
        content: routeName.original,
      },
    );
  }

  if (routeRequest.security) {
    jsDocLines.push({ name: 'secure' });
    const schemeNames = getSecuritySchemeNames(rawWithSpec.security);
    if (schemeNames.length > 0) {
      jsDocLines.push({ name: 'security', content: schemeNames.join(', ') });
    }
  }

  const externalDocsLine = getExternalDocsLine(
    rawWithSpec.externalDocs,
    formatDescription,
  );
  if (externalDocsLine) jsDocLines.push(externalDocsLine);

  if (rawRoute.responsesTypes.length > 0) {
    jsDocLines.push({
      name: 'responses',
    });

    rawRoute.responsesTypes.forEach((response: AnyObject) => {
      jsDocLines.push({
        name: `**${response.status}**`,
        content: `${_.replace(_.replace(response.type, /\/\*/g, String.raw`\*`), /\*\//g, '*\\')} ${response.description}`,
      });
    });
  }

  const jsdocContent = jsDocLines.map((it) => {
    let line: string = ' * ';

    if (it.name) {
      line += `@${it.name} `;
    }

    const content = (it.content ?? '').trimEnd();

    if (content) {
      line += content;
    }

    return line;
  });

  const result = `
/**
${jsdocContent.join('\n')}
 */`;

  if (offset > 0) {
    return result
      .split('\n')
      .map((line) => line.padStart(offset))
      .join('\n');
  }

  return result;
};
