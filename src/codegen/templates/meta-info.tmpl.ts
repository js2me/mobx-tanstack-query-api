import { Maybe } from 'yummies';

import { CodegenDataUtils, MetaInfo } from '../index.js';

import { LINTERS_IGNORE } from './constants.js';

export interface MetaInfoTmplParams {
  formatTSContent: (...args: any[]) => Promise<string>;
  metaInfo: Maybe<MetaInfo>;
  utils: CodegenDataUtils;
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
  utils,
  formatTSContent,
}: MetaInfoTmplParams) => {
  return await formatTSContent(`${LINTERS_IGNORE}
  ${[
    metaInfo?.namespace && `export const namespace = "${metaInfo?.namespace}";`,
    metaInfo?.groupNames?.length &&
      `
export const enum Group {
  ${metaInfo?.groupNames.map((groupName) => `${formatGroupNameEnumKey(groupName, utils)} = "${groupName}"`).join(',\n')}
}
`,
    metaInfo?.tags?.length &&
      `
export const enum Tag {
  ${metaInfo?.tags.map((tagName) => `${formatTagNameEnumKey(tagName, utils)} = "${tagName}"`).join(',\n')}
}
`,
  ]
    .filter(Boolean)
    .join('\n')}
    `);
};
