import { useEffect, useState } from 'react';

/** Delays a fast-changing value (a search box) so it does not spam the API. */
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default useDebouncedValue;
