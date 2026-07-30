import { useCallback, useState } from 'react';

/**
 * Boolean state with memoized on/off/toggle helpers.
 * @param {boolean} [initial=false]
 */
export function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const on = useCallback(() => setValue(true), []);
  const off = useCallback(() => setValue(false), []);
  const toggle = useCallback(() => setValue((v) => !v), []);
  return { value, on, off, toggle, setValue };
}
