'use client';

import { OrganizationProfile, useAuth, useUser } from '@clerk/nextjs';

import { SeedAccountsButton } from '@/components/SeedAccountsButton';
import { StripePaymentMethods } from '@/components/billing/stripe-payment-methods';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

export default function AdminSettingsPage() {
  const { orgRole } = useAuth();
  const { user } = useUser();
  const metadataRole = user?.publicMetadata?.role as string | undefined;
  const isAdmin =
    ['admin', 'owner', 'org:admin', 'org:owner'].includes(orgRole ?? '') ||
    ['admin', 'owner'].includes(metadataRole ?? '');

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Settings</h1>
          <p className="text-muted-foreground">
            Manage company profile, billing, API access, and preferences.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Save changes</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Capture your legal entity details, branding, and address information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input id="companyName" placeholder="Acme Data Systems, Inc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalName">Legal Name</Label>
                <Input id="legalName" placeholder="Acme Data Systems Holdings, Inc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyLogoForms">Company Logo (Forms)</Label>
                <Select defaultValue="primary">
                  <SelectTrigger id="companyLogoForms" className="w-full">
                    <SelectValue placeholder="Select a logo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary Logo (PNG)</SelectItem>
                    <SelectItem value="alt">Alternate Logo (SVG)</SelectItem>
                    <SelectItem value="mono">Monochrome Logo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyLogoPages">Company Logo (Pages)</Label>
                <Select defaultValue="stacked">
                  <SelectTrigger id="companyLogoPages" className="w-full">
                    <SelectValue placeholder="Select a logo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stacked">Stacked Logo (GIF)</SelectItem>
                    <SelectItem value="horizontal">Horizontal Logo</SelectItem>
                    <SelectItem value="icon">Icon Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="displayLogoInternally" defaultChecked />
                <Label htmlFor="displayLogoInternally">Display logo internally</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" type="url" placeholder="https://www.example.com" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="state">County/State/Province *</Label>
                  <Select defaultValue="ca">
                    <SelectTrigger id="state" className="w-full">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ca">California</SelectItem>
                      <SelectItem value="ny">New York</SelectItem>
                      <SelectItem value="tx">Texas</SelectItem>
                      <SelectItem value="wa">Washington</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select defaultValue="us">
                    <SelectTrigger id="country" className="w-full">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="ca">Canada</SelectItem>
                      <SelectItem value="uk">United Kingdom</SelectItem>
                      <SelectItem value="au">Australia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="returnEmail">Return Email Address *</Label>
                  <Input id="returnEmail" type="email" placeholder="billing@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fax">Fax</Label>
                  <Input id="fax" placeholder="(858) 430-3529" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select defaultValue="usd">
                    <SelectTrigger id="currency" className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">USD - US Dollar</SelectItem>
                      <SelectItem value="cad">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="eur">EUR - Euro</SelectItem>
                      <SelectItem value="gbp">GBP - British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ein">Employer Identification Number (EIN)</Label>
                  <Input id="ein" placeholder="95-3846438" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ssn">SSN or TIN</Label>
                <Input id="ssn" placeholder="95-3846438" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fiscalMonth">First Fiscal Month</Label>
                <Select defaultValue="january">
                  <SelectTrigger id="fiscalMonth" className="w-full">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="january">January</SelectItem>
                    <SelectItem value="february">February</SelectItem>
                    <SelectItem value="march">March</SelectItem>
                    <SelectItem value="april">April</SelectItem>
                    <SelectItem value="july">July</SelectItem>
                    <SelectItem value="october">October</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeZone">Time Zone</Label>
                <Select defaultValue="pst">
                  <SelectTrigger id="timeZone" className="w-full">
                    <SelectValue placeholder="Select time zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pst">(GMT-08:00) Pacific Time (US &amp; Canada)</SelectItem>
                    <SelectItem value="mst">(GMT-07:00) Mountain Time (US &amp; Canada)</SelectItem>
                    <SelectItem value="cst">(GMT-06:00) Central Time (US &amp; Canada)</SelectItem>
                    <SelectItem value="est">(GMT-05:00) Eastern Time (US &amp; Canada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="allowedIps">Allowed IP Addresses *</Label>
                <Textarea
                  id="allowedIps"
                  placeholder="ALL or 10.0.0.0/24, 203.0.113.4"
                  rows={4}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="accountId">Account ID</Label>
                  <Input id="accountId" defaultValue="3370076" disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataCenter">Data Center</Label>
                  <Input id="dataCenter" defaultValue="US Phoenix 8" disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="disclaimer">Disclaimer</Label>
                <Textarea id="disclaimer" placeholder="Add invoice disclaimer..." rows={4} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="taxAmtLabel">Tax Amount Label</Label>
                  <Input id="taxAmtLabel" placeholder="Sales Tax" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxRateLabel">Tax Rate Label</Label>
                  <Input id="taxRateLabel" placeholder="Tax Rate" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryAddress">Address</Label>
              <Textarea
                id="primaryAddress"
                placeholder="Acme HQ\n123 Market Street\nPasadena, CA 91110"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="returnAddress">Return Address</Label>
              <Textarea
                id="returnAddress"
                placeholder="Acme HQ\nPO Box 31001-4038\nPasadena, CA 91110"
                rows={4}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing &amp; Tenancy</CardTitle>
          <CardDescription>
            Configure billing contacts and choose shared or isolated tenancy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="tenancyType">Tenancy Mode *</Label>
            <Select defaultValue="shared">
              <SelectTrigger id="tenancyType" className="w-full">
                <SelectValue placeholder="Select tenancy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shared">Shared tenancy</SelectItem>
                <SelectItem value="isolated">Isolated tenancy</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Shared tenancy is multi-tenant infrastructure. Isolated tenancy provisions
              dedicated infrastructure with separate data boundaries.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billingContact">Billing Contact</Label>
              <Input id="billingContact" placeholder="Avery Johnson" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingEmail">Billing Email</Label>
              <Input id="billingEmail" type="email" placeholder="billing@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingPhone">Billing Phone</Label>
              <Input id="billingPhone" placeholder="(415) 555-0134" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingPlan">Plan</Label>
              <Select defaultValue="growth">
                <SelectTrigger id="billingPlan" className="w-full">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billingAddress">Billing Address</Label>
              <Textarea
                id="billingAddress"
                placeholder="PO Box 31001-4038\nPasadena, CA 91110"
                rows={4}
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select defaultValue="ach">
                  <SelectTrigger id="paymentMethod" className="w-full">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ach">ACH / Bank Transfer</SelectItem>
                    <SelectItem value="card">Corporate Card</SelectItem>
                    <SelectItem value="invoice">Invoice Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / VAT Number</Label>
                <Input id="taxId" placeholder="US-95-3846438" />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">Auto-renew subscription</p>
                  <p className="text-sm text-muted-foreground">
                    Charge the default payment method monthly.
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Payment Methods</h3>
              <p className="text-sm text-muted-foreground">
                Manage payment methods with Stripe Elements. Admin access required.
              </p>
            </div>
            {isAdmin ? (
              <StripePaymentMethods />
            ) : (
              <Alert variant="destructive">
                <AlertTitle>Admin access required</AlertTitle>
                <AlertDescription>
                  Only organization admins can manage Stripe billing details.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Access</CardTitle>
          <CardDescription>
            Manage API keys, allowlists, and access scopes for integrations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">API Keys</p>
              <p className="text-sm text-muted-foreground">
                Rotate keys regularly and restrict access by IP where possible.
              </p>
            </div>
            <Button>Generate API key</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apiAllowlist">IP Allowlist</Label>
              <Textarea
                id="apiAllowlist"
                placeholder="203.0.113.0/24, 198.51.100.12"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookSecret">Webhook Signing Secret</Label>
              <Input
                id="webhookSecret"
                type="password"
                defaultValue="whsec_********"
                readOnly
              />
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">Require IP allowlist</p>
                  <p className="text-sm text-muted-foreground">
                    Block API traffic that does not match the allowlist.
                  </p>
                </div>
                <Switch />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Accounting Platform</TableCell>
                <TableCell>glp_live_2f9d</TableCell>
                <TableCell>Jan 12, 2026</TableCell>
                <TableCell>Jan 24, 2026</TableCell>
                <TableCell>
                  <Badge variant="secondary">Active</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm">Rotate</Button>
                    <Button variant="outline" size="sm">Revoke</Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Data Warehouse Sync</TableCell>
                <TableCell>glp_live_7c1a</TableCell>
                <TableCell>Dec 2, 2025</TableCell>
                <TableCell>Jan 4, 2026</TableCell>
                <TableCell>
                  <Badge variant="outline">Limited</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm">Rotate</Button>
                    <Button variant="outline" size="sm">Revoke</Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Tune notifications, fiscal defaults, and security options for admins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Default Currency</Label>
              <Select defaultValue="usd">
                <SelectTrigger id="defaultCurrency" className="w-full">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD - US Dollar</SelectItem>
                  <SelectItem value="cad">CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="eur">EUR - Euro</SelectItem>
                  <SelectItem value="gbp">GBP - British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultTimezone">Default Time Zone</Label>
              <Select defaultValue="pst">
                <SelectTrigger id="defaultTimezone" className="w-full">
                  <SelectValue placeholder="Select time zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pst">Pacific Time (US &amp; Canada)</SelectItem>
                  <SelectItem value="mst">Mountain Time (US &amp; Canada)</SelectItem>
                  <SelectItem value="cst">Central Time (US &amp; Canada)</SelectItem>
                  <SelectItem value="est">Eastern Time (US &amp; Canada)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Weekly usage summary</p>
                <p className="text-sm text-muted-foreground">
                  Send admin digest every Monday.
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Billing alerts</p>
                <p className="text-sm text-muted-foreground">
                  Notify when invoices are due or overdue.
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Require MFA for admins</p>
                <p className="text-sm text-muted-foreground">
                  Force multi-factor authentication on admin accounts.
                </p>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">Idle session timeout</p>
                <p className="text-sm text-muted-foreground">
                  Sign out after 30 minutes of inactivity.
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Access</CardTitle>
          <CardDescription>
            Manage organization members, roles, and invitations via Clerk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <OrganizationProfile />
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Admin access required</AlertTitle>
              <AlertDescription>
                Only organization admins can manage user access.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="w-full md:w-1/2">
        <CardHeader>
          <CardTitle>Chart of Accounts</CardTitle>
          <CardDescription>
            Initialize the default Chart of Accounts for your active organization.
            This action can only be performed once per organization if no accounts exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeedAccountsButton />
        </CardContent>
      </Card>
    </div>
  );
}
