'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@clerk/nextjs';
import superjson from 'superjson';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getToken, orgId, userId } = useAuth();

  // Store refs to avoid recreating client on every render
  const getTokenRef = useRef(getToken);
  const orgIdRef = useRef(orgId);
  const userIdRef = useRef(userId);
  const prevOrgIdRef = useRef(orgId);

  // Update refs SYNCHRONOUSLY during render to avoid race conditions
  // This ensures headers use correct values before any queries are made
  getTokenRef.current = getToken;
  orgIdRef.current = orgId;
  userIdRef.current = userId;

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

  // Create client once, use refs for dynamic values in headers
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031'}/api/trpc`,
          transformer: superjson,
          async headers() {
            const token = await getTokenRef.current();
            return {
              authorization: token ? `Bearer ${token}` : '',
              'x-organization-id': orgIdRef.current || '',
              'x-user-id': userIdRef.current || '',
            };
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