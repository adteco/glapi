'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Mail, Check, X, Copy, RefreshCw, TestTube2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// API base URL for admin endpoints
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface MagicInboxConfig {
  enabled: boolean;
  emailAddress: string;
  emailType: 'prefix' | 'custom_domain';
  prefix?: string;
  customDomain?: string;
  verificationStatus?: 'pending' | 'verified' | 'failed';
  webhookUrl: string;
  webhookSecret?: string;
  createdAt: string;
  updatedAt: string;
}

interface UsageSummary {
  billingPeriodStart: string;
  billingPeriodEnd: string;
  documentsProcessed: number;
  documentsConverted: number;
  documentsRejected: number;
  unitPrice: string;
  totalAmount: string | null;
  isBilled: boolean;
}

export function MagicInboxSettings() {
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<MagicInboxConfig | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  // Setup form state
  const [emailType, setEmailType] = useState<'prefix' | 'custom_domain'>('prefix');
  const [prefix, setPrefix] = useState('');
  const [prefixAvailable, setPrefixAvailable] = useState<boolean | null>(null);
  const [checkingPrefix, setCheckingPrefix] = useState(false);
  const [customDomain, setCustomDomain] = useState('');

  // Load current config
  useEffect(() => {
    loadConfig();
    loadUsage();
  }, []);

  async function loadConfig() {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/admin/magic-inbox/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.enabled) {
          setConfig(data);
        }
      }
    } catch (error) {
      console.error('Failed to load Magic Inbox config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsage() {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/admin/magic-inbox/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsage(data);
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  }

  async function checkPrefixAvailability() {
    if (!prefix || prefix.length < 3) return;

    setCheckingPrefix(true);
    setPrefixAvailable(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/admin/magic-inbox/check-prefix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prefix }),
      });

      const data = await response.json();
      setPrefixAvailable(data.available);

      if (!data.available && data.suggestions) {
        toast.error(`Prefix not available. Try: ${data.suggestions.join(', ')}`);
      }
    } catch (error) {
      console.error('Failed to check prefix:', error);
    } finally {
      setCheckingPrefix(false);
    }
  }

  async function enableMagicInbox() {
    setSaving(true);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/admin/magic-inbox/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          emailType,
          prefix: emailType === 'prefix' ? prefix : undefined,
          customDomain: emailType === 'custom_domain' ? customDomain : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);

        toast.success(`Magic Inbox enabled! Your email is ${data.emailAddress}`);

        // Show webhook secret once
        if (data.webhookSecret) {
          toast.info('Save your webhook secret - this is only shown once!');
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to enable Magic Inbox');
      }
    } catch (error) {
      console.error('Failed to enable Magic Inbox:', error);
      toast.error('Failed to enable Magic Inbox');
    } finally {
      setSaving(false);
    }
  }

  async function disableMagicInbox() {
    setSaving(true);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/admin/magic-inbox/config`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setConfig(null);
        toast.success('Magic Inbox disabled');
      }
    } catch (error) {
      console.error('Failed to disable Magic Inbox:', error);
    } finally {
      setSaving(false);
    }
  }

  async function regenerateSecret() {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/admin/magic-inbox/webhook-secret`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Webhook secret regenerated. Copy the new secret now!');

        // Show the new secret temporarily
        setConfig((prev) =>
          prev ? { ...prev, webhookSecret: data.webhookSecret } : null
        );
      }
    } catch (error) {
      console.error('Failed to regenerate secret:', error);
    }
  }

  async function sendTestEmail() {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/admin/magic-inbox/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Test email sent! Check your pending documents.');
      }
    } catch (error) {
      console.error('Failed to send test email:', error);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Magic Inbox</CardTitle>
            {config?.enabled && (
              <Badge variant="secondary">Enabled</Badge>
            )}
          </div>
          {config?.enabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={disableMagicInbox}
              disabled={saving}
            >
              Disable
            </Button>
          )}
        </div>
        <CardDescription>
          Receive vendor invoices via email for AI-powered processing and automatic
          conversion to vendor bills.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {config?.enabled ? (
          <>
            {/* Active Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-4">
                <div>
                  <p className="font-medium">Magic Inbox Email</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {config.emailAddress}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(config.emailAddress)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>

              {config.webhookSecret && (
                <Alert>
                  <AlertTitle>Webhook Secret (save this now!)</AlertTitle>
                  <AlertDescription className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {config.webhookSecret}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(config.webhookSecret!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Usage Stats */}
              {usage && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-md border p-4 text-center">
                    <p className="text-2xl font-bold">{usage.documentsProcessed}</p>
                    <p className="text-sm text-muted-foreground">Documents Received</p>
                  </div>
                  <div className="rounded-md border p-4 text-center">
                    <p className="text-2xl font-bold">{usage.documentsConverted}</p>
                    <p className="text-sm text-muted-foreground">Converted to Bills</p>
                  </div>
                  <div className="rounded-md border p-4 text-center">
                    <p className="text-2xl font-bold">
                      ${parseFloat(usage.totalAmount || '0').toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Est. This Month</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={sendTestEmail}>
                  <TestTube2 className="mr-2 h-4 w-4" />
                  Send Test Email
                </Button>
                <Button variant="outline" onClick={regenerateSecret}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate Secret
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Setup Form */}
            <Tabs
              value={emailType}
              onValueChange={(v) => setEmailType(v as 'prefix' | 'custom_domain')}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="prefix">Use Shared Domain</TabsTrigger>
                <TabsTrigger value="custom_domain">Custom Domain</TabsTrigger>
              </TabsList>

              <TabsContent value="prefix" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="prefix">Choose Your Prefix</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="prefix"
                        placeholder="your-company"
                        value={prefix}
                        onChange={(e) => {
                          setPrefix(e.target.value.toLowerCase());
                          setPrefixAvailable(null);
                        }}
                        onBlur={checkPrefixAvailability}
                      />
                      {prefixAvailable !== null && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {prefixAvailable ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                    <span className="flex items-center text-muted-foreground">
                      @inbox.adteco.app
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your email will be: {prefix || 'your-company'}@inbox.adteco.app
                  </p>
                </div>

                <Button
                  onClick={enableMagicInbox}
                  disabled={saving || !prefix || prefixAvailable === false}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enable Magic Inbox
                </Button>
              </TabsContent>

              <TabsContent value="custom_domain" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="customDomain">Your Domain</Label>
                  <Input
                    id="customDomain"
                    placeholder="inbox.yourcompany.com"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
                  />
                  <p className="text-sm text-muted-foreground">
                    You will need to add DNS records to your domain.
                  </p>
                </div>

                <Button
                  onClick={enableMagicInbox}
                  disabled={saving || !customDomain}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Set Up Custom Domain
                </Button>
              </TabsContent>
            </Tabs>

            {/* Pricing Info */}
            <Alert>
              <AlertTitle>Usage-Based Pricing</AlertTitle>
              <AlertDescription>
                Magic Inbox costs $0.10 per document processed. Documents are
                automatically extracted and ready for review in your Pending
                Documents queue.
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
}
