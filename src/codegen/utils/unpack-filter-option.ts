import type { Maybe } from 'yummies/utils/types';

export type FilterOption<T extends (...args: any[]) => boolean> =
  | T
  | string
  | RegExp
  | (RegExp | string)[];

export const unpackFilterOption = <TArgs extends any[]>(
  option: Maybe<FilterOption<(...args: TArgs) => boolean>>,
  argsToString: (...args: TArgs) => string,
  defaultReturnValue: boolean = true,
): ((...args: TArgs) => boolean) => {
  if (typeof option === 'function') {
    return option;
  }

  if (option == null) {
    return () => defaultReturnValue;
  }

  const inputs = Array.isArray(option) ? option : [option];

  return (...args: TArgs) =>
    inputs.some((input) => {
      const str = argsToString(...args);

      if (typeof input === 'string') {
        return input === str;
      }

      return input.test(str);
    });
};
