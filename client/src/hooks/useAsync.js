import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader and tracks { data, error, loading }.
 *
 * Guards against setting state after unmount and against a slow earlier
 * request overwriting a newer one (a real hazard on filter-as-you-type screens).
 */
export function useAsync(loader, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const mounted = useRef(true);
  const callId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args) => {
      callId.current += 1;
      const id = callId.current;
      setLoading(true);
      setError(null);
      try {
        const result = await loader(...args);
        if (mounted.current && id === callId.current) setData(result);
        return result;
      } catch (err) {
        if (mounted.current && id === callId.current) setError(err);
        throw err;
      } finally {
        if (mounted.current && id === callId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    if (!immediate) return;
    run().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, run, setData, reload: run };
}

export default useAsync;
