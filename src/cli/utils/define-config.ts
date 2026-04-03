import type { MaybeFalsy } from 'yummies/types';
import type { GenerateQueryApiParams } from '../../codegen/types/index.js';

export const defineConfig = (
  ...configs: MaybeFalsy<
    GenerateQueryApiParams | MaybeFalsy<GenerateQueryApiParams>[]
  >[]
): GenerateQueryApiParams[] => {
  return configs
    .flat()
    .filter((config): config is GenerateQueryApiParams => !!config);
};
