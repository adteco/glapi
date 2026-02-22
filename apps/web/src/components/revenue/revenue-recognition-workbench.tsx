'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';

type ScenarioAction = 'add' | 'remove';
type BillingFrequency = 'monthly' | 'quarterly' | 'annual';

interface LineItemDraft {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  listPrice?: number;
  revenueBehavior?: 'point_in_time' | 'over_time';
  sspAmount?: number;
  serviceStartDate: string;
  serviceEndDate: string;
}

type WorkbenchMode = 'full' | 'contracts' | 'obligations';

interface RevenueRecognitionWorkbenchProps {
  mode?: WorkbenchMode;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);

const toDateInput = (d: Date): string => d.toISOString().slice(0, 10);

function normalizeRows(input: unknown): any[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object' && 'data' in input) {
    const rows = (input as { data?: unknown }).data;
    return Array.isArray(rows) ? rows : [];
  }
  return [];
}

export default function RevenueRecognitionWorkbench({ mode = 'full' }: RevenueRecognitionWorkbenchProps) {
  const utils = trpc.useUtils();
  const today = useMemo(() => toDateInput(new Date()), []);
  const showContractCreation = mode !== 'obligations';
  const showLicenseWhatIf = mode !== 'contracts';

  const [subsidiaryId, setSubsidiaryId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [orderDate, setOrderDate] = useState(today);
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('monthly');
  const [termMonths, setTermMonths] = useState(12);
  const [existingSalesOrderId, setExistingSalesOrderId] = useState('');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    {
      itemId: '',
      description: 'SaaS License Seats',
      quantity: 10,
      unitPrice: 120,
      revenueBehavior: 'over_time',
      serviceStartDate: today,
      serviceEndDate: '',
    },
  ]);

  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [scenarioAction, setScenarioAction] = useState<ScenarioAction>('add');
  const [scenarioQty, setScenarioQty] = useState<number>(1);
  const [scenarioUnitPrice, setScenarioUnitPrice] = useState<number>(100);
  const [effectiveDate, setEffectiveDate] = useState<string>(today);
  const [lastPlanResult, setLastPlanResult] = useState<any | null>(null);
  const [seededDemo, setSeededDemo] = useState<any | null>(null);
  const [loadingPlanForSubscriptionId, setLoadingPlanForSubscriptionId] = useState<string>('');

  const subscriptionsQuery = trpc.subscriptions.list.useQuery({
    page: 1,
    limit: 100,
    status: 'active',
  });
  const customersQuery = trpc.customers.list.useQuery({ page: 1, limit: 100 } as any);
  const subsidiariesQuery = trpc.subsidiaries.list.useQuery({ page: 1, limit: 100 } as any);
  const itemsQuery = trpc.items.list.useQuery({ page: 1, limit: 200 } as any);

  const subscriptions = normalizeRows(subscriptionsQuery.data);
  const customers = normalizeRows(customersQuery.data);
  const subsidiaries = normalizeRows(subsidiariesQuery.data);
  const items = normalizeRows(itemsQuery.data);
  const itemsById = useMemo(() => new Map(items.map((row) => [String(row.id), row as any])), [items]);

  useEffect(() => {
    if (!subsidiaryId && subsidiaries.length > 0) {
      setSubsidiaryId(String(subsidiaries[0].id));
    }
  }, [subsidiaryId, subsidiaries]);

  useEffect(() => {
    if (!entityId && customers.length > 0) {
      setEntityId(String(customers[0].id));
    }
  }, [entityId, customers]);

  useEffect(() => {
    if (!selectedSubscriptionId && subscriptions.length > 0) {
      setSelectedSubscriptionId(String(subscriptions[0].id));
    }
  }, [selectedSubscriptionId, subscriptions]);

  useEffect(() => {
    if (lineItems.length === 1 && !lineItems[0].itemId && items.length > 0) {
      const firstItem = itemsById.get(String(items[0].id));
      const listPrice = Number(firstItem?.listPrice ?? firstItem?.defaultPrice ?? 0);
      const defaultSsp = Number(firstItem?.defaultSspAmount ?? 0);
      setLineItems((current) => [
        {
          ...current[0],
          itemId: String(items[0].id),
          listPrice: listPrice > 0 ? listPrice : current[0].listPrice,
          unitPrice: current[0].unitPrice > 0 ? current[0].unitPrice : listPrice,
          revenueBehavior: current[0].revenueBehavior || firstItem?.revenueBehavior || 'over_time',
          sspAmount: current[0].sspAmount ?? (defaultSsp > 0 ? defaultSsp : undefined),
        },
      ]);
    }
  }, [items, itemsById, lineItems]);

  const subscriptionDetailQuery = trpc.subscriptions.get.useQuery(
    { id: selectedSubscriptionId },
    { enabled: !!selectedSubscriptionId }
  );

  const planQuery = trpc.revenue.subscriptionPlan.useQuery(
    { subscriptionId: selectedSubscriptionId },
    { enabled: !!selectedSubscriptionId }
  );

  const demoScenariosQuery = trpc.revenue.listSoftwareDemoScenarios.useQuery();

  const createPlanMutation = trpc.salesOrders.createWithRevenuePlan.useMutation({
    onSuccess: async (result) => {
      setSelectedSubscriptionId(result.subscription.id);
      setLastPlanResult(result.plan);
      if (result.plan?.obligations?.[0]?.itemId) {
        setSelectedItemId(String(result.plan.obligations[0].itemId));
      }

      toast.success('Sales order posted and ASC 606 plan generated');
      await Promise.all([
        utils.subscriptions.list.invalidate(),
        utils.revenue.subscriptionPlan.invalidate({ subscriptionId: result.subscription.id }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const generateFromOrderMutation = trpc.salesOrders.generateRevenuePlan.useMutation({
    onSuccess: async (result) => {
      setSelectedSubscriptionId(result.subscription.id);
      setLastPlanResult(result.plan);
      toast.success('ASC 606 plan generated for existing sales order');
      await Promise.all([
        utils.subscriptions.list.invalidate(),
        utils.revenue.subscriptionPlan.invalidate({ subscriptionId: result.subscription.id }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const previewMutation = trpc.subscriptions.previewLicenseChange.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const applyMutation = trpc.subscriptions.applyLicenseChange.useMutation({
    onSuccess: async (result) => {
      setLastPlanResult(result.plan);
      toast.success('License change applied and revenue schedule recalculated');
      await Promise.all([
        utils.revenue.subscriptionPlan.invalidate({ subscriptionId: selectedSubscriptionId }),
        utils.subscriptions.get.invalidate({ id: selectedSubscriptionId }),
        utils.subscriptions.list.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const seedDemoMutation = trpc.revenue.seedSoftwareDemoScenarios.useMutation({
    onSuccess: async (result) => {
      setSeededDemo(result);
      const firstScenario = result?.scenarios?.[0];
      if (firstScenario?.subscriptionId) {
        setSelectedSubscriptionId(String(firstScenario.subscriptionId));
      }
      toast.success('Seeded demo ASC 606 software scenarios');
      await Promise.all([
        utils.revenue.listSoftwareDemoScenarios.invalidate(),
        utils.subscriptions.list.invalidate(),
        utils.subsidiaries.list.invalidate(),
        utils.customers.list.invalidate(),
        utils.items.list.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const existingItems = subscriptionDetailQuery.data?.items || [];

  useEffect(() => {
    if (!selectedItemId && existingItems.length > 0) {
      setSelectedItemId(String(existingItems[0].itemId));
    }
  }, [existingItems, selectedItemId]);

  const plan = useMemo(() => {
    if (lastPlanResult && selectedSubscriptionId && lastPlanResult.subscription?.id === selectedSubscriptionId) {
      return lastPlanResult;
    }
    if (planQuery.data) return planQuery.data;
    if (!selectedSubscriptionId && lastPlanResult) return lastPlanResult;
    return null;
  }, [planQuery.data, lastPlanResult, selectedSubscriptionId]);

  const preview = previewMutation.data;

  const updateLine = (index: number, patch: Partial<LineItemDraft>) => {
    setLineItems((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const applyItemDefaults = (index: number, itemId: string) => {
    const item = itemsById.get(itemId);
    const listPrice = Number(item?.listPrice ?? item?.defaultPrice ?? 0);
    const defaultSsp = Number(item?.defaultSspAmount ?? 0);
    const defaultBehavior = item?.revenueBehavior as 'point_in_time' | 'over_time' | undefined;

    setLineItems((current) =>
      current.map((line, i) =>
        i === index
          ? {
              ...line,
              itemId,
              listPrice: listPrice > 0 ? listPrice : line.listPrice,
              unitPrice: line.unitPrice > 0 ? line.unitPrice : listPrice,
              revenueBehavior: line.revenueBehavior || defaultBehavior,
              sspAmount: line.sspAmount ?? (defaultSsp > 0 ? defaultSsp : undefined),
            }
          : line
      )
    );
  };

  const addLine = () => {
    setLineItems((current) => [
      ...current,
      {
        itemId: items.length > 0 ? String(items[0].id) : '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        revenueBehavior: 'over_time',
        serviceStartDate: orderDate,
        serviceEndDate: '',
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLineItems((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  const createPlan = async () => {
    if (!showContractCreation) return;

    if (!subsidiaryId || !entityId) {
      toast.error('Subsidiary and customer are required');
      return;
    }

    const validLines = lineItems.filter((line) => !!line.itemId && line.quantity > 0);
    if (validLines.length === 0) {
      toast.error('At least one line with item and quantity is required');
      return;
    }

    await createPlanMutation.mutateAsync({
      order: {
        subsidiaryId,
        entityId,
        orderDate: new Date(orderDate),
        currencyCode: 'USD',
        lines: validLines.map((line) => ({
          itemId: line.itemId,
          description: line.description || 'Subscription License',
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          revenueBehavior: line.revenueBehavior,
          sspAmount: line.sspAmount,
          listPrice: line.listPrice ?? line.unitPrice,
          metadata: {
            serviceStartDate: line.serviceStartDate || orderDate,
            serviceEndDate: line.serviceEndDate || undefined,
            revenueBehavior: line.revenueBehavior,
            sspAmount: line.sspAmount,
            listPrice: line.listPrice ?? line.unitPrice,
          },
        })),
      },
      revenuePlan: {
        billingFrequency,
        termMonths,
        autoActivateSubscription: true,
        recognitionEffectiveDate: new Date(orderDate),
      },
    } as any);
  };

  const generateFromExistingOrder = async () => {
    if (!existingSalesOrderId) {
      toast.error('Sales Order ID is required');
      return;
    }

    await generateFromOrderMutation.mutateAsync({
      salesOrderId: existingSalesOrderId,
      revenuePlan: {
        billingFrequency,
        termMonths,
      },
    });
  };

  const runPreview = async () => {
    if (!selectedSubscriptionId || !selectedItemId) {
      toast.error('Select subscription and item first');
      return;
    }

    await previewMutation.mutateAsync({
      subscriptionId: selectedSubscriptionId,
      itemId: selectedItemId,
      action: scenarioAction,
      quantity: scenarioQty,
      unitPrice: scenarioAction === 'add' ? scenarioUnitPrice : undefined,
      effectiveDate: new Date(effectiveDate),
    });
  };

  const applyChange = async () => {
    if (!selectedSubscriptionId || !selectedItemId) {
      toast.error('Select subscription and item first');
      return;
    }

    await applyMutation.mutateAsync({
      subscriptionId: selectedSubscriptionId,
      itemId: selectedItemId,
      action: scenarioAction,
      quantity: scenarioQty,
      unitPrice: scenarioAction === 'add' ? scenarioUnitPrice : undefined,
      effectiveDate: new Date(effectiveDate),
      reason: `UI license ${scenarioAction}`,
    });
  };

  const loadSubscriptionPlan = async (subscriptionId: string, maybePlan?: any) => {
    if (!subscriptionId) return;

    setSelectedSubscriptionId(subscriptionId);
    if (maybePlan) {
      setLastPlanResult(maybePlan);
      if (maybePlan?.obligations?.[0]?.itemId) {
        setSelectedItemId(String(maybePlan.obligations[0].itemId));
      }
    }

    setLoadingPlanForSubscriptionId(subscriptionId);
    try {
      // Force a fresh fetch so the user sees a deterministic result when clicking "Load".
      const fetched = await utils.revenue.subscriptionPlan.fetch({ subscriptionId });
      setLastPlanResult(fetched);
      if (fetched?.obligations?.[0]?.itemId) {
        setSelectedItemId(String(fetched.obligations[0].itemId));
      }
      toast.success('Loaded subscription plan');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load subscription plan');
    } finally {
      setLoadingPlanForSubscriptionId('');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Demo Data (Software Scenarios)</CardTitle>
          <CardDescription>
            Seed typical ASC-606 software cases: prepaid annual, monthly billing, discount with SSP allocation, upsell,
            downsell, and cancellation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => seedDemoMutation.mutate({ forceRecalculate: false })}
              disabled={seedDemoMutation.isPending}
            >
              {seedDemoMutation.isPending ? 'Seeding...' : 'Seed Demo Software Scenarios'}
            </Button>
            <Button
              variant="outline"
              onClick={() => demoScenariosQuery.refetch()}
              disabled={demoScenariosQuery.isFetching}
            >
              Refresh List
            </Button>
          </div>

          {(() => {
            const scenarios = (seededDemo?.scenarios || demoScenariosQuery.data || []) as any[];
            if (!Array.isArray(scenarios) || scenarios.length === 0) {
              return <div className="text-sm text-muted-foreground">No demo scenarios found yet.</div>;
            }

            const labelFromNumber = (n: string) => {
              const map: Record<string, string> = {
                'DEMO-ASC606-PREPAID-ANNUAL-12K': 'Prepaid Annual ($12k) Straight-Line',
                'DEMO-ASC606-BILLED-MONTHLY-12K': 'Monthly Billed ($12k) Straight-Line',
                'DEMO-ASC606-BUNDLE-DISCOUNT-SSP': 'Bundle Discount (SSP Allocation)',
                'DEMO-ASC606-UPSELL-ADD-SEATS': 'Upsell (Add Seats) Mid-Term',
                'DEMO-ASC606-DOWNSELL-REMOVE-SEATS': 'Downsell (Remove Seats) Mid-Term',
                'DEMO-ASC606-CANCELLATION-MIDTERM': 'Cancellation Mid-Term (Prorated)',
              };
              return map[n] || n;
            };

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Scenario</th>
                      <th className="py-2">Subscription</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((row) => {
                      const subscriptionId = String(row.subscriptionId || row.id);
                      const subscriptionNumber = String(row.subscriptionNumber || '');
                      const isLoading = loadingPlanForSubscriptionId === subscriptionId;
                      return (
                        <tr key={subscriptionId} className="border-b">
                          <td className="py-2">{row.label || labelFromNumber(subscriptionNumber)}</td>
                          <td className="py-2 font-mono">{subscriptionNumber || subscriptionId}</td>
                          <td className="py-2">{row.status || 'active'}</td>
                          <td className="py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                              onClick={() => loadSubscriptionPlan(subscriptionId, row.plan)}
                            >
                              {isLoading ? 'Loading...' : 'Load'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {showContractCreation && (
        <Card>
          <CardHeader>
            <CardTitle>Create Sales Order and Generate ASC 606 Plan</CardTitle>
            <CardDescription>
              This posts a sales order through the API and immediately returns obligations, revenue schedule, and
              waterfall.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Subsidiary</div>
                {subsidiaries.length > 0 ? (
                  <Select value={subsidiaryId} onValueChange={setSubsidiaryId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select subsidiary" />
                    </SelectTrigger>
                    <SelectContent>
                      {subsidiaries.map((row) => (
                        <SelectItem key={String(row.id)} value={String(row.id)}>
                          {row.name || row.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={subsidiaryId}
                    onChange={(e) => setSubsidiaryId(e.target.value)}
                    placeholder="Subsidiary ID (UUID)"
                  />
                )}
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Customer</div>
                {customers.length > 0 ? (
                  <Select value={entityId} onValueChange={setEntityId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((row) => (
                        <SelectItem key={String(row.id)} value={String(row.id)}>
                          {row.name || row.companyName || row.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    placeholder="Customer Entity ID (UUID)"
                  />
                )}
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Order Date</div>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Billing Frequency</div>
                <Select value={billingFrequency} onValueChange={(v) => setBillingFrequency(v as BillingFrequency)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-w-[220px] space-y-1">
              <div className="text-xs text-muted-foreground">Contract Term (Months)</div>
              <Input
                type="number"
                min={1}
                max={120}
                value={termMonths}
                onChange={(e) => setTermMonths(Number(e.target.value || 12))}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Line Items</div>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Line
                </Button>
              </div>
              {lineItems.map((line, index) => (
                <div key={index} className="grid gap-2 rounded-md border p-3 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <div className="mb-1 text-xs text-muted-foreground">Item</div>
                    {items.length > 0 ? (
                      <Select value={line.itemId} onValueChange={(v) => applyItemDefaults(index, v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Item" />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((row) => (
                            <SelectItem key={String(row.id)} value={String(row.id)}>
                              {row.itemCode || row.name || row.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={line.itemId}
                        onChange={(e) => updateLine(index, { itemId: e.target.value })}
                        placeholder="Item ID (UUID)"
                      />
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-1 text-xs text-muted-foreground">Description</div>
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder="License seats"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <div className="mb-1 text-xs text-muted-foreground">Qty</div>
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: Number(e.target.value || 0) })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-1 text-xs text-muted-foreground">Unit Price</div>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value || 0) })}
                    />
                    {line.listPrice ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">Item list price: {currency(line.listPrice)}</div>
                    ) : null}
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-1 text-xs text-muted-foreground">Revenue Behavior</div>
                    <Select
                      value={line.revenueBehavior || 'over_time'}
                      onValueChange={(value) => updateLine(index, { revenueBehavior: value as 'point_in_time' | 'over_time' })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="over_time">Over Time</SelectItem>
                        <SelectItem value="point_in_time">Point in Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-1 text-xs text-muted-foreground">SSP Override</div>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.sspAmount ?? ''}
                      onChange={(e) =>
                        updateLine(index, {
                          sspAmount: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="mb-1 text-xs text-muted-foreground">Service Start</div>
                    <Input
                      type="date"
                      value={line.serviceStartDate}
                      onChange={(e) => updateLine(index, { serviceStartDate: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <div className="mb-1 text-xs text-muted-foreground">Service End</div>
                    <Input
                      type="date"
                      value={line.serviceEndDate}
                      onChange={(e) => updateLine(index, { serviceEndDate: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end md:col-span-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      disabled={lineItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={createPlan} disabled={createPlanMutation.isPending}>
                {createPlanMutation.isPending ? 'Creating Plan...' : 'Create Order + Generate Plan'}
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="mb-2 text-sm font-semibold">Generate Plan for Existing Sales Order</div>
              <div className="flex gap-2">
                <Input
                  value={existingSalesOrderId}
                  onChange={(e) => setExistingSalesOrderId(e.target.value)}
                  placeholder="Sales Order ID (UUID)"
                />
                <Button variant="secondary" onClick={generateFromExistingOrder} disabled={generateFromOrderMutation.isPending}>
                  {generateFromOrderMutation.isPending ? 'Generating...' : 'Generate Plan'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{showLicenseWhatIf ? 'Live What-If and License Amendments' : 'Select Subscription Plan'}</CardTitle>
          <CardDescription>
            {showLicenseWhatIf
              ? 'Select any active subscription and preview/apply add/remove license changes.'
              : 'Select an active subscription to inspect obligations, waterfall, and schedule.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Subscription</div>
            <Select value={selectedSubscriptionId} onValueChange={setSelectedSubscriptionId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select subscription" />
              </SelectTrigger>
              <SelectContent>
                {subscriptions.map((s) => (
                  <SelectItem key={String(s.id)} value={String(s.id)}>
                    {s.subscriptionNumber || s.id} ({s.status || 'active'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showLicenseWhatIf ? (
            <>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Item</div>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Item for scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingItems.map((item) => (
                      <SelectItem key={String(item.id)} value={String(item.itemId)}>
                        {String(item.itemId).slice(0, 8)}... qty {item.quantity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Action</div>
                <Select value={scenarioAction} onValueChange={(value) => setScenarioAction(value as ScenarioAction)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add Licenses</SelectItem>
                    <SelectItem value="remove">Remove Licenses</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Effective Date</div>
                <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Quantity Delta</div>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={scenarioQty}
                  onChange={(e) => setScenarioQty(Number(e.target.value || 1))}
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Unit Price (for Add)</div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={scenarioUnitPrice}
                  onChange={(e) => setScenarioUnitPrice(Number(e.target.value || 0))}
                />
              </div>

              <div className="flex items-end gap-2 md:col-span-2">
                <Button onClick={runPreview} disabled={!selectedSubscriptionId || previewMutation.isPending}>
                  Preview Scenario
                </Button>
                <Button variant="secondary" onClick={applyChange} disabled={!selectedSubscriptionId || applyMutation.isPending}>
                  Apply Change
                </Button>
              </div>
            </>
          ) : (
            <div className="md:col-span-3">
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Contract mode: creation and plan-generation controls are above. Select a subscription here to inspect
                live obligation and schedule outputs.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Plan</CardTitle>
            <CardDescription>
              {plan.subscription.subscriptionNumber} | {plan.subscription.startDate} to {plan.subscription.endDate || 'open'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Total Scheduled</div>
              <div className="font-mono text-lg">{currency(plan.summary.totalScheduled)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Total Recognized</div>
              <div className="font-mono text-lg">{currency(plan.summary.totalRecognized)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Total Deferred</div>
              <div className="font-mono text-lg">{currency(plan.summary.totalDeferred)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {plan?.obligations?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Obligations</CardTitle>
            <CardDescription>Live obligations identified and allocated by ASC 606 logic</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Obligation ID</th>
                    <th className="py-2">Item</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Method</th>
                    <th className="py-2">Allocated</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.obligations.map((row: any) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2 font-mono">{row.id}</td>
                      <td className="py-2 font-mono">{row.itemId}</td>
                      <td className="py-2">{row.obligationType}</td>
                      <td className="py-2">{row.satisfactionMethod}</td>
                      <td className="py-2 font-mono">{currency(Number(row.allocatedAmount || 0))}</td>
                      <td className="py-2">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {plan?.allocations?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>SSP Allocation</CardTitle>
            <CardDescription>Allocated transaction price by SSP ratios</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Obligation</th>
                    <th className="py-2 font-mono">Item</th>
                    <th className="py-2 text-right">SSP</th>
                    <th className="py-2 text-right">Allocated</th>
                    <th className="py-2 text-right">%</th>
                    <th className="py-2">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.allocations.map((row: any) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2">{row.obligationType}</td>
                      <td className="py-2 font-mono">{row.itemId}</td>
                      <td className="py-2 text-right font-mono">{currency(Number(row.sspAmount || 0))}</td>
                      <td className="py-2 text-right font-mono">{currency(Number(row.allocatedAmount || 0))}</td>
                      <td className="py-2 text-right font-mono">
                        {row.allocationPercentage === null || row.allocationPercentage === undefined
                          ? '—'
                          : `${(Number(row.allocationPercentage) * 100).toFixed(2)}%`}
                      </td>
                      <td className="py-2">{row.allocationMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {plan?.invoiceSchedule?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice Schedule</CardTitle>
            <CardDescription>Billing schedule derived from billing frequency (demo)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Invoice Date</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.invoiceSchedule.map((row: any) => (
                    <tr key={row.invoiceDate} className="border-b">
                      <td className="py-2 font-mono">{row.invoiceDate}</td>
                      <td className="py-2 text-right font-mono">{currency(Number(row.amount || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showLicenseWhatIf && preview && (
        <Card>
          <CardHeader>
            <CardTitle>What-If Result</CardTitle>
            <CardDescription>Delta after simulated license change</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              Transaction price delta: <span className="font-mono">{currency(preview.delta.transactionPrice)}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Baseline: {currency(preview.baseline.transactionPrice)} | Scenario: {currency(preview.scenario.transactionPrice)}
            </div>
          </CardContent>
        </Card>
      )}

      {plan?.waterfall?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waterfall (Monthly)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Period</th>
                    <th className="py-2">Scheduled</th>
                    <th className="py-2">Recognized</th>
                    <th className="py-2">Deferred Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.waterfall.map((row: any) => (
                    <tr key={row.period} className="border-b">
                      <td className="py-2 font-mono">{row.period}</td>
                      <td className="py-2 font-mono">{currency(row.scheduled)}</td>
                      <td className="py-2 font-mono">{currency(row.recognized)}</td>
                      <td className="py-2 font-mono">{currency(row.deferredBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {plan?.schedules?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue Schedules</CardTitle>
            <CardDescription>First 36 rows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Period Start</th>
                    <th className="py-2">Period End</th>
                    <th className="py-2">Pattern</th>
                    <th className="py-2">Scheduled</th>
                    <th className="py-2">Recognized</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.schedules.slice(0, 36).map((row: any) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2 font-mono">{row.periodStartDate}</td>
                      <td className="py-2 font-mono">{row.periodEndDate}</td>
                      <td className="py-2">{row.recognitionPattern}</td>
                      <td className="py-2 font-mono">{currency(row.scheduledAmount)}</td>
                      <td className="py-2 font-mono">{currency(row.recognizedAmount)}</td>
                      <td className="py-2">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
