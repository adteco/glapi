'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { portalPost } from '@/lib/customer-portal-client';

type RequestResetResponse = {
  success: boolean;
  resetToken?: string;
  resetLink?: string;
};

export default function CustomerPortalResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromQuery = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const hasToken = tokenFromQuery.length > 0;

  const [orgSlug, setOrgSlug] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(tokenFromQuery);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleRequestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      const result = await portalPost<RequestResetResponse>('/auth/reset-password/request', {
        orgSlug: orgSlug.trim() || undefined,
        email,
      });
      if (result.resetToken) {
        setMessage(`Reset token issued: ${result.resetToken}`);
      } else {
        setMessage('If the account exists, a reset email/link has been issued.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request password reset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      await portalPost('/auth/reset-password/confirm', { token, password });
      router.replace('/customer-portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-800 bg-slate-900/90 text-slate-100">
      <CardHeader>
        <CardTitle className="text-xl">
          {hasToken ? 'Set New Password' : 'Reset Password'}
        </CardTitle>
        <CardDescription className="text-slate-400">
          {hasToken
            ? 'Enter your reset token and new password.'
            : 'Request a password reset for your portal account.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasToken ? (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Reset Token</Label>
              <Input
                id="token"
                required
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="border-slate-700 bg-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="border-slate-700 bg-slate-950"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Saving...' : 'Update password'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgSlug">Tenant Slug (optional)</Label>
              <Input
                id="orgSlug"
                value={orgSlug}
                onChange={(event) => setOrgSlug(event.target.value)}
                placeholder="acme"
                className="border-slate-700 bg-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="border-slate-700 bg-slate-950"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Requesting...' : 'Request reset'}
            </Button>
          </form>
        )}

        {error ? (
          <p className="mt-4 rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="mt-4 rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            {message}
          </p>
        ) : null}

        <p className="mt-4 text-sm text-slate-400">
          Back to{' '}
          <Link href="/customer-portal/login" className="text-slate-200 hover:underline">
            sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
