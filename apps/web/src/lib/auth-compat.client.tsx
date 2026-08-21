'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { safeAuthRedirectPath } from '@/lib/auth-redirect';

function currentRedirectPath(): string {
  return safeAuthRedirectPath(
    typeof window === 'undefined' ? '' : window.location.search,
  );
}

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
  const user = mapUser(
    (session.data?.user as BetterAuthUser | undefined) ?? null,
  );
  const orgId =
    activeOrganization.data?.id ??
    (
      session.data?.session as
        | { activeOrganizationId?: string | null }
        | undefined
    )?.activeOrganizationId ??
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
  const user = mapUser(
    (session.data?.user as BetterAuthUser | undefined) ?? null,
  );

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
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3031'}/auth/organization/set-active`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: organization }),
        },
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

export function SignInButton(props: {
  children: React.ReactNode;
  mode?: 'modal' | 'redirect';
}) {
  return <AuthNavButton href="/sign-in" {...props} />;
}

export function SignUpButton(props: {
  children: React.ReactNode;
  mode?: 'modal' | 'redirect';
}) {
  return <AuthNavButton href="/sign-up" {...props} />;
}

export function UserButton({
  afterSignOutUrl = '/',
}: {
  afterSignOutUrl?: string;
}) {
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const session = authClient.useSession();
  const activeOrganization = authClient.useActiveOrganization();
  const organizations = authClient.useListOrganizations();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (mode !== 'sign-in' || session.isPending || !session.data?.user) return;
    if (activeOrganization.isPending || organizations.isPending) return;

    let cancelled = false;

    async function finishSignIn() {
      if (!activeOrganization.data && organizations.data?.length) {
        await authClient.organization.setActive({
          organizationId: organizations.data[0].id,
        });
      }

      if (!cancelled) router.replace(currentRedirectPath());
    }

    void finishSignIn().catch((authError) => {
      if (!cancelled) {
        setError(
          authError instanceof Error
            ? authError.message
            : 'Unable to select organization',
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeOrganization.data,
    activeOrganization.isPending,
    mode,
    organizations.data,
    organizations.isPending,
    router,
    session.data?.user,
    session.isPending,
  ]);

  async function onSocialSignIn(provider: 'google' | 'microsoft') {
    setError(null);
    setPending(true);

    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}/sign-in?redirect_url=${encodeURIComponent(
          currentRedirectPath(),
        )}`,
      });
      if (result.error) throw new Error(result.error.message);
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'Authentication failed',
      );
      setPending(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (mode === 'sign-in') {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await authClient.signUp.email({
          email,
          password,
          name: name || email,
        });
        if (result.error) throw new Error(result.error.message);
      }

      await session.refetch();
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'Authentication failed',
      );
    } finally {
      setPending(false);
    }
  }

  if (mode === 'sign-in' && session.data?.user) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-10 text-center shadow-2xl backdrop-blur-sm">
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Completing sign in...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-border bg-card/70 p-8 shadow-2xl backdrop-blur-sm sm:p-10">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-block bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent"
          >
            GLAPI
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === 'sign-in'
              ? 'Sign in to continue to your dashboard'
              : 'Get started with GLAPI'}
          </p>
        </div>

        {mode === 'sign-in' ? (
          <>
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => void onSocialSignIn('google')}
                className="h-10 w-full gap-2.5"
              >
                <GoogleIcon />
                Continue with Google
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => void onSocialSignIn('microsoft')}
                className="h-10 w-full gap-2.5"
              >
                <MicrosoftIcon />
                Continue with Microsoft
              </Button>
            </div>
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs tracking-wide text-muted-foreground uppercase">
                or continue with email
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {mode === 'sign-up' ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="auth-name">Name</Label>
              <Input
                id="auth-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={
                mode === 'sign-in' ? 'current-password' : 'new-password'
              }
              required
            />
          </div>
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}
          <Button type="submit" disabled={pending} className="mt-2 h-10 w-full">
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Please wait...
              </>
            ) : mode === 'sign-in' ? (
              'Sign in'
            ) : (
              'Create account'
            )}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === 'sign-in' ? (
          <>
            Don&apos;t have an account?{' '}
            <Link
              href="/sign-up"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link
              href="/sign-in"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
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
      <p className="font-medium">
        {organization?.name ?? 'No active organization'}
      </p>
    </div>
  );
}
