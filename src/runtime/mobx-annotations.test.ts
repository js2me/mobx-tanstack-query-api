import { isComputedProp, isObservableProp, reaction, runInAction } from 'mobx';
import { describe, expect, it, vi } from 'vitest';
import * as annotation from 'yummies/mobx';
import {
  applyObservable,
  type ObservableAnnotationsArray,
} from 'yummies/mobx';

const annotations = [
  [annotation.observableRef, 'input'],
  [annotation.computedStruct, 'snapshot'],
] satisfies ObservableAnnotationsArray<any>;

describe('MobX annotation compatibility', () => {
  it('preserves ref observables and structural computed equality', () => {
    class Store {
      input: { value: number } = { value: 1 };

      constructor() {
        applyObservable(this, annotations);
      }

      get snapshot() {
        return { value: this.input.value };
      }
    }

    const store = new Store();
    const onSnapshotChange = vi.fn();
    const dispose = reaction(() => store.snapshot, onSnapshotChange);

    expect(isObservableProp(store, 'input')).toBe(true);
    expect(isComputedProp(store, 'snapshot')).toBe(true);
    expect(annotation.comparer.structural({ value: 1 }, { value: 1 })).toBe(
      true,
    );

    runInAction(() => {
      store.input = { value: 1 };
    });
    expect(onSnapshotChange).not.toHaveBeenCalled();

    runInAction(() => {
      store.input = { value: 2 };
    });
    expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    expect(onSnapshotChange).toHaveBeenCalledWith(
      { value: 2 },
      { value: 1 },
      expect.anything(),
    );

    dispose();
  });
});
