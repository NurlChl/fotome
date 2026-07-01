import { useState, useEffect } from 'react';

/**
 * Debounces a value by the given delay (ms).
 * Returns the debounced value which only updates after
 * the user stops changing it for `delay` milliseconds.
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
