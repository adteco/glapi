'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import superjson from 'superjson';
import { useAuth, useOrganization } from '@clerk/nextjs';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getToken, orgId } = useAuth();
  const { organization } = useOrganization();
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
      // Clear all cached data when organization changes
      queryClient.invalidateQueries();
      queryClient.refetchQueries();
    }
  }, [orgId, queryClient]);
  
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/trpc`,
          async headers() {
            const token = await getToken();
            return {
              authorization: token ? `Bearer ${token}` : '',
              'x-organization-id': orgId || '',
            };
          },
          // @ts-ignore - superjson type issue with tRPC
          transformer: superjson,
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