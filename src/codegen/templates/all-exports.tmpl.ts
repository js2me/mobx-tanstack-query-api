import { Maybe } from 'yummies';

import { CodegenDataUtils } from '../index.js';

import { LINTERS_IGNORE } from './constants.js';

export interface AllExportsTmplParams {
  formatTSContent: (...args: any[]) => Promise<string>;
  collectedExportFiles: string[];
  groupNames?: string[];
  namespace?: Maybe<string>;
  utils: CodegenDataUtils;
}

export const formatGroupNameEnumKey = (
  groupName: string,
  { _ }: CodegenDataUtils,
) => _.upperFirst(_.camelCase(groupName));

export const allExportsTmpl = async ({
  collectedExportFiles,
  groupNames,
  namespace,
  utils,
  formatTSContent,
}: AllExportsTmplParams) => {
  return await formatTSContent(`${LINTERS_IGNORE}
  export * from './data-contracts';
  ${collectedExportFiles.map((fileName) => `export * from './${fileName}';`).join('\n')}

  ${namespace ? `export const namespace = "${namespace}"` : ''}
  ${
    groupNames?.length
      ? `
export const enum Group {
  ${groupNames.map((groupName) => `${formatGroupNameEnumKey(groupName, utils)} = "${groupName}"`).join(',\n')}
}
    `
      : ''
  }
    `);
};
