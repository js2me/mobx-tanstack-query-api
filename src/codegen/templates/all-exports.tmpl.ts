import type { Maybe } from 'yummies/utils/types';

import type { CodegenDataUtils, MetaInfo } from '../index.js';

import { LINTERS_IGNORE } from './constants.js';

export interface AllExportsTmplParams {
  formatTSContent: (...args: any[]) => Promise<string>;
  collectedExportFiles: string[];
  metaInfo: Maybe<MetaInfo>;
  utils: CodegenDataUtils;
}

export const formatGroupNameEnumKey = (
  groupName: string,
  { _ }: CodegenDataUtils,
) => _.upperFirst(_.camelCase(groupName));

export const allExportsTmpl = async ({
  collectedExportFiles,
  metaInfo,
  formatTSContent,
}: AllExportsTmplParams) => {
  return await formatTSContent(`${LINTERS_IGNORE}
  export * from './data-contracts';
  ${collectedExportFiles.map((fileName) => `export * from './${fileName}';`).join('\n')}
  ${metaInfo ? 'export * from "./meta-info";' : ''}
    `);
};
