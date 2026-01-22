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

  // Update refs when values change
  useEffect(() => {
    getTokenRef.current = getToken;
    orgIdRef.current = orgId;
    userIdRef.current = userId;
  }, [getToken, orgId, userId]);

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  // Invalidate all queries when organization changes
  useEffect(() => {
    if (orgId) {
      queryClient.invalidateQueries();
    }
  }, [orgId, queryClient]);

  // Create client once, use refs for dynamic values in headers
  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
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