'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { getBrowserTrpcUrl } from '@/lib/browser-api';
import { useAuth } from '@clerk/nextjs';
import superjson from 'superjson';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { orgId } = useAuth();
  const prevOrgIdRef = useRef(orgId);

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  // Invalidate all queries when organization changes
  // Refs are already updated synchronously above, so queries will use new org
  useEffect(() => {
    if (orgId && prevOrgIdRef.current !== orgId) {
      prevOrgIdRef.current = orgId;
      // Clear cache completely to ensure no stale data from previous org
      queryClient.clear();
    }
  }, [orgId, queryClient]);

  // Create client once and rely on the same-origin proxy route for auth context.
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: getBrowserTrpcUrl(),
          transformer: superjson,
          headers() {
            return {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
