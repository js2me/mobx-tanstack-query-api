import type { AnyObject, Maybe } from 'yummies/types';

export function tmplDataToSourceExpr(
  tmplData: Maybe<string | AnyObject>,
): string {
  return typeof tmplData === 'string'
    ? tmplData
    : JSON.stringify(tmplData || {});
}
