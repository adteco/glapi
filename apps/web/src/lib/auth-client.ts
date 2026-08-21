'use client';

import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  // Server mounts Better Auth at /auth (basePath in @glapi/auth), so the
  // client baseURL must include it; without a path it would default to /api/auth.
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031'}/auth`,
  plugins: [organizationClient()],
});
