import type { CodegenDataUtils } from '../../types/index.js';

import { formatGroupNameEnumKey } from './format-group-name-enum-key.js';

export const formatTagNameEnumKey = (
  tagName: string,
  utils: CodegenDataUtils,
) => formatGroupNameEnumKey(tagName, utils);
