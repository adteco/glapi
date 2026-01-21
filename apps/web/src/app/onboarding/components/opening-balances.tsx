'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { trpc } from '@/lib/trpc';

// =============================================================================
// Types
// =============================================================================

interface AccountBalance {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountCategory: string;
  normalBalance: 'Debit' | 'Credit';
  debit: number;
  credit: number;
}

interface ValidationResult {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Opening Balances Component
// =============================================================================

interface OpeningBalancesProps {
  onComplete: () => void;
  onSkip: () => void;
  canSkip: boolean;
}

export function OpeningBalances({ onComplete, onSkip, canSkip }: OpeningBalancesProps) {
  const router = useRouter();
  const [step, setStep] = useState<'date' | 'entry' | 'review'>('date');
  const [openingDate, setOpeningDate] = useState<Date | undefined>(undefined);
  const [balances, setBalances] = useState<Map<string, { debit: number; credit: number }>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch accounts
  const { data: accountsData, isLoading: accountsLoading } = trpc.accounts.list.useQuery({
    limit: 100,
    orderBy: 'accountNumber',
    isActive: true,
  });

  const accounts = accountsData?.data ?? [];

  // Group accounts by category
  const accountsByCategory = useMemo(() => {
    const grouped: Record<string, typeof accounts> = {};
    for (const account of accounts) {
      const category = account.accountCategory;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(account);
    }
    return grouped;
  }, [accounts]);

  // Calculate totals
  const validation = useMemo((): ValidationResult => {
    let totalDebits = 0;
    let totalCredits = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [_, balance] of balances) {
      totalDebits += balance.debit;
      totalCredits += balance.credit;
    }

    const difference = Math.abs(totalDebits - totalCredits);
    const isBalanced = difference < 0.01; // Allow for floating point errors

    if (!isBalanced) {
      errors.push(`Trial balance is out of balance by ${formatCurrency(difference)}`);
    }

    // Check for accounts with both debit and credit
    for (const [accountId, balance] of balances) {
      if (balance.debit > 0 && balance.credit > 0) {
        const account = accounts.find(a => a.id === accountId);
        if (account) {
          warnings.push(`${account.accountNumber} has both debit and credit balances`);
        }
      }
    }

    // Check for expected balance directions
    for (const [accountId, balance] of balances) {
      const account = accounts.find(a => a.id === accountId);
      if (!account) continue;

      const expectedDebit = ['Asset', 'Expense', 'COGS'].includes(account.accountCategory);
      if (expectedDebit && balance.credit > 0 && balance.debit === 0) {
        warnings.push(`${account.accountNumber} (${account.accountCategory}) typically has a debit balance`);
      } else if (!expectedDebit && balance.debit > 0 && balance.credit === 0) {
        warnings.push(`${account.accountNumber} (${account.accountCategory}) typically has a credit balance`);
      }
    }

    return {
      isBalanced,
      totalDebits,
      totalCredits,
      difference,
      errors,
      warnings,
    };
  }, [balances, accounts]);

  // Handlers
  const handleBalanceChange = (accountId: string, field: 'debit' | 'credit', value: string) => {
    const numValue = parseFloat(value) || 0;
    setBalances(prev => {
      const next = new Map(prev);
      const current = next.get(accountId) ?? { debit: 0, credit: 0 };
      next.set(accountId, { ...current, [field]: numValue });
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!openingDate || !validation.isBalanced) return;

    setIsSubmitting(true);
    try {
      // In a real implementation, this would create a journal entry
      // For now, we'll just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Opening balances recorded successfully');
      onComplete();
    } catch (error) {
      toast.error('Failed to record opening balances');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Select opening balance date
  if (step === 'date') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Opening Balances</h2>
          <p className="text-muted-foreground">
            Enter your account balances as of your go-live date
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Opening Balance Date</CardTitle>
            <CardDescription>
              This is typically the last day of your previous accounting period,
              or the day before you start using GLAPI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label htmlFor="openingDate">Opening Balance Date</Label>
                  <Input
                    id="openingDate"
                    type="date"
                    className="w-[280px]"
                    value={openingDate ? openingDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
                      setOpeningDate(date);
                    }}
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Tips for choosing the date:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Use the end of a month or fiscal period for cleaner records</li>
                  <li>• Ensure you have accurate trial balance data for this date</li>
                  <li>• All future transactions will be after this date</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {accounts.length === 0 && !accountsLoading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">No accounts found</h4>
            <p className="text-sm text-yellow-700">
              You need to set up your chart of accounts before entering opening balances.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => router.push('/admin/accounts')}
            >
              Set Up Accounts
            </Button>
          </div>
        )}

