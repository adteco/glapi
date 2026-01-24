'use client';

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Printer,
  RefreshCw,
  Settings,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DimensionFilters, type DimensionFilterValues } from '@/components/reports/DimensionFilters';
import { PeriodSelector } from '@/components/reports/PeriodSelector';

// Type for a cash flow section
interface CashFlowSection {
  title: string;
  items: Array<{
    id: string;
    description: string;
    amount: number;
    isInflow: boolean;
  }>;
  netCashFlow: number;
}

// Type for the full cash flow statement
interface CashFlowStatementData {
  reportPeriod: string;
  startDate: string;
  endDate: string;
  beginningCash: number;
  operatingActivities: CashFlowSection;
  investingActivities: CashFlowSection;
  financingActivities: CashFlowSection;
  netCashFlowForPeriod: number;
  endingCash: number;
  cashFlowTrend: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  reconciliationDifference?: number;
}

export default function CashFlowStatementPage() {
  const { orgId } = useAuth();
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = React.useState(false);

  // Report parameters
  const [periodId, setPeriodId] = React.useState<string>('');
  const [comparePeriodId, setComparePeriodId] = React.useState<string | undefined>();
  const [dimensionFilters, setDimensionFilters] = React.useState<DimensionFilterValues>({
    subsidiaryId: undefined,
    departmentIds: [],
    classIds: [],
    locationIds: [],
  });
  const [includeInactive, setIncludeInactive] = React.useState(false);

  // Query for cash flow statement data
  const {
    data: cashFlowData,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.financialStatements.cashFlowStatement.useQuery(
    {
      periodId,
      comparePeriodId,
      subsidiaryId: dimensionFilters.subsidiaryId,
      departmentIds: dimensionFilters.departmentIds.length > 0 ? dimensionFilters.departmentIds : undefined,
      classIds: dimensionFilters.classIds.length > 0 ? dimensionFilters.classIds : undefined,
      locationIds: dimensionFilters.locationIds.length > 0 ? dimensionFilters.locationIds : undefined,
      includeInactive,
    },
    {
      enabled: !!periodId,
    }
  );

  // Transform the API response to our display format
  const displayData = React.useMemo((): CashFlowStatementData | null => {
    if (!cashFlowData) return null;

    // Helper to transform line items from API to display format
    const transformLineItems = (section: typeof cashFlowData.operatingActivities) =>
      (section?.lineItems || []).map((item, index) => ({
        id: item.accountId || `item-${index}`,
        description: item.isSubtotal ? `Subtotal: ${item.description}` : item.description,
        amount: item.amount,
        isInflow: item.amount >= 0,
      }));

    return {
      reportPeriod: cashFlowData.periodName || 'Unknown Period',
      startDate: cashFlowData.periodStartDate || '',
      endDate: cashFlowData.periodEndDate || '',
      beginningCash: cashFlowData.beginningCashBalance || 0,
      operatingActivities: {
        title: 'CASH FLOWS FROM OPERATING ACTIVITIES',
        items: transformLineItems(cashFlowData.operatingActivities),
        netCashFlow: cashFlowData.operatingActivities?.sectionTotal || cashFlowData.netCashFromOperations || 0,
      },
      investingActivities: {
        title: 'CASH FLOWS FROM INVESTING ACTIVITIES',
        items: transformLineItems(cashFlowData.investingActivities),
        netCashFlow: cashFlowData.investingActivities?.sectionTotal || cashFlowData.netCashFromInvesting || 0,
      },
      financingActivities: {
        title: 'CASH FLOWS FROM FINANCING ACTIVITIES',
        items: transformLineItems(cashFlowData.financingActivities),
        netCashFlow: cashFlowData.financingActivities?.sectionTotal || cashFlowData.netCashFromFinancing || 0,
      },
      netCashFlowForPeriod: cashFlowData.netChangeInCash || 0,
      endingCash: cashFlowData.endingCashBalance || 0,
      cashFlowTrend: cashFlowData.cashFlowTrend || 'NEUTRAL',
      reconciliationDifference: cashFlowData.reconciliationDifference,
    };
  }, [cashFlowData]);

  // Export mutation
  const exportMutation = trpc.financialStatements.export.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and download
      const binaryString = atob(data.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Cash flow statement exported as ${data.filename}`);
    },
    onError: (error) => {
      toast.error(`Failed to export: ${error.message}`);
    },
  });

  const handleExport = (format: 'pdf' | 'xlsx' | 'csv' | 'json') => {
    if (!cashFlowData) {
      toast.error('No report data to export');
      return;
    }
    // Note: Cash flow export not yet implemented on backend
    toast.info('Cash flow statement export coming soon');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRefresh = () => {
    refetch();
    toast.success('Report refreshed');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const renderCashFlowSection = (section: CashFlowSection) => (
    <div className="mb-8">
      <h3 className="mb-4 text-lg font-semibold">{section.title}</h3>
      <Table>
        <TableBody>
          {section.items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={2}
                className="py-4 text-center text-muted-foreground"
              >
                No transactions in this category
              </TableCell>
            </TableRow>
          ) : (
            section.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="flex items-center gap-2 pl-8 font-medium">
                  {item.isInflow ? (
                    <ArrowUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-red-600" />
                  )}
                  {item.description}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right',
                    item.isInflow ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {formatCurrency(Math.abs(item.amount))}
                </TableCell>
              </TableRow>
            ))
          )}
          <TableRow className="border-t-2 bg-muted/50">
            <TableCell className="font-bold">
              Net Cash Flow from {section.title.split(' ').pop()}
            </TableCell>
            <TableCell
              className={cn(
                'text-right font-bold',
                section.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {formatCurrency(section.netCashFlow)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  if (!orgId) {
    return (
      <div className="container mx-auto py-10">
        <p>Please select an organization to view reports.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cash Flow Statement</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsOptionsDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Options
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefetching || !periodId}
          >
            {isRefetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!displayData}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!displayData}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="mr-2 h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                <FileText className="mr-2 h-4 w-4" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="mr-2 h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Period and Dimension Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Report Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PeriodSelector
            value={periodId}
            onChange={setPeriodId}
            compareValue={comparePeriodId}
            onCompareChange={setComparePeriodId}
            showCompare={true}
            label="Reporting Period"
          />
          <DimensionFilters
            value={dimensionFilters}
            onChange={setDimensionFilters}
            compact
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            <span>Loading cash flow statement...</span>
          </CardContent>
        </Card>
      ) : displayData ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Cash Flow Statement</CardTitle>
            <CardDescription>
              For the period{' '}
              {new Date(displayData.startDate).toLocaleDateString()} to{' '}
              {new Date(displayData.endDate).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Beginning Cash Balance */}
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">
                    Beginning Cash Balance
                  </span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(displayData.beginningCash)}
                  </span>
                </div>
              </div>

              {/* Operating Activities */}
              {renderCashFlowSection(displayData.operatingActivities)}

              {/* Investing Activities */}
              {renderCashFlowSection(displayData.investingActivities)}

              {/* Financing Activities */}
              {renderCashFlowSection(displayData.financingActivities)}

              {/* Net Cash Flow for Period */}
              <div className="rounded-lg border-2 border-border bg-muted p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {displayData.netCashFlowForPeriod >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    )}
                    <span className="text-lg font-bold">
                      Net Cash Flow for Period
                    </span>
                  </div>
                  <span
                    className={cn(
                      'text-lg font-bold',
                      displayData.netCashFlowForPeriod >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}
                  >
                    {formatCurrency(displayData.netCashFlowForPeriod)}
                  </span>
                </div>
              </div>

              {/* Ending Cash Balance */}
              <div className="rounded-lg border-4 border-double border-green-300 bg-green-50 p-6 dark:border-green-700 dark:bg-green-950">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">Ending Cash Balance</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(displayData.endingCash)}
                  </span>
                </div>
              </div>

              {/* Reconciliation Warning */}
              {displayData.reconciliationDifference !== undefined &&
                Math.abs(displayData.reconciliationDifference) > 0.01 && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Note:</strong> There is a reconciliation difference
                      of {formatCurrency(displayData.reconciliationDifference)}.
                      This may indicate unclassified transactions.
                    </p>
                  </div>
                )}

              {/* Cash Flow Analysis */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div
                  className={cn(
                    'rounded-lg p-4 text-center',
                    displayData.operatingActivities.netCashFlow >= 0
                      ? 'bg-green-50 dark:bg-green-950'
                      : 'bg-red-50 dark:bg-red-950'
                  )}
                >
                  <h4
                    className={cn(
                      'font-semibold',
                      displayData.operatingActivities.netCashFlow >= 0
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    )}
                  >
                    Operating Cash Flow
                  </h4>
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      displayData.operatingActivities.netCashFlow >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}
                  >
                    {formatCurrency(displayData.operatingActivities.netCashFlow)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {displayData.operatingActivities.netCashFlow >= 0
                      ? 'Positive operations'
                      : 'Negative operations'}
                  </p>
                </div>
                <div
                  className={cn(
                    'rounded-lg p-4 text-center',
                    displayData.investingActivities.netCashFlow >= 0
                      ? 'bg-green-50 dark:bg-green-950'
                      : 'bg-red-50 dark:bg-red-950'
                  )}
                >
                  <h4
                    className={cn(
                      'font-semibold',
                      displayData.investingActivities.netCashFlow >= 0
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    )}
                  >
                    Investing Cash Flow
                  </h4>
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      displayData.investingActivities.netCashFlow >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}
                  >
                    {formatCurrency(displayData.investingActivities.netCashFlow)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {displayData.investingActivities.netCashFlow >= 0
                      ? 'Asset sales'
                      : 'Asset purchases'}
                  </p>
                </div>
                <div
                  className={cn(
                    'rounded-lg p-4 text-center',
                    displayData.financingActivities.netCashFlow >= 0
                      ? 'bg-green-50 dark:bg-green-950'
                      : 'bg-red-50 dark:bg-red-950'
                  )}
                >
                  <h4
                    className={cn(
                      'font-semibold',
                      displayData.financingActivities.netCashFlow >= 0
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    )}
                  >
                    Financing Cash Flow
                  </h4>
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      displayData.financingActivities.netCashFlow >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}
                  >
                    {formatCurrency(displayData.financingActivities.netCashFlow)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {displayData.financingActivities.netCashFlow >= 0
                      ? 'Capital raised'
                      : 'Capital returned'}
                  </p>
                </div>
              </div>

              {/* Cash Flow Trend Indicator */}
              <div className="text-center">
                <Badge
                  variant={
                    displayData.cashFlowTrend === 'POSITIVE'
                      ? 'default'
                      : displayData.cashFlowTrend === 'NEGATIVE'
                        ? 'destructive'
                        : 'secondary'
                  }
                  className="px-4 py-2 text-lg"
                >
                  {displayData.cashFlowTrend === 'POSITIVE'
                    ? 'Positive Cash Flow Trend'
                    : displayData.cashFlowTrend === 'NEGATIVE'
                      ? 'Negative Cash Flow Trend'
                      : 'Neutral Cash Flow Trend'}
                </Badge>
              </div>

              {/* Summary Box */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="mb-2 font-semibold">Cash Flow Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Cash Change:</span>
                    <p
                      className={cn(
                        displayData.endingCash - displayData.beginningCash >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}
                    >
                      {formatCurrency(
                        displayData.endingCash - displayData.beginningCash
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Cash Growth Rate:</span>
                    <p
                      className={cn(
                        displayData.endingCash - displayData.beginningCash >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}
                    >
                      {displayData.beginningCash !== 0
                        ? (
                            ((displayData.endingCash - displayData.beginningCash) /
                              displayData.beginningCash) *
                            100
                          ).toFixed(1)
                        : 'N/A'}
                      %
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Statement</CardTitle>
            <CardDescription>
              Select a reporting period above to generate the cash flow statement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">No report data available.</p>
              <p className="text-sm text-muted-foreground">
                Choose a period from the dropdown above to view the cash flow
                statement.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Options Dialog */}
      <Dialog open={isOptionsDialogOpen} onOpenChange={setIsOptionsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cash Flow Statement Options</DialogTitle>
            <DialogDescription>
              Configure additional options for the cash flow statement report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeInactive"
                checked={includeInactive}
                onCheckedChange={(checked) =>
                  setIncludeInactive(checked as boolean)
                }
              />
              <Label htmlFor="includeInactive">Include inactive accounts</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOptionsDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
