import { headers } from 'next/headers';
import { auth as betterAuth } from '@glapi/auth';

type BetterAuthSession = {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    createdAt?: Date | string | null;
  };
  session?: {
    activeOrganizationId?: string | null;
  };
};

export async function auth() {
  const session = (await betterAuth.api.getSession({
    headers: await headers(),
  })) as BetterAuthSession | null;

  return {
    userId: session?.user?.id ?? null,
    orgId: session?.session?.activeOrganizationId ?? null,
    getToken: async () => null,
  };
}

export async function currentUser() {
  const session = (await betterAuth.api.getSession({
    headers: await headers(),
  })) as BetterAuthSession | null;
  const user = session?.user;

  if (!user?.id) return null;

  const [firstName, ...rest] = (user.name || '').split(' ').filter(Boolean);

  return {
    id: user.id,
    fullName: user.name ?? user.email ?? null,
    firstName: firstName || null,
    lastName: rest.join(' ') || null,
    imageUrl: user.image ?? '',
    primaryEmailAddress: user.email ? { emailAddress: user.email } : null,
    createdAt: user.createdAt ?? null,
  };
}
