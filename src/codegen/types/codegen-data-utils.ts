import type { LoDashStatic } from 'lodash';
import type { AnyObject } from 'yummies/types';

export type CodegenDataUtils = {
  _: LoDashStatic;
  getInlineParseContent: (requestParams: AnyObject) => string;
  formatModelName: (modelName: string) => string;
};
