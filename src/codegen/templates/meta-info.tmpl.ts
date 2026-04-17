import type { AnyObject, Maybe } from 'yummies/types';
import type {
  BaseTmplParams,
  CodegenDataUtils,
  MetaInfo,
} from '../types/index.js';

import { LINTERS_IGNORE } from './constants.js';

export interface MetaInfoTmplParams extends BaseTmplParams {
  metaInfo: Maybe<MetaInfo>;
}

export const formatGroupNameEnumKey = (
  groupName: string,
  { _ }: CodegenDataUtils,
) => _.upperFirst(_.camelCase(groupName));

export const formatTagNameEnumKey = (
  tagName: string,
  utils: CodegenDataUtils,
) => formatGroupNameEnumKey(tagName, utils);

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
export const enum Group {
  ${metaInfo?.groupNames.map((groupName) => `${formatGroupNameEnumKey(groupName, utils)} = "${codegenParams.transforms?.groupEnumValue?.(groupName) ?? groupName}"`).join(',\n')}
}
`,
    metaInfo?.tags?.length &&
      `
export const enum Tag {
  ${metaInfo?.tags
    .map((tagName) => {
      const tagData = tagsMap.get(tagName);

      let description = tagData?.description;

      if (!description) {
        description = utils._.words(tagName).join(' ');
      }

      return [
        description && `/** ${description} */`,
        `${formatTagNameEnumKey(tagName, utils)} = "${codegenParams.transforms?.tagEnumValue?.(tagName) ?? tagName}"`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join(',\n')}
}
`,
  ]
    .filter(Boolean)
    .join('\n')}
    `);
};
