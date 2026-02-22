'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { portalPost } from '@/lib/customer-portal-client';

export default function CustomerPortalLoginPage() {
  const router = useRouter();
  const [orgSlug, setOrgSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await portalPost('/auth/login', {
        orgSlug: orgSlug.trim() || undefined,
        email,
        password,
      });
      router.replace('/customer-portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-800 bg-slate-900/90 text-slate-100">
      <CardHeader>
        <CardTitle className="text-xl">Client Portal Sign In</CardTitle>
        <CardDescription className="text-slate-400">
          Access invoices, projects, orders, and submitted time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
            {submitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
          <Link href="/customer-portal/reset-password" className="hover:text-slate-200">
            Forgot password?
          </Link>
          <Link href="/customer-portal/accept-invite" className="hover:text-slate-200">
            Accept invite
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
