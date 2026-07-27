import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  fetchCategories,
  fetchCompletedOrders,
  fetchInventories,
  fetchOrders,
  fetchProducts,
  invalidateOrderData,
  invalidateProductData,
} from '../lib/apiResources';
import { clearCache } from '../lib/dataCache';

/**
 * Tracks the one-and-only "initial data load" that happens right after login.
 *
 * The flag lives at module scope on purpose: React state would reset whenever
 * the provider unmounts (e.g. logging out and back in inside the same tab would
 * be fine, but a route swap must not replay the boot skeleton). Combined with
 * the module-scope data cache this guarantees the skeleton is shown exactly
 * once per session.
 */
let bootstrapCompleted = false;
let bootstrapPromise: Promise<void> | null = null;

/** Called from the sign-in flow so the next session boots fresh. */
export function resetAppData() {
  bootstrapCompleted = false;
  bootstrapPromise = null;
  clearCache();
}

async function runBootstrap(): Promise<void> {
  if (bootstrapCompleted) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    // Warm the datasets that nearly every screen needs. `allSettled` keeps a
    // single failing endpoint from blocking the whole app — the page that owns
    // that dataset will surface its own error state.
    await Promise.allSettled([
      fetchProducts(),
      fetchInventories(),
      fetchCategories(),
      fetchOrders(),
      fetchCompletedOrders(),
    ]);
    bootstrapCompleted = true;
  })();

  try {
    await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }
}

type AppDataContextValue = {
  /** False only during the very first post-login data load. */
  bootstrapped: boolean;
  /** Re-fetch every core dataset (used by global refresh actions). */
  refreshAll: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bootstrapped, setBootstrapped] = useState(bootstrapCompleted);

  useEffect(() => {
    if (bootstrapCompleted) {
      setBootstrapped(true);
      return;
    }
    let mounted = true;
    void runBootstrap().finally(() => {
      if (mounted) setBootstrapped(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const refreshAll = useCallback(async () => {
    invalidateOrderData();
    invalidateProductData();
    await Promise.allSettled([
      fetchProducts(),
      fetchInventories(),
      fetchCategories(),
      fetchOrders(),
      fetchCompletedOrders(),
    ]);
  }, []);

  return (
    <AppDataContext.Provider value={{ bootstrapped, refreshAll }}>{children}</AppDataContext.Provider>
  );
};

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  // Pages rendered outside the authenticated shell (public order page) still
  // need to work, so fall back to "already booted" instead of throwing.
  return context ?? { bootstrapped: true, refreshAll: async () => {} };
}

/**
 * Should this screen render a skeleton?
 *
 * Only when there is genuinely nothing to show yet. Once the session has
 * bootstrapped, cached datasets resolve synchronously and this returns false,
 * so navigation stays instant.
 */
export function useShowSkeleton(...loadingStates: boolean[]): boolean {
  const { bootstrapped } = useAppData();
  if (!bootstrapped) return true;
  return loadingStates.some(Boolean);
}

export default AppDataContext;
