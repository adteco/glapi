'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Edit,
  Plus,
  Mail,
  Phone,
  Building2,
  MapPin,
  Calendar,
  FileText,
  Users,
  Receipt,
  DollarSign,
  Clock,
  ExternalLink,
  MoreHorizontal,
  CreditCard,
  Briefcase,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskList } from '@/components/tasks';
import { EntityContactsList } from '@/components/contacts';

interface Customer {
  id: string;
  companyName: string;
  customerId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  parentCustomerId?: string | null;
  status: string;
  billingAddress?: any;
  createdAt: string;
  updatedAt: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { orgId } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Customer data
  const { data: customer, isLoading: customerLoading } = trpc.customers.get.useQuery(
    { id },
    {
      enabled: !!orgId && !!id,
      retry: 1,
    }
  );

  // Contacts associated with this customer (many-to-many via entityContacts)
  const { data: entityContactsData, isLoading: contactsLoading } = trpc.entityContacts.listContacts.useQuery(
    { entityId: id },
    { enabled: !!orgId && !!id }
  );

  // Contact count for badge
  const contactCount = entityContactsData?.length ?? 0;

  // Invoices for this customer
  const { data: invoicesData, isLoading: invoicesLoading } = trpc.invoices.list.useQuery(
    { entityId: id, page: 1, limit: 50 },
    { enabled: !!orgId && !!id }
  );

  // Invoice summary for this customer
  const { data: invoiceSummary, isLoading: summaryLoading } = trpc.invoices.summary.useQuery(
    { entityId: id },
    { enabled: !!orgId && !!id }
  );

  // Rate cards (price lists with labor rates) for this customer
  const { data: customerPriceListsData, isLoading: rateCardsLoading } = trpc.priceLists.getCustomerPriceLists.useQuery(
    { customerId: id },
    { enabled: !!orgId && !!id }
  );

  const customerPriceLists = customerPriceListsData?.assignments ?? [];

  // Child customers (placeholder for now)
  const childCustomers: Customer[] = [];

