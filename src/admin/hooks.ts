import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "./api";

/**
 * Loads data whenever `deps` change; `reload` fetches again with the same inputs.
 * A response that arrives after a newer request started is dropped.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const d = await loadRef.current();
      if (id !== seq.current) return;
      setData(d);
      setError(null);
    } catch (err) {
      if (id !== seq.current) return;
      setError(errorText(err));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, deps);

  return { data, error, loading, reload: run };
}

/** `value`, updated only after it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}
