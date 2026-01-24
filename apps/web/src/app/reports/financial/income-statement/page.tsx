'use client';

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Download,
  Printer,
  RefreshCw,
  Settings,
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertTriangle,
  FileText,
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
import {
  DimensionFilters,
  type DimensionFilterValues,
} from '@/components/reports/DimensionFilters';
import { PeriodSelector } from '@/components/reports/PeriodSelector';

export default function IncomeStatementPage() {
  const { orgId } = useAuth();
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = React.useState(false);

  // Report parameters
  const [periodId, setPeriodId] = React.useState<string>('');
  const [comparePeriodId, setComparePeriodId] = React.useState<
    string | undefined
  >();
  const [dimensionFilters, setDimensionFilters] =
    React.useState<DimensionFilterValues>({
      subsidiaryId: undefined,
      departmentIds: [],
      classIds: [],
      locationIds: [],
    });
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [includeYTD, setIncludeYTD] = React.useState(true);

  // Query for income statement data
  const {
    data: incomeStatementData,
    isLoading,
    refetch,
    isRefetching,
    error,
  } = trpc.financialStatements.incomeStatement.useQuery(
    {
      periodId,
      comparePeriodId,
      includeYTD,
      subsidiaryId: dimensionFilters.subsidiaryId,
      departmentIds:
        dimensionFilters.departmentIds.length > 0
          ? dimensionFilters.departmentIds
          : undefined,
      classIds:
        dimensionFilters.classIds.length > 0
          ? dimensionFilters.classIds
          : undefined,
      locationIds:
        dimensionFilters.locationIds.length > 0
          ? dimensionFilters.locationIds
          : undefined,
      includeInactive,
    },
    {
      enabled: !!periodId,
    }
  );

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
      toast.success(`Income statement exported as ${data.filename}`);
    },
    onError: (error) => {
      toast.error(`Failed to export: ${error.message}`);
    },
  });

  const handleExport = (format: 'pdf' | 'xlsx' | 'csv' | 'json') => {
    if (!incomeStatementData) {
      toast.error('No report data to export');
      return;
    }
    exportMutation.mutate({
      reportType: 'INCOME_STATEMENT',
      reportData: incomeStatementData,
      format,
      includeComparison: !!comparePeriodId,
    });
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

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

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
        <h1 className="text-3xl font-bold">Income Statement</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsOptionsDialogOpen(true)}
          >
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
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={!incomeStatementData}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={!incomeStatementData || exportMutation.isPending}
              >
                {exportMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
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
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Generating income statement...
              </p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-destructive">
                Failed to load income statement: {error.message}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : incomeStatementData ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {incomeStatementData.reportName}
            </CardTitle>
            <CardDescription>
              {incomeStatementData.periodName} |{' '}
              {incomeStatementData.subsidiaryName}
              <br />
              As of {incomeStatementData.asOfDate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* Revenue Section */}
              <div>
                <h2 className="mb-4 text-xl font-bold">
                  {incomeStatementData.revenueSection.name}
                </h2>
                <Table>
                  <TableBody>
                    {incomeStatementData.revenueSection.lineItems.map(
                      (item) => (
                        <TableRow key={item.accountId}>
                          <TableCell className="pl-8 font-medium">
                            {item.accountNumber} - {item.accountName}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.currentPeriodAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.ytdAmount)}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
                <div className="mt-2 border-t-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">TOTAL REVENUE</span>
                    <span className="text-lg font-bold">
                      {formatCurrency(incomeStatementData.totalRevenue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cost of Goods Sold Section */}
              <div>
                <h2 className="mb-4 text-xl font-bold">
                  {incomeStatementData.cogsSection.name}
                </h2>
                <Table>
                  <TableBody>
                    {incomeStatementData.cogsSection.lineItems.map((item) => (
                      <TableRow key={item.accountId}>
                        <TableCell className="pl-8 font-medium">
                          {item.accountNumber} - {item.accountName}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.currentPeriodAmount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(item.ytdAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-2 border-t-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">
                      TOTAL COST OF GOODS SOLD
                    </span>
                    <span className="text-lg font-bold">
                      {formatCurrency(incomeStatementData.totalCogs)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gross Profit */}
              <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-lg font-bold">GROSS PROFIT</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold">
                      {formatCurrency(incomeStatementData.grossProfit)}
                    </span>
                    <p className="text-sm text-green-600">
                      Margin:{' '}
                      {formatPercentage(incomeStatementData.grossProfitMargin)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Operating Expenses Section */}
              <div>
                <h2 className="mb-4 text-xl font-bold">
                  {incomeStatementData.operatingExpensesSection.name}
                </h2>
                <Table>
                  <TableBody>
                    {incomeStatementData.operatingExpensesSection.lineItems.map(
                      (item) => (
                        <TableRow key={item.accountId}>
                          <TableCell className="pl-8 font-medium">
                            {item.accountNumber} - {item.accountName}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.currentPeriodAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.ytdAmount)}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
                <div className="mt-2 border-t-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">
                      TOTAL OPERATING EXPENSES
                    </span>
                    <span className="text-lg font-bold">
                      {formatCurrency(
                        incomeStatementData.totalOperatingExpenses
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Operating Income */}
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <span className="text-lg font-bold">OPERATING INCOME</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold">
                      {formatCurrency(incomeStatementData.operatingIncome)}
                    </span>
                    <p className="text-sm text-blue-600">
                      Margin:{' '}
                      {formatPercentage(incomeStatementData.operatingMargin)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Net Income */}
              <div className="rounded-lg border-4 border-double border-muted-foreground/30 bg-muted p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {incomeStatementData.netIncome >= 0 ? (
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    )}
                    <span className="text-xl font-bold">NET INCOME</span>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'text-xl font-bold',
                        incomeStatementData.netIncome >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}
                    >
                      {formatCurrency(incomeStatementData.netIncome)}
                    </span>
                    <p
                      className={cn(
                        'text-sm',
                        incomeStatementData.netIncome >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}
                    >
                      Margin:{' '}
                      {formatPercentage(incomeStatementData.netProfitMargin)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-950">
                  <h4 className="font-semibold text-green-700 dark:text-green-300">
                    Gross Profit Margin
                  </h4>
                  <p className="text-2xl font-bold text-green-600">
                    {formatPercentage(incomeStatementData.grossProfitMargin)}
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-950">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300">
                    Operating Margin
                  </h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatPercentage(incomeStatementData.operatingMargin)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-4 text-center">
                  <h4 className="font-semibold text-muted-foreground">
                    Net Margin
                  </h4>
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      incomeStatementData.netProfitMargin >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}
                  >
                    {formatPercentage(incomeStatementData.netProfitMargin)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Income Statement</CardTitle>
            <CardDescription>
              Select a reporting period above to generate the income statement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">
                No report data available.
              </p>
              <p className="text-sm text-muted-foreground">
                Choose a period from the dropdown above to view the income
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
            <DialogTitle>Income Statement Options</DialogTitle>
            <DialogDescription>
              Configure additional options for the income statement report.
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeYTD"
                checked={includeYTD}
                onCheckedChange={(checked) => setIncludeYTD(checked as boolean)}
              />
              <Label htmlFor="includeYTD">Include Year-to-Date totals</Label>
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
