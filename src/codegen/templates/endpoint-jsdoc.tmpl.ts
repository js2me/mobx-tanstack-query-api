import { splitTextByLines } from 'yummies/text';
import type { AnyObject } from 'yummies/utils/types';
import type { BaseTmplParams } from '../types/base-tmpl-params.js';

export interface EndpointJSDocTmplParams extends BaseTmplParams {
  route: AnyObject;
  offset?: number;
}

export const endpointJSDocTmpl = (params: EndpointJSDocTmplParams) => {
  const { route, configuration, offset = 0 } = params;
  const { routeName } = route;
  const rawRoute = route.raw as AnyObject;
  const routeRequest = route.request as AnyObject;

  const { utils } = configuration;

  const { _, formatDescription } = utils;

  const jsDocLines: { name?: string; content?: string }[] = [];

  if (rawRoute.summary) {
    const summaryLines = splitTextByLines(rawRoute.summary, 60)
      .filter(Boolean)
      .map((line) => ({
        content: `**${formatDescription(line, true)}**`,
      }));

    if (summaryLines.length > 0) {
      jsDocLines.push(...summaryLines, { content: '' });
    }
  }

  if (rawRoute.description) {
    const descriptionLines = splitTextByLines(rawRoute.description, 60)
      .filter(Boolean)
      .map((line) => ({
        content: formatDescription(line, true),
      }));

    if (descriptionLines.length > 0) {
      jsDocLines.push(...descriptionLines, { content: '' });
    } else {
      jsDocLines.push({
        content: 'No description',
      });
    }
  } else {
    jsDocLines.push({
      content: 'No description',
    });
  }

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
    jsDocLines.push({
      name: 'secure',
    });
  }

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
