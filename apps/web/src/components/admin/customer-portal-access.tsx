'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getBrowserApiUrl } from '@/lib/browser-api';

import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type PortalRole = 'billing_viewer' | 'payer' | 'billing_admin';

type InviteResponse = {
  inviteId: string;
  organizationId: string;
  organizationSlug: string;
  entityId: string;
  email: string;
  role: PortalRole;
  expiresAt: string;
  inviteLink: string;
  token?: string;
};

type CustomerOption = {
  id?: string;
  companyName: string;
  contactEmail?: string | null;
};

export function CustomerPortalAccess() {
  const { orgId } = useAuth();
  const { data: customers } = trpc.customers.list.useQuery({}, { enabled: !!orgId });

  const [entityId, setEntityId] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PortalRole>('billing_viewer');
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<InviteResponse | null>(null);

  const customerOptions = useMemo(
    () =>
      ((customers || []) as CustomerOption[]).filter(
        (customer): customer is CustomerOption & { id: string } => Boolean(customer.id)
      ),
    [customers]
  );
  const selectedCustomer = customerOptions.find((customer) => customer.id === entityId);

  const handleCustomerChange = (value: string) => {
    setEntityId(value);
    const customer = customerOptions.find((candidate) => candidate.id === value);
    if (customer?.contactEmail && !email) {
      setEmail(customer.contactEmail);
    }
  };

  const createInvite = async () => {
    if (!entityId) {
      toast.error('Select a customer');
      return;
    }
    if (!email) {
      toast.error('Enter an email address');
      return;
    }

    setSubmitting(true);
    setInvite(null);

    try {
      const response = await fetch(getBrowserApiUrl('/api/customer-portal/auth/invite'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityId,
          email,
          role,
        }),
      });

      const payload = (await response.json()) as InviteResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to create portal invite');
      }

      setInvite(payload);
      toast.success('Portal invite generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create invite');
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteLink = async () => {
    if (!invite?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(invite.inviteLink);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy invite link');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Portal Access</CardTitle>
        <CardDescription>
          Create invite links so customers can access invoices, estimates, orders, projects, and submitted time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-1">
            <Label>Customer</Label>
            <Select value={entityId} onValueChange={handleCustomerChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customerOptions.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as PortalRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="billing_viewer">Billing Viewer</SelectItem>
                <SelectItem value="payer">Payer</SelectItem>
                <SelectItem value="billing_admin">Billing Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={createInvite} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Invite...
              </>
            ) : (
              'Create Invite Link'
            )}
          </Button>
          {selectedCustomer ? (
            <p className="text-sm text-muted-foreground">
              Selected customer: <span className="font-medium text-foreground">{selectedCustomer.companyName}</span>
            </p>
          ) : null}
        </div>

        {invite ? (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{invite.role}</Badge>
              <Badge variant="secondary">{invite.email}</Badge>
              <p className="text-xs text-muted-foreground">
                Expires: {new Date(invite.expiresAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={invite.inviteLink} />
              <Button type="button" variant="outline" onClick={copyInviteLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
