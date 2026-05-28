import type { AnyObject, Maybe } from 'yummies/types';
import type { BaseTmplParams, MetaInfo } from '../types/index.js';

import { LINTERS_IGNORE } from './constants.js';
import { formatGroupNameEnumKey } from './utils/format-group-name-enum-key.js';
import { formatTagNameEnumKey } from './utils/format-tag-name-enum-key.js';
import { renderStyledStringEnumDeclaration } from './utils/render-styled-string-enum.js';

export interface MetaInfoTmplParams extends BaseTmplParams {
  metaInfo: Maybe<MetaInfo>;
}

export const metaInfoTmpl = async ({
  metaInfo,
  swaggerSchema,
  utils,
  formatTSContent,
  codegenParams,
  ...other
}: MetaInfoTmplParams) => {
  const tagsMap = new Map<string, AnyObject>(
    (other as any).configuration?.apiConfig?.tags?.map((it: AnyObject) => [
      it.name,
      it,
    ]),
  );
  const apiServers = Array.isArray(swaggerSchema?.servers)
    ? swaggerSchema.servers
        .map((server: AnyObject) => {
          if (typeof server?.url !== 'string' || server.url.length === 0) {
            return null;
          }

          const variables = Object.fromEntries(
            Object.entries(server.variables ?? {})
              .map(([key, value]) => [key, (value as AnyObject)?.default])
              .filter(([_, defaultValue]) => defaultValue != null),
          );

          return {
            description:
              typeof server.description === 'string' &&
              server.description.length > 0
                ? server.description
                : null,
            data: {
              url: server.url,
              ...(Object.keys(variables).length > 0 ? { variables } : {}),
            },
          };
        })
        .filter(Boolean)
    : [];

  return await formatTSContent(`${LINTERS_IGNORE}
  ${[
    metaInfo?.namespace && `export const namespace = "${metaInfo?.namespace}";`,
    apiServers.length > 0 &&
      `
export const apiServers = [
  ${apiServers
    .map((server) =>
      [
        server?.description && `/** ${server.description} */`,
        JSON.stringify(server?.data),
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join(',\n  ')}
];
`,
    metaInfo?.groupNames?.length &&
      `
${renderStyledStringEnumDeclaration(
  'Group',
  (() => {
    const seenKeys = new Set<string>();
    return metaInfo.groupNames
      .map((groupName) => ({
        key: formatGroupNameEnumKey(groupName, utils),
        value:
          codegenParams.transforms?.groupEnumValue?.(groupName) ?? groupName,
      }))
      .filter((member) => {
        if (seenKeys.has(member.key)) {
          return false;
        }
        seenKeys.add(member.key);
        return true;
      });
  })(),
  codegenParams.enumStyle,
)}
`,
    metaInfo?.tags?.length &&
      `
${renderStyledStringEnumDeclaration(
  'Tag',
  (() => {
    const seenKeys = new Set<string>();
    return metaInfo.tags
      .map((tagName) => {
        const tagData = tagsMap.get(tagName);

        let description = tagData?.description;

        if (!description) {
          description = utils._.words(tagName).join(' ');
        }

        return {
          key: formatTagNameEnumKey(tagName, utils),
          value: codegenParams.transforms?.tagEnumValue?.(tagName) ?? tagName,
          description,
        };
      })
      .filter((member) => {
        if (seenKeys.has(member.key)) {
          return false;
        }
        seenKeys.add(member.key);
        return true;
      });
  })(),
  codegenParams.enumStyle,
)}
`,
  ]
    .filter(Boolean)
    .join('\n')}
    `);
};
