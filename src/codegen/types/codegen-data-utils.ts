import type { AnyObject } from 'yummies/types';

export type CodegenDataUtils = {
  Ts: any;
  _: AnyObject;
  getInlineParseContent: (requestParams: AnyObject) => string;
  formatModelName: (modelName: string) => string;
};
