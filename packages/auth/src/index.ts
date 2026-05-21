import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { db } from '@glapi/database';
import {
  account,
  invitation,
  member,
  organization as organizationSchema,
  session,
  user,
  verification,
} from '../../database/src/db/schema/auth';

function envList(value: string | undefined): string[] {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3031';

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    baseURL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_API_URL,
    ...envList(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
  ].filter((origin): origin is string => Boolean(origin)),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
      organization: organizationSchema,
      member,
      invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      // Any specific organization settings
    }),
  ],
});
