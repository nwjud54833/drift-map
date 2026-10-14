"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` after it has stopped changing for `delay` milliseconds.
 *
 * Used to keep expensive diff recomputation off the keystroke path: the editor
 * shows parse errors immediately from its own state, while the contract and
 * drift panes recompute from the debounced value.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delay <= 0) { setDebounced(value); return; }
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
