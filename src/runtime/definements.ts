/**
 * Extension point for app-wide type narrowing (module augmentation).
 *
 * [**Documentation**](https://js2me.github.io/mobx-tanstack-query-api/definements/)
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmented by consumers via declare module
export interface Definements {}

export type PickDefinement<
  TKey extends string,
  TDefaultType,
> = Definements extends {
  [P in TKey]: infer TValue;
}
  ? TValue extends TDefaultType
    ? TValue
    : TDefaultType
  : TDefaultType;
