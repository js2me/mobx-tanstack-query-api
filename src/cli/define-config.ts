import { Maybe } from 'yummies/utils/types';

import { GenerateQueryApiParams } from '../codegen/index.js';

export const defineConfig = (
  ...configs: Maybe<GenerateQueryApiParams | GenerateQueryApiParams[]>[]
): GenerateQueryApiParams[] => {
  return configs
    .flat()
    .filter((config): config is GenerateQueryApiParams => !!config);
};
