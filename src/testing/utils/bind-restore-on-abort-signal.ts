/**
 * When **`signal`** aborts (or is already aborted), invokes **`restore`** once.
 * Used by capture helpers so Vitest test **`signal`** cleans up spies on cancellation.
 */
export function bindRestoreOnAbortSignal(
  signal: AbortSignal | undefined,
  restore: () => void,
): void {
  if (!signal) return;
  if (signal.aborted) {
    restore();
    return;
  }
  signal.addEventListener('abort', restore, { once: true });
}
