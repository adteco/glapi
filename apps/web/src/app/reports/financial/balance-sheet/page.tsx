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
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Printer,
  RefreshCw,
  Settings,
  Loader2,
  AlertTriangle,
  CheckCircle2,
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

export default function BalanceSheetPage() {
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

  // Query for balance sheet data
  const {
    data: balanceSheetData,
    isLoading,
    refetch,
    isRefetching,
    error,
  } = trpc.financialStatements.balanceSheet.useQuery(
    {
      periodId,
      comparePeriodId,
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
      toast.success(`Balance sheet exported as ${data.filename}`);
    },
    onError: (error) => {
      toast.error(`Failed to export: ${error.message}`);
    },
  });

  const handleExport = (format: 'pdf' | 'xlsx' | 'csv' | 'json') => {
    if (!balanceSheetData) {
      toast.error('No report data to export');
      return;
    }
    exportMutation.mutate({
      reportType: 'BALANCE_SHEET',
      reportData: balanceSheetData,
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

  // Check if balanced (within tolerance)
  const isBalanced = balanceSheetData
    ? Math.abs(balanceSheetData.balanceCheck) < 0.01
    : false;

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
        <h1 className="text-3xl font-bold">Balance Sheet</h1>
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
            disabled={!balanceSheetData}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={!balanceSheetData || exportMutation.isPending}
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
            label="As of Period"
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
                Generating balance sheet...
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
                Failed to load balance sheet: {error.message}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : balanceSheetData ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {balanceSheetData.reportName}
            </CardTitle>
            <CardDescription>
              {balanceSheetData.periodName} | {balanceSheetData.subsidiaryName}
              <br />
              As of {balanceSheetData.asOfDate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* ASSETS */}
              <div>
                <h2 className="mb-4 rounded bg-muted p-2 text-xl font-bold">
                  ASSETS
                </h2>

                {/* Current Assets */}
                <div className="mb-6">
                  <h3 className="mb-2 text-lg font-semibold">
                    {balanceSheetData.currentAssetsSection.name}
                  </h3>
                  <Table>
                    <TableBody>
                      {balanceSheetData.currentAssetsSection.lineItems.map(
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
                  <div className="mt-2 border-t pt-2">
                    <div className="flex items-center justify-between pl-4">
                      <span className="font-semibold">Total Current Assets</span>
                      <span className="font-semibold">
                        {formatCurrency(balanceSheetData.totalCurrentAssets)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Non-Current Assets */}
                <div className="mb-6">
                  <h3 className="mb-2 text-lg font-semibold">
                    {balanceSheetData.nonCurrentAssetsSection.name}
                  </h3>
                  <Table>
                    <TableBody>
                      {balanceSheetData.nonCurrentAssetsSection.lineItems.map(
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
                  <div className="mt-2 border-t pt-2">
                    <div className="flex items-center justify-between pl-4">
                      <span className="font-semibold">
                        Total Non-Current Assets
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(balanceSheetData.totalNonCurrentAssets)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Total Assets */}
                <div className="border-t-2 border-primary pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">TOTAL ASSETS</span>
                    <span className="text-lg font-bold">
                      {formatCurrency(balanceSheetData.totalAssets)}
                    </span>
                  </div>
                </div>
              </div>

              {/* LIABILITIES */}
              <div>
                <h2 className="mb-4 rounded bg-muted p-2 text-xl font-bold">
                  LIABILITIES
                </h2>

                {/* Current Liabilities */}
                <div className="mb-6">
                  <h3 className="mb-2 text-lg font-semibold">
                    {balanceSheetData.currentLiabilitiesSection.name}
                  </h3>
                  <Table>
                    <TableBody>
                      {balanceSheetData.currentLiabilitiesSection.lineItems.map(
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
                  <div className="mt-2 border-t pt-2">
                    <div className="flex items-center justify-between pl-4">
                      <span className="font-semibold">
                        Total Current Liabilities
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(
                          balanceSheetData.totalCurrentLiabilities
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Long-Term Liabilities */}
                <div className="mb-6">
                  <h3 className="mb-2 text-lg font-semibold">
                    {balanceSheetData.longTermLiabilitiesSection.name}
                  </h3>
                  <Table>
                    <TableBody>
                      {balanceSheetData.longTermLiabilitiesSection.lineItems.map(
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
                  <div className="mt-2 border-t pt-2">
                    <div className="flex items-center justify-between pl-4">
                      <span className="font-semibold">
                        Total Long-Term Liabilities
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(
                          balanceSheetData.totalLongTermLiabilities
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Total Liabilities */}
                <div className="border-t-2 border-primary pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">TOTAL LIABILITIES</span>
                    <span className="text-lg font-bold">
                      {formatCurrency(balanceSheetData.totalLiabilities)}
                    </span>
                  </div>
                </div>
              </div>

              {/* EQUITY */}
              <div>
                <h2 className="mb-4 rounded bg-muted p-2 text-xl font-bold">
                  EQUITY
                </h2>

                <div className="mb-6">
                  <h3 className="mb-2 text-lg font-semibold">
                    {balanceSheetData.equitySection.name}
                  </h3>
                  <Table>
                    <TableBody>
                      {balanceSheetData.equitySection.lineItems.map((item) => (
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
                      {/* Retained Earnings */}
                      <TableRow>
                        <TableCell className="pl-8 font-medium">
                          Retained Earnings
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(balanceSheetData.retainedEarnings)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(balanceSheetData.retainedEarnings)}
                        </TableCell>
                      </TableRow>
                      {/* Current Period Net Income */}
                      <TableRow>
                        <TableCell className="pl-8 font-medium">
                          Current Period Net Income
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            balanceSheetData.currentPeriodNetIncome
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(
                            balanceSheetData.currentPeriodNetIncome
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Total Equity */}
                <div className="border-t-2 border-primary pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">TOTAL EQUITY</span>
                    <span className="text-lg font-bold">
                      {formatCurrency(balanceSheetData.totalEquity)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Liabilities and Equity */}
              <div className="rounded-lg border-4 border-double border-muted-foreground/30 bg-muted p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">
                    TOTAL LIABILITIES AND EQUITY
                  </span>
                  <span className="text-xl font-bold">
                    {formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
                  </span>
                </div>
              </div>

              {/* Balance Check */}
              <div className="text-center">
                {isBalanced ? (
                  <Badge
                    variant="default"
                    className="gap-2 bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Balance Sheet is Balanced
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-2 px-4 py-2">
                    <AlertTriangle className="h-4 w-4" />
                    Balance Sheet is NOT Balanced (Difference:{' '}
                    {formatCurrency(balanceSheetData.balanceCheck)})
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Balance Sheet</CardTitle>
            <CardDescription>
              Select a reporting period above to generate the balance sheet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">
                No report data available.
              </p>
              <p className="text-sm text-muted-foreground">
                Choose a period from the dropdown above to view the balance
                sheet.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Options Dialog */}
      <Dialog open={isOptionsDialogOpen} onOpenChange={setIsOptionsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Balance Sheet Options</DialogTitle>
            <DialogDescription>
              Configure additional options for the balance sheet report.
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
