'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { portalPost } from '@/lib/customer-portal-client';

export default function CustomerPortalAcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromQuery = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [token, setToken] = useState(tokenFromQuery);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await portalPost('/auth/accept-invite', {
        token,
        fullName: fullName.trim() || undefined,
        password,
      });
      router.replace('/customer-portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-800 bg-slate-900/90 text-slate-100">
      <CardHeader>
        <CardTitle className="text-xl">Accept Invite</CardTitle>
        <CardDescription className="text-slate-400">
          Set your password to activate customer portal access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Invite Token</Label>
            <Input
              id="token"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="border-slate-700 bg-slate-950"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name (optional)</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="border-slate-700 bg-slate-950"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border-slate-700 bg-slate-950"
            />
          </div>

          {error ? (
            <p className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Activating...' : 'Activate account'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-slate-400">
          Already activated?{' '}
          <Link href="/customer-portal/login" className="text-slate-200 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
