import type { LoDashStatic } from 'lodash';
import type { AnyObject } from 'yummies/types';

export type CodegenDataUtils = {
  Ts: any;
  _: LoDashStatic;
  getInlineParseContent: (requestParams: AnyObject) => string;
  formatModelName: (modelName: string) => string;
};
