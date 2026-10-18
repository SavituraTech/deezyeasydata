"use client";

import * as React from "react";
import { clientFetch, ApiError } from "@/lib/api";

interface UseFetchResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

export function useFetch<T>(
  path: string,
  depsOrOpts: unknown[] | { deps?: unknown[]; enabled?: boolean } = {}
): UseFetchResult<T> {
  const isLegacyArray = Array.isArray(depsOrOpts);
  const opts = (isLegacyArray ? { deps: depsOrOpts } : depsOrOpts) as { deps?: unknown[]; enabled?: boolean };
  const deps = opts.deps ?? [];
  const enabled = opts.enabled ?? true;

  const [state, setState] = React.useState<{
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({ data: null, error: null, loading: !!enabled });

  const [tick, setTick] = React.useState(0);

  const refetch = React.useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    setTick((t) => t + 1);
  }, []);

  // Stable deps via JSON stringify for primitives; caller should memoize objects.
  const depsKey = React.useMemo(() => {
    try {
      return JSON.stringify(deps);
    } catch {
      return String(deps.length);
    }
  }, [deps]);

  React.useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    let cancelled = false;
    const controller = new AbortController();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    clientFetch<T>(path, { signal: controller.signal })
      .then((res) => {
        if (!cancelled) {
          setState({ data: res, error: null, loading: false });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setState({
          data: null,
          error: e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load",
          loading: false,
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, enabled, depsKey]);

  return { ...state, refetch };
}

// Back-compat wrapper for legacy callers passing deps as second arg array
export function useFetchLegacy<T>(path: string, deps: unknown[] = []): UseFetchResult<T> {
  return useFetch<T>(path, { deps });
}
