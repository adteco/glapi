'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

// =============================================================================
// PostHog Initialization
// =============================================================================

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// Initialize PostHog on client side only
if (typeof window !== 'undefined' && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We handle this manually for better control
    capture_pageleave: true,
    persistence: 'localStorage',
    autocapture: {
      dom_event_allowlist: ['click', 'submit'],
      element_allowlist: ['button', 'a', 'input'],
    },
  });
}

// =============================================================================
// Page View Tracker
// =============================================================================

function PostHogPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (pathname && posthogClient) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + '?' + searchParams.toString();
      }
      posthogClient.capture('$pageview', {
        $current_url: url,
      });
    }
  }, [pathname, searchParams, posthogClient]);

  return null;
}

// =============================================================================
// User Identification
// =============================================================================

function PostHogUserIdentifier() {
  const { user, isLoaded } = useUser();
  const posthogClient = usePostHog();
  const identifiedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !posthogClient) return;

    if (user && !identifiedRef.current) {
      posthogClient.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.firstName,
        created_at: user.createdAt,
      });
      identifiedRef.current = true;
    } else if (!user && identifiedRef.current) {
      posthogClient.reset();
      identifiedRef.current = false;
    }
  }, [user, isLoaded, posthogClient]);

  return null;
}

// =============================================================================
// Provider Component
// =============================================================================

interface PostHogProviderProps {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  // Don't render provider if PostHog key is not configured
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogPageviewTracker />
      <PostHogUserIdentifier />
      {children}
    </PHProvider>
  );
}

// =============================================================================
// Analytics Hook
// =============================================================================

export function useAnalytics() {
  const posthogClient = usePostHog();

  return {
    /**
     * Track a custom event
     */
    track: (event: string, properties?: Record<string, unknown>) => {
      posthogClient?.capture(event, properties);
    },

    /**
     * Identify a user with custom properties
     */
    identify: (userId: string, properties?: Record<string, unknown>) => {
      posthogClient?.identify(userId, properties);
    },

    /**
     * Set user properties without identifying
     */
    setUserProperties: (properties: Record<string, unknown>) => {
      posthogClient?.setPersonProperties(properties);
    },

    /**
     * Reset user identity (on logout)
     */
    reset: () => {
      posthogClient?.reset();
    },

    /**
     * Check if a feature flag is enabled
     */
    isFeatureEnabled: (flag: string) => {
      return posthogClient?.isFeatureEnabled(flag);
    },

    /**
     * Get feature flag payload
     */
    getFeatureFlagPayload: (flag: string) => {
      return posthogClient?.getFeatureFlagPayload(flag);
    },
  };
}