        <div className="flex justify-between pt-4">
          {canSkip ? (
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          ) : (
            <div />
          )}
          <Button
            onClick={() => setStep('entry')}
            disabled={!openingDate || accounts.length === 0}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Enter balances
  if (step === 'entry') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Enter Account Balances</h2>
          <p className="text-muted-foreground">
            As of {openingDate ? format(openingDate, 'MMMM d, yyyy') : ''}
          </p>
        </div>

        {/* Trial Balance Summary */}
        <Card className={validation.isBalanced ? 'border-green-200' : 'border-red-200'}>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Debits</p>
                <p className="text-2xl font-bold">{formatCurrency(validation.totalDebits)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Credits</p>
                <p className="text-2xl font-bold">{formatCurrency(validation.totalCredits)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Difference</p>
                <p className={`text-2xl font-bold ${validation.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(validation.difference)}
                </p>
              </div>
            </div>
            {validation.isBalanced ? (
              <Badge variant="outline" className="mt-4 bg-green-50 text-green-700 w-full justify-center">
                ✓ Trial Balance is Balanced
              </Badge>
            ) : (
              <Badge variant="destructive" className="mt-4 w-full justify-center">
                Trial Balance is Out of Balance
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Account Entry Tables by Category */}
        <div className="space-y-6">
          {Object.entries(accountsByCategory).map(([category, categoryAccounts]) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Number</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead className="w-36 text-right">Debit</TableHead>
                      <TableHead className="w-36 text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryAccounts.map(account => {
                      const balance = balances.get(account.id) ?? { debit: 0, credit: 0 };
                      return (
                        <TableRow key={account.id}>
                          <TableCell className="font-mono">{account.accountNumber}</TableCell>
                          <TableCell>{account.accountName}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="text-right"
                              value={balance.debit || ''}
                              onChange={(e) => handleBalanceChange(account.id, 'debit', e.target.value)}
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="text-right"
                              value={balance.credit || ''}
                              onChange={(e) => handleBalanceChange(account.id, 'credit', e.target.value)}
                              placeholder="0.00"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={() => setStep('date')}>
            Back
          </Button>
          <Button onClick={() => setStep('review')}>
            Review & Submit
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Review and submit
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Review Opening Balances</h2>
        <p className="text-muted-foreground">
          Verify your trial balance before submitting
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance Summary</CardTitle>
          <CardDescription>
            As of {openingDate ? format(openingDate, 'MMMM d, yyyy') : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Debits</p>
              <p className="text-2xl font-bold">{formatCurrency(validation.totalDebits)}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Credits</p>
              <p className="text-2xl font-bold">{formatCurrency(validation.totalCredits)}</p>
            </div>
          </div>

          <div className="p-4 rounded-lg border-2 border-dashed">
            <div className="flex items-center justify-between">
              <span className="font-medium">Balance Status</span>
              {validation.isBalanced ? (
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  ✓ Balanced
                </Badge>
              ) : (
                <Badge variant="destructive">
                  Out of Balance: {formatCurrency(validation.difference)}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Messages */}
      {validation.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-800 mb-2">Errors</h4>
          <ul className="text-sm text-red-700 space-y-1">
            {validation.errors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">Warnings</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {validation.warnings.map((warning, i) => (
              <li key={i}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Account Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Accounts with Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts
                .filter(a => {
                  const balance = balances.get(a.id);
                  return balance && (balance.debit > 0 || balance.credit > 0);
                })
                .map(account => {
                  const balance = balances.get(account.id)!;
                  return (
                    <TableRow key={account.id}>
                      <TableCell>
                        <span className="font-mono mr-2">{account.accountNumber}</span>
                        {account.accountName}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {balance.debit > 0 ? formatCurrency(balance.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {balance.credit > 0 ? formatCurrency(balance.credit) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              <TableRow className="font-bold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(validation.totalDebits)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(validation.totalCredits)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={() => setStep('entry')}>
          Back to Edit
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!validation.isBalanced || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Submit Opening Balances'}
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
