import type { Maybe } from 'yummies/utils/types';

type AnyFilterOptionFn = (...args: any[]) => boolean;

export type FilterOption<T extends AnyFilterOptionFn> =
  | T
  | string
  | RegExp
  | (RegExp | string)[];

export type UnpackedFilterOption<T extends FilterOption<any>> = Extract<
  T,
  AnyFilterOptionFn
>;

export const unpackFilterOption = <
  TOption extends FilterOption<AnyFilterOptionFn>,
>(
  option: Maybe<TOption>,
  argsToString: (...args: Parameters<UnpackedFilterOption<TOption>>) => string,
  defaultReturnValue: boolean = true,
): UnpackedFilterOption<TOption> => {
  if (typeof option === 'function') {
    // @ts-expect-error
    return option;
  }

  if (option == null) {
    // @ts-expect-error
    return () => defaultReturnValue;
  }

  const inputs = Array.isArray(option) ? option : [option];

  // @ts-expect-error
  return (...args: Parameters<UnpackedFilterOption<TOption>>) =>
    inputs.some((input) => {
      const str = argsToString(...args);

      if (typeof input === 'string') {
        return input === str;
      }

      return input.test(str);
    });
};
