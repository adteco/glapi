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

export const auth = betterAuth({
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
