'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { waitForClerkAuthToLoad } from '@/lib/clerk-auth.client';
import { useAuth } from '@clerk/nextjs';
import superjson from 'superjson';

const AUTH_DEBUG_LOGS = process.env.NEXT_PUBLIC_AUTH_DEBUG_LOGS === 'true';

function summarizeValue(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

/**
 * Get the API URL based on environment.
 *
 * Priority:
 * 1. Explicit NEXT_PUBLIC_API_URL env var
 * 2. In production browser, use same origin (Next.js API routes)
 * 3. Development fallback to localhost
 */
function getApiUrl(): string {
  // Explicit env var takes precedence
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // In production browser, use same origin (Next.js API routes)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return window.location.origin;
  }

  // Development fallback
  return 'http://localhost:3031';
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getToken, orgId, userId, isLoaded } = useAuth();

  // Store refs to avoid recreating client on every render
  const getTokenRef = useRef(getToken);
  const isLoadedRef = useRef(isLoaded);
  const orgIdRef = useRef(orgId);
  const userIdRef = useRef(userId);
  const prevOrgIdRef = useRef(orgId);

  // Update refs SYNCHRONOUSLY during render to avoid race conditions
  // This ensures headers use correct values before any queries are made
  getTokenRef.current = getToken;
  isLoadedRef.current = isLoaded;
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

  useEffect(() => {
    if (!AUTH_DEBUG_LOGS) return;
    console.info('[auth-debug][trpc-provider] auth_state', {
      isLoaded,
      hasOrgId: Boolean(orgId),
      hasUserId: Boolean(userId),
      orgId: summarizeValue(orgId),
      userId: summarizeValue(userId),
    });
  }, [isLoaded, orgId, userId]);

  // Create client once, use refs for dynamic values in headers
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getApiUrl()}/api/trpc`,
          transformer: superjson,
          async headers(opts) {
            const authState = await waitForClerkAuthToLoad(() => ({
              isLoaded: isLoadedRef.current,
              orgId: orgIdRef.current,
              userId: userIdRef.current,
            }));
            const token = await getTokenRef.current();
            const headerValues: Record<string, string> = {};

            if (token) {
              headerValues.authorization = `Bearer ${token}`;
            }
            if (authState.orgId) {
              headerValues['x-organization-id'] = authState.orgId;
            }
            if (authState.userId) {
              headerValues['x-user-id'] = authState.userId;
            }

            if (AUTH_DEBUG_LOGS) {
              console.info('[auth-debug][trpc-provider] request_headers', {
                hasToken: Boolean(token),
                tokenLength: token?.length ?? 0,
                isLoaded: authState.isLoaded,
                hasOrgId: Boolean(authState.orgId),
                hasUserId: Boolean(authState.userId),
                orgId: summarizeValue(authState.orgId),
                userId: summarizeValue(authState.userId),
                opPaths: opts?.opList?.map((operation) => operation.path) ?? [],
              });
            }

            return headerValues;
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
