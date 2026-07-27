import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_TTL,
  fetchCached,
  invalidate,
  isFresh,
  peek,
  setCached,
  subscribe,
} from '../lib/dataCache';

export type UseCachedQueryOptions<T> = {
  /** Freshness window in ms. Cached data newer than this is not re-fetched. */
  ttl?: number;
  /** Skip fetching entirely (e.g. modal data that loads on open). */
  enabled?: boolean;
  /** Re-fetch in the background when cached data is older than `ttl`. */
  revalidateOnMount?: boolean;
  /** Window events that should trigger a background refresh of this key. */
  refreshEvents?: string[];
  /** Called after every successful fetch. */
  onSuccess?: (data: T) => void;
};

export type UseCachedQueryResult<T> = {
  data: T | undefined;
  error: string | null;
  /** True while a request is in flight. */
  isFetching: boolean;
  /** True only when there is nothing to render yet — the skeleton condition. */
  isInitialLoading: boolean;
  /** True when refreshing on top of already-rendered data. */
  isRefreshing: boolean;
  hasData: boolean;
  /** Force a network refresh, keeping current data on screen. */
  refresh: () => Promise<T | undefined>;
  /** Overwrite the cached value locally (optimistic updates). */
  setData: (data: T) => void;
};

function toMessage(error: unknown): string {
  const anyError = error as any;
  return (
    anyError?.response?.data?.message ||
    anyError?.message ||
    (typeof error === 'string' ? error : 'Something went wrong')
  );
}

/**
 * Cache-first data hook.
 *
 * The important behaviour for navigation speed: when the key already holds data
 * the hook returns it synchronously on the first render, so `isInitialLoading`
 * is false and the page never flashes a skeleton. A background revalidation is
 * only issued when the cached entry is older than `ttl`.
 */
export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedQueryOptions<T> = {}
): UseCachedQueryResult<T> {
  const {
    ttl = DEFAULT_TTL,
    enabled = true,
    revalidateOnMount = true,
    refreshEvents,
    onSuccess,
  } = options;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const readEntry = useCallback(() => {
    const entry = peek<T>(key);
    return {
      data: entry?.data,
      isFetching: !!entry?.promise,
      error: entry?.error ? toMessage(entry.error) : null,
    };
  }, [key]);

  const [snapshot, setSnapshot] = useState(readEntry);

  // Keep the snapshot in sync with the shared cache.
  useEffect(() => {
    setSnapshot(readEntry());
    return subscribe(key, () => setSnapshot(readEntry()));
  }, [key, readEntry]);

  const run = useCallback(
    async (force: boolean) => {
      try {
        const result = await fetchCached<T>(key, () => fetcherRef.current(), { ttl, force });
        onSuccessRef.current?.(result);
        return result;
      } catch {
        // The error is stored on the cache entry and surfaced through `error`.
        return undefined;
      }
    },
    [key, ttl]
  );

  // Initial load / revalidation.
  useEffect(() => {
    if (!enabled) return;
    const entry = peek<T>(key);
    const hasValue = entry?.data !== undefined;
    if (!hasValue) {
      void run(false);
      return;
    }
    if (revalidateOnMount && !isFresh(key, ttl)) {
      void run(true);
    }
  }, [enabled, key, revalidateOnMount, run, ttl]);

  // Refresh on domain events (sale recorded, product changed, ...).
  useEffect(() => {
    if (!enabled || !refreshEvents?.length) return;

    const onEvent = () => {
      invalidate(key);
      void run(true);
    };

    for (const eventName of refreshEvents) {
      window.addEventListener(eventName, onEvent as EventListener);
    }
    return () => {
      for (const eventName of refreshEvents) {
        window.removeEventListener(eventName, onEvent as EventListener);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, run, JSON.stringify(refreshEvents)]);

  const refresh = useCallback(() => {
    invalidate(key);
    return run(true);
  }, [key, run]);

  const setData = useCallback((data: T) => setCached(key, data), [key]);

  const hasData = snapshot.data !== undefined;

  return {
    data: snapshot.data,
    error: snapshot.error,
    isFetching: snapshot.isFetching,
    isInitialLoading: !hasData && (snapshot.isFetching || (enabled && !snapshot.error)),
    isRefreshing: hasData && snapshot.isFetching,
    hasData,
    refresh,
    setData,
  };
}

export default useCachedQuery;
