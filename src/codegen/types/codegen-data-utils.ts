import type { LoDashStatic } from 'lodash';
import type { AnyObject } from 'yummies/utils/types';

export type CodegenDataUtils = {
  _: LoDashStatic;
  getInlineParseContent: (requestParams: AnyObject) => string;
  formatModelName: (modelName: string) => string;
};
