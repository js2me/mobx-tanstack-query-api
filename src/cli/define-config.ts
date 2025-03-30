import { Maybe } from 'yummies/utils/types';

import { GenerateApiParams } from '../codegen/index.js';

export const defineConfig = (
  ...configs: Maybe<GenerateApiParams | GenerateApiParams[]>[]
): GenerateApiParams[] => {
  return configs
    .flat()
    .filter((config): config is GenerateApiParams => !!config);
};