  if (!orgId) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">Please select an organization to view customer details.</p>
        </div>
      </div>
    );
  }

  if (customerLoading) {
    return <CustomerDetailSkeleton />;
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="text-center py-20">
            <Building2 className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-foreground mb-2">Customer Not Found</h1>
            <p className="text-muted-foreground">The customer you're looking for doesn't exist or you don't have access.</p>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num || 0);
  };

  const formatAddress = (address: any) => {
    if (!address) return null;
    const parts = [];
    if (address.street || address.line1) parts.push(address.street || address.line1);
    if (address.line2) parts.push(address.line2);
    const cityLine = [address.city, address.state || address.stateProvince, address.postalCode].filter(Boolean).join(', ');
    if (cityLine) parts.push(cityLine);
    if (address.country || address.countryCode) parts.push(address.country || address.countryCode);
    return parts.length > 0 ? parts : null;
  };

  const getStatusStyles = (status: string) => {
    const styles: Record<string, { bg: string; text: string; dot: string }> = {
      active: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
      inactive: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
      archived: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
      draft: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
      sent: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
      paid: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
      overdue: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
      void: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
    };
    return styles[status.toLowerCase()] || styles.inactive;
  };

  const addressParts = formatAddress(customer.billingAddress);

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="mt-1 shrink-0"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                    {customer.companyName}
                  </h1>
                  <StatusBadge status={customer.status} styles={getStatusStyles(customer.status)} />
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {customer.customerId && (
                    <span className="font-mono">{customer.customerId}</span>
                  )}
                  {customer.contactEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {customer.contactEmail}
                    </span>
                  )}
                  {customer.contactPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {customer.contactPhone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button onClick={() => router.push(`/relationships/customers/${id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Customer
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-background border border-border p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="contacts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="h-4 w-4 mr-2" />
              Contacts
              {contactCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {contactCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Receipt className="h-4 w-4 mr-2" />
              Transactions
              {invoicesData?.total && invoicesData.total > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {invoicesData.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ratecards" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CreditCard className="h-4 w-4 mr-2" />
              Rate Cards
              {customerPriceLists.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {customerPriceLists.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <ListChecks className="h-4 w-4 mr-2" />
              Tasks
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Customer Information */}
              <Card className="lg:col-span-2 border-border shadow-sm">
                <CardHeader className="border-b border-border bg-muted/50">
                  <CardTitle className="text-base font-medium">Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                    <InfoItem label="Company Name" value={customer.companyName} />
                    <InfoItem label="Customer ID" value={customer.customerId} mono />
                    <InfoItem label="Email" value={customer.contactEmail} href={customer.contactEmail ? `mailto:${customer.contactEmail}` : undefined} />
                    <InfoItem label="Phone" value={customer.contactPhone} href={customer.contactPhone ? `tel:${customer.contactPhone}` : undefined} />
                    <InfoItem label="Status">
                      <StatusBadge status={customer.status} styles={getStatusStyles(customer.status)} />
                    </InfoItem>
                    <InfoItem label="Created" value={formatDateTime(customer.createdAt)} />
                  </dl>
                </CardContent>
              </Card>

              {/* Billing Address */}
              <Card className="border-border shadow-sm">
                <CardHeader className="border-b border-border bg-muted/50">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Billing Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {addressParts ? (
                    <address className="not-italic text-sm text-foreground space-y-1">
                      {addressParts.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </address>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No address on file</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Financial Summary */}
            {!summaryLoading && invoiceSummary && (
              <div className="grid sm:grid-cols-4 gap-4">
                <SummaryCard
                  label="Total Invoiced"
                  value={formatCurrency(invoiceSummary.totalAmount)}
                  icon={DollarSign}
                />
                <SummaryCard
                  label="Amount Paid"
                  value={formatCurrency(invoiceSummary.totalPaid)}
                  icon={Receipt}
                  variant="success"
                />
                <SummaryCard
                  label="Outstanding"
                  value={formatCurrency(invoiceSummary.totalOutstanding)}
                  icon={Clock}
                  variant={invoiceSummary.totalOutstanding > 0 ? 'warning' : 'default'}
                />
                <SummaryCard
                  label="Invoices"
                  value={invoiceSummary.totalInvoices.toString()}
                  icon={FileText}
                />
              </div>
            )}

            {/* Child Customers */}
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border bg-muted/50">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base font-medium">Child Customers</CardTitle>
                    <CardDescription>Customers that belong to this parent customer</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/relationships/customers/new?parentId=${id}`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Child
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {childCustomers.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No child customers</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Customer ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {childCustomers.map((child) => (
                        <TableRow
                          key={child.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/relationships/customers/${child.id}`)}
                        >
                          <TableCell className="font-medium">{child.companyName}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{child.customerId || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{child.contactEmail || '—'}</TableCell>
                          <TableCell>
                            <StatusBadge status={child.status} styles={getStatusStyles(child.status)} size="sm" />
                          </TableCell>
                          <TableCell>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-6">
            <EntityContactsList
              entityId={id}
              entityName="customer"
              showHeader={true}
              allowCreate={true}
            />
          </TabsContent>

          {/* Transactions/Invoices Tab */}
          <TabsContent value="invoices" className="space-y-6">
            {/* Status Summary */}
            {!summaryLoading && invoiceSummary && (
              <div className="grid sm:grid-cols-5 gap-3">
                <StatusSummaryCard label="Draft" count={invoiceSummary.byStatus.draft} color="muted" />
                <StatusSummaryCard label="Sent" count={invoiceSummary.byStatus.sent} color="blue" />
                <StatusSummaryCard label="Paid" count={invoiceSummary.byStatus.paid} color="emerald" />
                <StatusSummaryCard label="Overdue" count={invoiceSummary.byStatus.overdue} color="amber" />
                <StatusSummaryCard label="Void" count={invoiceSummary.byStatus.void} color="muted" />
              </div>
            )}

            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border bg-muted/50">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base font-medium">Invoices</CardTitle>
                    <CardDescription>Transaction history for this customer</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => router.push(`/transactions/sales/invoices/new?entityId=${id}`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {invoicesLoading ? (
                  <div className="p-8 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    ))}
                  </div>
                ) : !invoicesData?.data || invoicesData.data.length === 0 ? (
                  <div className="text-center py-12">
                    <Receipt className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">No invoices yet</p>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/transactions/sales/invoices/new?entityId=${id}`)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Invoice
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoicesData.data.map((invoice: any) => (
                        <TableRow
                          key={invoice.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/transactions/sales/invoices/${invoice.id}`)}
                        >
                          <TableCell className="font-mono font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(invoice.invoiceDate)}</TableCell>
                          <TableCell className="text-muted-foreground">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(invoice.totalAmount)}</TableCell>
                          <TableCell>
                            <StatusBadge status={invoice.status} styles={getStatusStyles(invoice.status)} size="sm" />
                          </TableCell>
                          <TableCell>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rate Cards Tab */}
          <TabsContent value="ratecards" className="space-y-6">
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border bg-muted/50">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base font-medium">Rate Cards</CardTitle>
                    <CardDescription>Price lists and labor rates assigned to this customer</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => router.push(`/lists/price-lists`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Manage Price Lists
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {rateCardsLoading ? (
                  <div className="p-8 space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-64" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : customerPriceLists.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">No rate cards assigned to this customer</p>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/lists/price-lists`)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Assign Price List
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {customerPriceLists.map((assignment) => (
                      <div key={assignment.id} className="p-4">
                        {/* Price List Header */}
                        <div
                          className="flex items-center justify-between mb-4 cursor-pointer hover:bg-muted/50 -mx-4 px-4 py-2 rounded"
                          onClick={() => router.push(`/lists/price-lists/${assignment.priceListId}/labor-rates`)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{assignment.priceList.name}</p>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="font-mono">{assignment.priceList.code}</span>
                                <span>•</span>
                                <span>{assignment.priceList.currencyCode}</span>
                                {assignment.effectiveDate && (
                                  <>
                                    <span>•</span>
                                    <span>Effective: {formatDate(assignment.effectiveDate)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={assignment.priceList.isActive ? 'default' : 'secondary'}>
                              {assignment.priceList.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="outline">Priority: {assignment.priority}</Badge>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        {/* Labor Rates Table */}
                        {assignment.laborRates.length > 0 ? (
                          <div className="bg-muted rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/80">
                                  <TableHead className="text-xs">Target</TableHead>
                                  <TableHead className="text-xs text-right">Labor Rate</TableHead>
                                  <TableHead className="text-xs text-right">Billing Rate</TableHead>
                                  <TableHead className="text-xs text-right">OT/DT</TableHead>
                                  <TableHead className="text-xs">Effective</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {assignment.laborRates.slice(0, 5).map((rate) => (
                                  <TableRow key={rate.id} className="text-sm">
                                    <TableCell className="py-2">
                                      <div className="flex items-center gap-2">
                                        {rate.employee?.displayName ? (
                                          <>
                                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span>{rate.employee.displayName}</span>
                                          </>
                                        ) : rate.laborRole ? (
                                          <>
                                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span>{rate.laborRole}</span>
                                          </>
                                        ) : (
                                          <span className="text-muted-foreground italic">Default Rate</span>
                                        )}
                                      </div>
                                      {rate.project?.name && (
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                          Project: {rate.project.name}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2 text-right font-mono">
                                      {formatCurrency(rate.laborRate)}
                                    </TableCell>
                                    <TableCell className="py-2 text-right font-mono font-medium">
                                      {formatCurrency(rate.billingRate)}
                                    </TableCell>
                                    <TableCell className="py-2 text-right text-muted-foreground">
                                      {rate.overtimeMultiplier}x / {rate.doubleTimeMultiplier}x
                                    </TableCell>
                                    <TableCell className="py-2 text-muted-foreground">
                                      {formatDate(rate.effectiveDate)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {assignment.laborRates.length > 5 && (
                              <div className="px-4 py-2 bg-muted/80 text-center">
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => router.push(`/lists/price-lists/${assignment.priceListId}/labor-rates`)}
                                >
                                  View all {assignment.laborRates.length} rates →
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-muted rounded-lg p-4 text-center text-sm text-muted-foreground">
                            No labor rates defined for this price list
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-6">
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border bg-muted/50">
                <div>
                  <CardTitle className="text-base font-medium">Tasks</CardTitle>
                  <CardDescription>Tasks associated with this customer</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <TaskList
                  entityType="customer"
                  entityId={id}
                  showFilters={true}
                  allowCreate={true}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Helper Components
function StatusBadge({ status, styles, size = 'default' }: { status: string; styles: { bg: string; text: string; dot: string }; size?: 'sm' | 'default' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'} font-medium rounded-full ${styles.bg} ${styles.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function InfoItem({ label, value, children, mono, href }: { label: string; value?: string | null; children?: React.ReactNode; mono?: boolean; href?: string }) {
  const content = children ?? (value ? (
    href ? (
      <a href={href} className="text-primary hover:underline">{value}</a>
    ) : (
      <span className={mono ? 'font-mono' : ''}>{value}</span>
    )
  ) : (
    <span className="text-muted-foreground italic">Not specified</span>
  ));

  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground mb-1">{label}</dt>
      <dd className="text-sm text-foreground">{content}</dd>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, variant = 'default' }: { label: string; value: string; icon: any; variant?: 'default' | 'success' | 'warning' }) {
  const variantStyles = {
    default: 'bg-background',
    success: 'bg-emerald-50 dark:bg-emerald-950/30',
    warning: 'bg-amber-50 dark:bg-amber-950/30',
  };
  const iconStyles = {
    default: 'text-muted-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
  };

  return (
    <Card className={`border-border shadow-sm ${variantStyles[variant]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-xl font-semibold text-foreground mt-1">{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${iconStyles[variant]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusSummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    muted: 'bg-muted text-muted-foreground',
    blue: 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  };

  return (
    <div className={`rounded-lg p-3 ${colors[color] || colors.muted}`}>
      <p className="text-2xl font-semibold">{count}</p>
      <p className="text-xs font-medium uppercase tracking-wider opacity-75">{label}</p>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function CustomerDetailSkeleton() {
  return (
    <div className="min-h-screen bg-muted">
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Skeleton className="h-10 w-80 mb-6" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
