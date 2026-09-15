import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Returns a callback whose *identity never changes* but which always calls
 * the latest version of `fn`.
 *
 * Why this exists: large tables (Scheduled Assessments, Daily Schedule)
 * render one memoised row component per appointment. If the handlers passed
 * into those rows are re-created on every parent render — which is what
 * happens with plain inline arrow functions — `React.memo` can never skip a
 * row, so a single keystroke in the search box or a comment box re-renders
 * every row, every Radix Select inside it, and every popover portal. That is
 * what makes those screens feel like they stutter while typing/scrolling.
 *
 * Wrapping the handler here gives rows a stable prop so only the rows whose
 * own data actually changed re-render.
 */
export function useEventCallback<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn
): (...args: TArgs) => TReturn {
  const ref = useRef(fn);

  // Layout effect (not effect) so the ref is current before any child event
  // handler can possibly fire in the same commit.
  useLayoutEffect(() => {
    ref.current = fn;
  });

  return useCallback((...args: TArgs) => ref.current(...args), []);
}

export default useEventCallback;
