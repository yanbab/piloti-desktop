import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The shell's cache for data from outside it (files, gsettings, D-Bus…), see
 * `_docs/PLAN-REACTIVE.md`. Watchers decide when something is stale, so queries
 * never go stale on their own; a missing file is an answer, not a retry.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

/** One client for every React root of the shell, so they share the cache. */
export function PilotiQueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
