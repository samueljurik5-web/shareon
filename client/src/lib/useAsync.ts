import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';

/** Minimal data-fetching hook with loading / error / reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await run());
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Nastala chyba.'));
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
