'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

type BetterAuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  createdAt?: Date | string | null;
};

function mapUser(user: BetterAuthUser | null | undefined) {
  if (!user) return null;

  const [firstName, ...rest] = (user.name || '').split(' ').filter(Boolean);
  const lastName = rest.join(' ') || null;

  return {
    id: user.id,
    fullName: user.name ?? user.email ?? null,
    firstName: firstName || null,
    lastName,
    imageUrl: user.image ?? '',
    primaryEmailAddress: user.email ? { emailAddress: user.email } : null,
    createdAt: user.createdAt ?? null,
  };
}

export function useAuth() {
  const session = authClient.useSession();
  const activeOrganization = authClient.useActiveOrganization();
  const activeMemberRole = authClient.useActiveMemberRole();
  const user = mapUser((session.data?.user as BetterAuthUser | undefined) ?? null);
  const orgId =
    activeOrganization.data?.id ??
    (session.data?.session as { activeOrganizationId?: string | null } | undefined)
      ?.activeOrganizationId ??
    null;

  return {
    isLoaded: !session.isPending,
    isSignedIn: Boolean(user),
    userId: user?.id ?? null,
    orgId,
    orgRole: activeMemberRole.data?.role ?? null,
    getToken: async () => null,
  };
}

export function useUser() {
  const session = authClient.useSession();
  const user = mapUser((session.data?.user as BetterAuthUser | undefined) ?? null);

  return {
    isLoaded: !session.isPending,
    isSignedIn: Boolean(user),
    user,
  };
}

export function useOrganization() {
  const activeOrganization = authClient.useActiveOrganization();
  const organization = activeOrganization.data
    ? {
        ...activeOrganization.data,
        imageUrl: activeOrganization.data.logo ?? '',
      }
    : null;

  return {
    isLoaded: !activeOrganization.isPending,
    organization,
  };
}

export function useOrganizationList(_options?: unknown) {
  const organizations = authClient.useListOrganizations();

  return {
    isLoaded: !organizations.isPending,
    userMemberships: {
      data:
        organizations.data?.map((organization) => ({
          organization: {
            ...organization,
            imageUrl: organization.logo ?? '',
          },
        })) ?? [],
    },
    setActive: async ({ organization }: { organization: string }) => {
      const client = authClient as unknown as {
        organization?: {
          setActive?: (input: { organizationId: string }) => Promise<unknown>;
        };
      };

      if (client.organization?.setActive) {
        await client.organization.setActive({ organizationId: organization });
        await organizations.refetch();
        return;
      }

      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031'}/api/auth/organization/set-active`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: organization }),
        }
      );
      await organizations.refetch();
    },
  };
}

function AuthNavButton({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
  mode?: 'modal' | 'redirect';
}) {
  const router = useRouter();

  return (
    <button type="button" onClick={() => router.push(href)}>
      {children}
    </button>
  );
}

export function SignInButton(props: { children: React.ReactNode; mode?: 'modal' | 'redirect' }) {
  return <AuthNavButton href="/sign-in" {...props} />;
}

export function SignUpButton(props: { children: React.ReactNode; mode?: 'modal' | 'redirect' }) {
  return <AuthNavButton href="/sign-up" {...props} />;
}

export function UserButton({ afterSignOutUrl = '/' }: { afterSignOutUrl?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push(afterSignOutUrl);
      }}
    >
      Sign out
    </button>
  );
}

function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (mode === 'sign-in') {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await authClient.signUp.email({ email, password, name: name || email });
        if (result.error) throw new Error(result.error.message);
      }

      router.push('/dashboard');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-sm flex-col gap-4">
      {mode === 'sign-up' ? (
        <input
          className="rounded-md border border-border bg-background px-3 py-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          autoComplete="name"
        />
      ) : null}
      <input
        className="rounded-md border border-border bg-background px-3 py-2"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        type="email"
        autoComplete="email"
        required
      />
      <input
        className="rounded-md border border-border bg-background px-3 py-2"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        type="password"
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        required
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
      >
        {pending ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
      </button>
    </form>
  );
}

export function SignIn(_props?: Record<string, unknown>) {
  return <AuthForm mode="sign-in" />;
}

export function SignUp(_props?: Record<string, unknown>) {
  return <AuthForm mode="sign-up" />;
}

export function OrganizationProfile() {
  const { organization } = useOrganization();

  return (
    <div className="rounded-md border border-border p-4">
      <p className="font-medium">{organization?.name ?? 'No active organization'}</p>
    </div>
  );
}
