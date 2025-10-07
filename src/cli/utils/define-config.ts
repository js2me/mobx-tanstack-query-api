import type { Maybe } from 'yummies/utils/types';
import type { GenerateQueryApiParams } from '../../codegen/types/index.js';

export const defineConfig = (
  ...configs: Maybe<GenerateQueryApiParams | GenerateQueryApiParams[]>[]
): GenerateQueryApiParams[] => {
  return configs
    .flat()
    .filter((config): config is GenerateQueryApiParams => !!config);
};
