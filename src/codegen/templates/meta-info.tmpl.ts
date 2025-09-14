import type { AnyObject, Maybe } from 'yummies/utils/types';

import type {
  CodegenDataUtils,
  GenerateQueryApiParams,
  MetaInfo,
} from '../index.js';

import { LINTERS_IGNORE } from './constants.js';

export interface MetaInfoTmplParams {
  formatTSContent: (...args: any[]) => Promise<string>;
  codegenParams: GenerateQueryApiParams;
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
  codegenParams,
  ...other
}: MetaInfoTmplParams) => {
  const tagsMap = new Map<string, AnyObject>(
    (other as any).configuration?.apiConfig?.tags?.map((it: AnyObject) => [
      it.name,
      it,
    ]),
  );

  return await formatTSContent(`${LINTERS_IGNORE}
  ${[
    metaInfo?.namespace && `export const namespace = "${metaInfo?.namespace}";`,
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
