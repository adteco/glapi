'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Plus,
  Calendar,
  Edit,
  Trash,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Wand2,
  ChevronRight,
  ChevronLeft,
  Building2
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format, addMonths, startOfMonth, endOfMonth, startOfYear } from 'date-fns';

// Wizard form schema
const wizardFormSchema = z.object({
  subsidiaryId: z.string().uuid("Please select a subsidiary"),
  fiscalYear: z.string().min(1, "Fiscal year is required"),
  startMonth: z.number().int().min(1).max(12).default(1),
  yearStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  includeAdjustmentPeriod: z.boolean().default(true),
});

type WizardFormValues = z.infer<typeof wizardFormSchema>;

// Manual create form schema
const createFormSchema = z.object({
  subsidiaryId: z.string().uuid("Please select a subsidiary"),
  periodName: z.string().min(1, "Period name is required"),
  fiscalYear: z.string().min(1, "Fiscal year is required"),
  periodNumber: z.number().int().positive("Period number must be positive"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  periodType: z.enum(['MONTH', 'QUARTER', 'YEAR', 'ADJUSTMENT']),
  isAdjustmentPeriod: z.boolean().default(false),
});

type CreateFormValues = z.infer<typeof createFormSchema>;

const statusColors: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  SOFT_CLOSED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  CLOSED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  LOCKED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function AccountingPeriodsPage() {
  const router = useRouter();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const { orgId } = useAuth();
  const previousOrgIdRef = useRef<string | null>(null);

  // tRPC queries
  const { data: periodsData, isLoading, refetch } = trpc.accountingPeriods.list.useQuery(
    { limit: 100, orderBy: 'startDate', orderDirection: 'desc' },
    { enabled: !!orgId }
  );

  const { data: fiscalYearsData } = trpc.accountingPeriods.fiscalYears.useQuery(
    undefined,
    { enabled: !!orgId }
  );

  const { data: subsidiariesData } = trpc.subsidiaries.list.useQuery(
    {},
    { enabled: !!orgId }
  );

  // Mutations
  const createFiscalYearMutation = trpc.accountingPeriods.createFiscalYear.useMutation({
    onSuccess: (data) => {
      toast.success(`Created ${data.length} accounting periods for the fiscal year!`);
      setIsWizardOpen(false);
      setWizardStep(1);
      wizardForm.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create fiscal year periods');
    },
  });

  const createMutation = trpc.accountingPeriods.create.useMutation({
    onSuccess: () => {
      toast.success('Accounting period created successfully!');
      setIsCreateOpen(false);
      createForm.reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create accounting period');
    },
  });

  const softCloseMutation = trpc.accountingPeriods.softClose.useMutation({
    onSuccess: () => {
      toast.success('Period soft-closed successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to soft-close period');
    },
  });

  const closeMutation = trpc.accountingPeriods.close.useMutation({
    onSuccess: () => {
      toast.success('Period closed successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to close period');
    },
  });

  const lockMutation = trpc.accountingPeriods.lock.useMutation({
    onSuccess: () => {
      toast.success('Period locked permanently');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to lock period');
    },
  });

  const reopenMutation = trpc.accountingPeriods.reopen.useMutation({
    onSuccess: () => {
      toast.success('Period reopened successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reopen period');
    },
  });

  const deleteMutation = trpc.accountingPeriods.delete.useMutation({
    onSuccess: () => {
      toast.success('Period deleted successfully');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete period');
    },
  });

  const periods = periodsData?.data || [];
  const fiscalYears = fiscalYearsData || [];
  const subsidiaries = subsidiariesData || [];

  // Forms
  const wizardForm = useForm<WizardFormValues>({
    resolver: zodResolver(wizardFormSchema),
    defaultValues: {
      subsidiaryId: '',
      fiscalYear: new Date().getFullYear().toString(),
      startMonth: 1,
      yearStartDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
      includeAdjustmentPeriod: true,
    },
  });

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      subsidiaryId: '',
      periodName: '',
      fiscalYear: new Date().getFullYear().toString(),
      periodNumber: 1,
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
      periodType: 'MONTH',
      isAdjustmentPeriod: false,
    },
  });

  // Set default subsidiary when loaded
  useEffect(() => {
    if (subsidiaries.length > 0 && !wizardForm.getValues('subsidiaryId')) {
      const firstSubId = subsidiaries[0]?.id;
      if (firstSubId) {
        wizardForm.setValue('subsidiaryId', firstSubId);
        createForm.setValue('subsidiaryId', firstSubId);
      }
    }
  }, [subsidiaries, wizardForm, createForm]);

  // Clear state when organization changes
  useEffect(() => {
    if (orgId && orgId !== previousOrgIdRef.current) {
      previousOrgIdRef.current = orgId;
      wizardForm.reset();
      createForm.reset();
    }
  }, [orgId, wizardForm, createForm]);

  // Generate preview of periods to be created
  const periodPreview = useMemo(() => {
    const startMonth = wizardForm.watch('startMonth');
    const fiscalYear = wizardForm.watch('fiscalYear');
    const yearStartDate = wizardForm.watch('yearStartDate');
    const includeAdjustment = wizardForm.watch('includeAdjustmentPeriod');

    if (!yearStartDate || !fiscalYear) return [];

    const preview = [];
    const startDate = new Date(yearStartDate);

    for (let i = 0; i < 12; i++) {
      const periodStart = addMonths(startDate, i);
      const periodEnd = endOfMonth(periodStart);
      const monthName = format(periodStart, 'MMMM');

      preview.push({
        periodNumber: i + 1,
        name: `${monthName} ${fiscalYear}`,
        startDate: format(periodStart, 'MMM d, yyyy'),
        endDate: format(periodEnd, 'MMM d, yyyy'),
      });
    }

    if (includeAdjustment) {
      const lastPeriodEnd = addMonths(startDate, 11);
      preview.push({
        periodNumber: 13,
        name: `Adjustment Period ${fiscalYear}`,
        startDate: format(endOfMonth(lastPeriodEnd), 'MMM d, yyyy'),
        endDate: format(endOfMonth(lastPeriodEnd), 'MMM d, yyyy'),
      });
    }

    return preview;
  }, [wizardForm.watch('startMonth'), wizardForm.watch('fiscalYear'), wizardForm.watch('yearStartDate'), wizardForm.watch('includeAdjustmentPeriod')]);

  // Handle wizard submission
  const onWizardSubmit = async (values: WizardFormValues) => {
    createFiscalYearMutation.mutate(values);
  };

  // Handle manual create submission
  const onCreateSubmit = async (values: CreateFormValues) => {
    createMutation.mutate(values);
  };

  // Handle status actions
  const handleSoftClose = (id: string) => {
    if (confirm('Soft-close this period? This will prevent normal entries but allow adjustments.')) {
      softCloseMutation.mutate({ id });
    }
  };

  const handleClose = (id: string) => {
    if (confirm('Close this period? This will prevent all entries except flagged adjustments.')) {
      closeMutation.mutate({ id });
    }
  };

  const handleLock = (id: string) => {
    if (confirm('Lock this period permanently? This action cannot be undone.')) {
      lockMutation.mutate({ id });
    }
  };

  const handleReopen = (id: string) => {
    if (confirm('Reopen this period? This will allow normal entries again.')) {
      reopenMutation.mutate({ id });
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate({ id });
    }
  };

  // Filter periods by selected year
  const filteredPeriods = selectedYear
    ? periods.filter(p => p.fiscalYear === selectedYear)
    : periods;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Accounting Periods</h1>
          </div>
          <div className="flex gap-2">
            {/* Wizard Button */}
            <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Setup Fiscal Year
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                  <DialogTitle>
                    {wizardStep === 1 ? 'Setup Fiscal Year Periods' : 'Review & Confirm'}
                  </DialogTitle>
                  <DialogDescription>
                    {wizardStep === 1
                      ? 'Automatically create 12 monthly accounting periods for your fiscal year.'
                      : 'Review the periods that will be created.'}
                  </DialogDescription>
                </DialogHeader>

                <Form {...wizardForm}>
                  <form onSubmit={wizardForm.handleSubmit(onWizardSubmit)}>
                    {wizardStep === 1 && (
                      <div className="space-y-4 py-4">
                        {subsidiaries.length > 1 && (
                          <FormField
                            control={wizardForm.control}
                            name="subsidiaryId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Subsidiary</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select subsidiary" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {subsidiaries.filter((s) => s.id).map((sub) => (
                                      <SelectItem key={sub.id} value={sub.id!}>
                                        {sub.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={wizardForm.control}
                            name="fiscalYear"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fiscal Year</FormLabel>
                                <FormControl>
                                  <Input placeholder="2024" {...field} />
                                </FormControl>
                                <FormDescription>The fiscal year label (e.g., 2024)</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={wizardForm.control}
                            name="startMonth"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Starting Month</FormLabel>
                                <Select
                                  onValueChange={(v) => field.onChange(parseInt(v))}
                                  value={field.value.toString()}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select month" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {months.map((month) => (
                                      <SelectItem key={month.value} value={month.value.toString()}>
                                        {month.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormDescription>First month of your fiscal year</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={wizardForm.control}
                          name="yearStartDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Year Start Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormDescription>The exact start date of the fiscal year</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={wizardForm.control}
                          name="includeAdjustmentPeriod"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Include Adjustment Period</FormLabel>
                                <FormDescription>
                                  Add a 13th period for year-end adjustments
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {wizardStep === 2 && (
                      <div className="py-4">
                        <div className="rounded-md border max-h-[400px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-16">#</TableHead>
                                <TableHead>Period Name</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {periodPreview.map((period) => (
                                <TableRow key={period.periodNumber}>
                                  <TableCell className="font-medium">{period.periodNumber}</TableCell>
                                  <TableCell>{period.name}</TableCell>
                                  <TableCell>{period.startDate}</TableCell>
                                  <TableCell>{period.endDate}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <p className="text-sm text-muted-foreground mt-4">
                          {periodPreview.length} periods will be created with status "OPEN".
                        </p>
                      </div>
                    )}

                    <DialogFooter className="gap-2">
                      {wizardStep === 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setWizardStep(1)}
                        >
                          <ChevronLeft className="mr-2 h-4 w-4" />
                          Back
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsWizardOpen(false);
                          setWizardStep(1);
                          wizardForm.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      {wizardStep === 1 ? (
                        <Button
                          type="button"
                          onClick={async () => {
                            const isValid = await wizardForm.trigger();
                            if (isValid) setWizardStep(2);
                          }}
                        >
                          Preview
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <Button type="submit" disabled={createFiscalYearMutation.isPending}>
                          {createFiscalYearMutation.isPending ? 'Creating...' : 'Create Periods'}
                        </Button>
                      )}
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Manual Add Button */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Period
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Accounting Period</DialogTitle>
                  <DialogDescription>
                    Manually create a single accounting period.
                  </DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                    {subsidiaries.length > 1 && (
                      <FormField
                        control={createForm.control}
                        name="subsidiaryId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subsidiary</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select subsidiary" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {subsidiaries.filter((s) => s.id).map((sub) => (
                                  <SelectItem key={sub.id} value={sub.id!}>
                                    {sub.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="periodName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Period Name</FormLabel>
                            <FormControl>
                              <Input placeholder="January 2024" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="fiscalYear"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fiscal Year</FormLabel>
                            <FormControl>
                              <Input placeholder="2024" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="periodNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Period Number</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="periodType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Period Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="MONTH">Month</SelectItem>
                                <SelectItem value="QUARTER">Quarter</SelectItem>
                                <SelectItem value="YEAR">Year</SelectItem>
                                <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={createForm.control}
                      name="isAdjustmentPeriod"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Adjustment Period</FormLabel>
                            <FormDescription>
                              Mark as adjustment period for year-end entries
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsCreateOpen(false);
                          createForm.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'Creating...' : 'Create'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <p className="text-muted-foreground">
          Manage accounting periods to control when transactions can be posted to your general ledger.
        </p>
      </div>

      {/* Fiscal Year Filter */}
      {fiscalYears.length > 0 && (
        <div className="mb-6 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter by fiscal year:</span>
          <div className="flex gap-1">
            <Button
              variant={selectedYear === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedYear(null)}
            >
              All
            </Button>
            {fiscalYears.map((year) => (
              <Button
                key={year}
                variant={selectedYear === year ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedYear(year)}
              >
                {year}
              </Button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10">Loading accounting periods...</div>
      ) : periods.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent className="pt-6">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Accounting Periods</h3>
            <p className="text-muted-foreground mb-4">
              Get started by setting up your fiscal year periods using the wizard.
            </p>
            <Button onClick={() => setIsWizardOpen(true)}>
              <Wand2 className="mr-2 h-4 w-4" />
              Setup Fiscal Year
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableCaption>A list of all accounting periods in your organization.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Fiscal Year</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPeriods.map((period) => (
              <TableRow key={period.id}>
                <TableCell className="font-medium">{period.periodName}</TableCell>
                <TableCell>{period.fiscalYear}</TableCell>
                <TableCell>{format(new Date(period.startDate), 'MMM d, yyyy')}</TableCell>
                <TableCell>{format(new Date(period.endDate), 'MMM d, yyyy')}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {period.periodType}
                    {period.isAdjustmentPeriod && ' (Adj)'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[period.status] || ''}>
                    {period.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {period.status === 'OPEN' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSoftClose(period.id)}
                          title="Soft Close"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(period.id, period.periodName)}
                          title="Delete"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {period.status === 'SOFT_CLOSED' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReopen(period.id)}
                          title="Reopen"
                        >
                          <Unlock className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClose(period.id)}
                          title="Close"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {period.status === 'CLOSED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLock(period.id)}
                        title="Lock Permanently"
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                    )}
                    {period.status === 'LOCKED' && (
                      <span className="text-xs text-muted-foreground px-2">Locked</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
