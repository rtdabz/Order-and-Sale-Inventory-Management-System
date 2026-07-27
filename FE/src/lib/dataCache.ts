/**
 * Lightweight module-scope data cache with stale-while-revalidate semantics.
 *
 * Why module scope instead of React state?
 * ----------------------------------------
 * React state is destroyed whenever a route unmounts, which is exactly what
 * caused every page to re-fetch (and therefore re-show its skeleton) on each
 * navigation. Keeping the store outside of the React tree means data survives
 * route changes for the whole browser session, so navigating back to a page
 * renders instantly from cache.
 *
 * Usage:
 *   const data = await fetchCached('products', () => api.get('/products'))
 *   invalidate('products')            // drop a single key
 *   invalidatePrefix('orders')        // drop every key starting with "orders"
 *   clearCache()                      // full reset (used on logout)
 */

export type CacheEntry<T = unknown> = {
  data: T | undefined;
  /** epoch ms of the last successful fetch */
  fetchedAt: number;
  /** in-flight request, used to de-duplicate concurrent callers */
  promise?: Promise<T>;
  error?: unknown;
};

type Listener = () => void;

/** Default freshness window. Within this window we do not re-fetch at all. */
export const DEFAULT_TTL = 60_000; // 1 minute

const store = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<Listener>>();

function notify(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  // Copy before iterating: a listener may unsubscribe during notification.
  for (const listener of Array.from(set)) {
    try {
      listener();
    } catch (e) {
      console.warn('[dataCache] listener failed for key', key, e);
    }
  }
}

export function subscribe(key: string, listener: Listener): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    const current = listeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(key);
  };
}

export function peek<T>(key: string): CacheEntry<T> | undefined {
  return store.get(key) as CacheEntry<T> | undefined;
}

export function getCached<T>(key: string): T | undefined {
  return store.get(key)?.data as T | undefined;
}

export function hasCached(key: string): boolean {
  const entry = store.get(key);
  return !!entry && entry.data !== undefined;
}

export function isFresh(key: string, ttl: number = DEFAULT_TTL): boolean {
  const entry = store.get(key);
  if (!entry || entry.data === undefined) return false;
  return Date.now() - entry.fetchedAt < ttl;
}

/** Write a value into the cache directly (optimistic updates, seeding, etc.). */
export function setCached<T>(key: string, data: T): void {
  const existing = store.get(key);
  store.set(key, {
    ...existing,
    data,
    fetchedAt: Date.now(),
    error: undefined,
    promise: undefined,
  });
  notify(key);
}

/**
 * Update a cached value from its previous value. No-op when nothing is cached,
 * which keeps callers from accidentally seeding partial data.
 */
export function mutateCached<T>(key: string, updater: (previous: T) => T): void {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry || entry.data === undefined) return;
  setCached(key, updater(entry.data));
}

export function invalidate(...keys: string[]): void {
  for (const key of keys) {
    const entry = store.get(key);
    if (!entry) continue;
    // Keep the data so the UI can keep rendering it while revalidating, but
    // mark it as stale by resetting the timestamp.
    store.set(key, { ...entry, fetchedAt: 0, promise: undefined });
    notify(key);
  }
}

export function invalidatePrefix(prefix: string): void {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) invalidate(key);
  }
}

export function removeCached(...keys: string[]): void {
  for (const key of keys) {
    store.delete(key);
    notify(key);
  }
}

export function clearCache(): void {
  const keys = Array.from(store.keys());
  store.clear();
  for (const key of keys) notify(key);
}

export type FetchCachedOptions = {
  /** Freshness window in ms. Cached data newer than this is returned as-is. */
  ttl?: number;
  /** Ignore freshness and always hit the network. */
  force?: boolean;
};

/**
 * Resolve a key from cache when fresh, otherwise fetch it. Concurrent calls for
 * the same key share a single request.
 */
export function fetchCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: FetchCachedOptions = {}
): Promise<T> {
  const { ttl = DEFAULT_TTL, force = false } = options;
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (!force && entry?.data !== undefined && Date.now() - entry.fetchedAt < ttl) {
    return Promise.resolve(entry.data as T);
  }

  if (entry?.promise) return entry.promise as Promise<T>;

  const promise = fetcher()
    .then((data) => {
      const current = store.get(key);
      store.set(key, {
        ...current,
        data,
        fetchedAt: Date.now(),
        error: undefined,
        promise: undefined,
      });
      notify(key);
      return data;
    })
    .catch((error) => {
      const current = store.get(key);
      store.set(key, {
        ...current,
        data: current?.data,
        fetchedAt: current?.data !== undefined ? current.fetchedAt : 0,
        error,
        promise: undefined,
      });
      notify(key);
      throw error;
    });

  store.set(key, {
    ...(entry ?? { data: undefined, fetchedAt: 0 }),
    promise: promise as Promise<unknown>,
  });
  notify(key);

  return promise;
}

/** Canonical cache keys so pages and the bootstrap prefetch stay in sync. */
export const CacheKeys = {
  products: 'products',
  archivedProducts: 'products:archived',
  bestSellers: 'products:best-sellers',
  inventories: 'inventories',
  categories: 'categories',
  orders: 'orders',
  completedOrders: 'orders:completed',
  damages: 'damages',
  damageSummary: 'damages:summary',
  monthlySales: (year: number) => `sales:monthly:${year}`,
  monthlySalesDetails: (year: number) => `sales:monthly-details:${year}`,
} as const;
