'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/lib/trpc';

// =============================================================================
// Types
// =============================================================================

interface AccountTemplate {
  accountNumber: string;
  accountName: string;
  accountCategory: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';
  description?: string;
  isControlAccount?: boolean;
}

interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  accounts: AccountTemplate[];
}

// =============================================================================
// Industry Templates
// =============================================================================

const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: 'general',
    name: 'General Business',
    description: 'Standard chart of accounts for most businesses',
    icon: '🏢',
    accounts: [
      // Assets
      { accountNumber: '1000', accountName: 'Cash', accountCategory: 'Asset', description: 'Cash on hand' },
      { accountNumber: '1010', accountName: 'Checking Account', accountCategory: 'Asset', description: 'Primary checking account' },
      { accountNumber: '1020', accountName: 'Savings Account', accountCategory: 'Asset', description: 'Savings account' },
      { accountNumber: '1100', accountName: 'Accounts Receivable', accountCategory: 'Asset', description: 'Customer receivables', isControlAccount: true },
      { accountNumber: '1200', accountName: 'Inventory', accountCategory: 'Asset', description: 'Inventory on hand' },
      { accountNumber: '1300', accountName: 'Prepaid Expenses', accountCategory: 'Asset', description: 'Prepaid expenses' },
      { accountNumber: '1500', accountName: 'Property & Equipment', accountCategory: 'Asset', description: 'Fixed assets' },
      { accountNumber: '1550', accountName: 'Accumulated Depreciation', accountCategory: 'Asset', description: 'Contra asset - depreciation' },
      // Liabilities
      { accountNumber: '2000', accountName: 'Accounts Payable', accountCategory: 'Liability', description: 'Vendor payables', isControlAccount: true },
      { accountNumber: '2100', accountName: 'Accrued Liabilities', accountCategory: 'Liability', description: 'Accrued expenses' },
      { accountNumber: '2200', accountName: 'Deferred Revenue', accountCategory: 'Liability', description: 'Unearned revenue' },
      { accountNumber: '2300', accountName: 'Notes Payable', accountCategory: 'Liability', description: 'Short-term notes' },
      { accountNumber: '2500', accountName: 'Long-term Debt', accountCategory: 'Liability', description: 'Long-term obligations' },
      // Equity
      { accountNumber: '3000', accountName: 'Common Stock', accountCategory: 'Equity', description: 'Common stock' },
      { accountNumber: '3100', accountName: 'Retained Earnings', accountCategory: 'Equity', description: 'Retained earnings' },
      { accountNumber: '3200', accountName: 'Owner\'s Equity', accountCategory: 'Equity', description: 'Owner\'s capital' },
      // Revenue
      { accountNumber: '4000', accountName: 'Sales Revenue', accountCategory: 'Revenue', description: 'Product sales' },
      { accountNumber: '4100', accountName: 'Service Revenue', accountCategory: 'Revenue', description: 'Service income' },
      { accountNumber: '4200', accountName: 'Other Income', accountCategory: 'Revenue', description: 'Miscellaneous income' },
      // COGS
      { accountNumber: '5000', accountName: 'Cost of Goods Sold', accountCategory: 'COGS', description: 'Direct costs' },
      { accountNumber: '5100', accountName: 'Direct Labor', accountCategory: 'COGS', description: 'Direct labor costs' },
      { accountNumber: '5200', accountName: 'Direct Materials', accountCategory: 'COGS', description: 'Direct material costs' },
      // Expenses
      { accountNumber: '6000', accountName: 'Salaries & Wages', accountCategory: 'Expense', description: 'Employee compensation' },
      { accountNumber: '6100', accountName: 'Payroll Taxes', accountCategory: 'Expense', description: 'Employer payroll taxes' },
      { accountNumber: '6200', accountName: 'Employee Benefits', accountCategory: 'Expense', description: 'Health insurance, retirement' },
      { accountNumber: '6300', accountName: 'Rent Expense', accountCategory: 'Expense', description: 'Office/facility rent' },
      { accountNumber: '6400', accountName: 'Utilities', accountCategory: 'Expense', description: 'Electric, gas, water' },
      { accountNumber: '6500', accountName: 'Insurance', accountCategory: 'Expense', description: 'Business insurance' },
      { accountNumber: '6600', accountName: 'Office Supplies', accountCategory: 'Expense', description: 'General supplies' },
      { accountNumber: '6700', accountName: 'Professional Fees', accountCategory: 'Expense', description: 'Legal, accounting services' },
      { accountNumber: '6800', accountName: 'Depreciation Expense', accountCategory: 'Expense', description: 'Depreciation of assets' },
      { accountNumber: '6900', accountName: 'Interest Expense', accountCategory: 'Expense', description: 'Interest on debt' },
    ],
  },
  {
    id: 'saas',
    name: 'SaaS / Software',
    description: 'Optimized for subscription-based software companies',
    icon: '💻',
    accounts: [
      // Assets
      { accountNumber: '1000', accountName: 'Cash', accountCategory: 'Asset' },
      { accountNumber: '1010', accountName: 'Operating Account', accountCategory: 'Asset' },
      { accountNumber: '1100', accountName: 'Accounts Receivable', accountCategory: 'Asset', isControlAccount: true },
      { accountNumber: '1150', accountName: 'Unbilled Revenue', accountCategory: 'Asset' },
      { accountNumber: '1200', accountName: 'Prepaid Expenses', accountCategory: 'Asset' },
      { accountNumber: '1300', accountName: 'Deferred Commissions', accountCategory: 'Asset' },
      { accountNumber: '1400', accountName: 'Capitalized Software', accountCategory: 'Asset' },
      { accountNumber: '1450', accountName: 'Accumulated Amortization', accountCategory: 'Asset' },
      // Liabilities
      { accountNumber: '2000', accountName: 'Accounts Payable', accountCategory: 'Liability', isControlAccount: true },
      { accountNumber: '2100', accountName: 'Accrued Liabilities', accountCategory: 'Liability' },
      { accountNumber: '2200', accountName: 'Deferred Revenue', accountCategory: 'Liability', description: 'Subscription prepayments' },
      { accountNumber: '2210', accountName: 'Deferred Revenue - Annual', accountCategory: 'Liability' },
      { accountNumber: '2220', accountName: 'Deferred Revenue - Monthly', accountCategory: 'Liability' },
      { accountNumber: '2300', accountName: 'Customer Deposits', accountCategory: 'Liability' },
      // Equity
      { accountNumber: '3000', accountName: 'Common Stock', accountCategory: 'Equity' },
      { accountNumber: '3100', accountName: 'Retained Earnings', accountCategory: 'Equity' },
      { accountNumber: '3200', accountName: 'APIC', accountCategory: 'Equity', description: 'Additional Paid-in Capital' },
      // Revenue
      { accountNumber: '4000', accountName: 'Subscription Revenue', accountCategory: 'Revenue', description: 'Recurring subscription fees' },
      { accountNumber: '4010', accountName: 'Enterprise Subscription', accountCategory: 'Revenue' },
      { accountNumber: '4020', accountName: 'SMB Subscription', accountCategory: 'Revenue' },
      { accountNumber: '4100', accountName: 'Professional Services', accountCategory: 'Revenue' },
      { accountNumber: '4200', accountName: 'Implementation Revenue', accountCategory: 'Revenue' },
      { accountNumber: '4300', accountName: 'Usage Revenue', accountCategory: 'Revenue', description: 'Overage/usage fees' },
      // COGS
      { accountNumber: '5000', accountName: 'Hosting Costs', accountCategory: 'COGS', description: 'AWS/GCP/Azure' },
      { accountNumber: '5100', accountName: 'Support Costs', accountCategory: 'COGS' },
      { accountNumber: '5200', accountName: 'Third-party Services', accountCategory: 'COGS' },
      // Expenses
      { accountNumber: '6000', accountName: 'Engineering Salaries', accountCategory: 'Expense' },
      { accountNumber: '6100', accountName: 'Sales & Marketing Salaries', accountCategory: 'Expense' },
      { accountNumber: '6200', accountName: 'G&A Salaries', accountCategory: 'Expense' },
      { accountNumber: '6300', accountName: 'Stock Compensation', accountCategory: 'Expense' },
      { accountNumber: '6400', accountName: 'Marketing Expense', accountCategory: 'Expense' },
      { accountNumber: '6500', accountName: 'Sales Commissions', accountCategory: 'Expense' },
      { accountNumber: '6600', accountName: 'Software & Tools', accountCategory: 'Expense' },
      { accountNumber: '6700', accountName: 'Professional Fees', accountCategory: 'Expense' },
      { accountNumber: '6800', accountName: 'Rent & Facilities', accountCategory: 'Expense' },
      { accountNumber: '6900', accountName: 'Travel & Entertainment', accountCategory: 'Expense' },
    ],
  },
  {
    id: 'construction',
    name: 'Construction',
    description: 'Job costing and project-based accounting',
    icon: '🏗️',
    accounts: [
      // Assets
      { accountNumber: '1000', accountName: 'Cash', accountCategory: 'Asset' },
      { accountNumber: '1010', accountName: 'Operating Account', accountCategory: 'Asset' },
      { accountNumber: '1100', accountName: 'Accounts Receivable', accountCategory: 'Asset', isControlAccount: true },
      { accountNumber: '1110', accountName: 'Retention Receivable', accountCategory: 'Asset' },
      { accountNumber: '1120', accountName: 'Unbilled Revenue', accountCategory: 'Asset' },
      { accountNumber: '1200', accountName: 'Materials Inventory', accountCategory: 'Asset' },
      { accountNumber: '1300', accountName: 'Costs in Excess of Billings', accountCategory: 'Asset' },
      { accountNumber: '1400', accountName: 'Equipment', accountCategory: 'Asset' },
      { accountNumber: '1450', accountName: 'Accumulated Depreciation', accountCategory: 'Asset' },
      // Liabilities
      { accountNumber: '2000', accountName: 'Accounts Payable', accountCategory: 'Liability', isControlAccount: true },
      { accountNumber: '2010', accountName: 'Subcontractor Payable', accountCategory: 'Liability' },
      { accountNumber: '2020', accountName: 'Retention Payable', accountCategory: 'Liability' },
      { accountNumber: '2100', accountName: 'Accrued Liabilities', accountCategory: 'Liability' },
      { accountNumber: '2200', accountName: 'Billings in Excess of Costs', accountCategory: 'Liability' },
      { accountNumber: '2300', accountName: 'Equipment Loans', accountCategory: 'Liability' },
      // Equity
      { accountNumber: '3000', accountName: 'Common Stock', accountCategory: 'Equity' },
      { accountNumber: '3100', accountName: 'Retained Earnings', accountCategory: 'Equity' },
      // Revenue
      { accountNumber: '4000', accountName: 'Contract Revenue', accountCategory: 'Revenue' },
      { accountNumber: '4100', accountName: 'Change Order Revenue', accountCategory: 'Revenue' },
      { accountNumber: '4200', accountName: 'T&M Revenue', accountCategory: 'Revenue', description: 'Time & Materials' },
      // COGS
      { accountNumber: '5000', accountName: 'Direct Labor', accountCategory: 'COGS' },
      { accountNumber: '5100', accountName: 'Materials', accountCategory: 'COGS' },
      { accountNumber: '5200', accountName: 'Subcontractor Costs', accountCategory: 'COGS' },
      { accountNumber: '5300', accountName: 'Equipment Costs', accountCategory: 'COGS' },
      { accountNumber: '5400', accountName: 'Other Direct Costs', accountCategory: 'COGS' },
      // Expenses
      { accountNumber: '6000', accountName: 'Office Salaries', accountCategory: 'Expense' },
      { accountNumber: '6100', accountName: 'Insurance', accountCategory: 'Expense' },
      { accountNumber: '6200', accountName: 'Bonding', accountCategory: 'Expense' },
      { accountNumber: '6300', accountName: 'Rent & Utilities', accountCategory: 'Expense' },
      { accountNumber: '6400', accountName: 'Vehicle Expense', accountCategory: 'Expense' },
      { accountNumber: '6500', accountName: 'Professional Fees', accountCategory: 'Expense' },
      { accountNumber: '6600', accountName: 'Depreciation Expense', accountCategory: 'Expense' },
    ],
  },
  {
    id: 'professional_services',
    name: 'Professional Services',
    description: 'Consulting, legal, accounting firms',
    icon: '👔',
    accounts: [
      // Assets
      { accountNumber: '1000', accountName: 'Cash', accountCategory: 'Asset' },
      { accountNumber: '1010', accountName: 'Operating Account', accountCategory: 'Asset' },
      { accountNumber: '1100', accountName: 'Accounts Receivable', accountCategory: 'Asset', isControlAccount: true },
      { accountNumber: '1110', accountName: 'Unbilled Time', accountCategory: 'Asset' },
      { accountNumber: '1120', accountName: 'Work in Progress', accountCategory: 'Asset' },
      { accountNumber: '1200', accountName: 'Prepaid Expenses', accountCategory: 'Asset' },
      // Liabilities
      { accountNumber: '2000', accountName: 'Accounts Payable', accountCategory: 'Liability', isControlAccount: true },
      { accountNumber: '2100', accountName: 'Accrued Liabilities', accountCategory: 'Liability' },
      { accountNumber: '2200', accountName: 'Client Retainers', accountCategory: 'Liability' },
      { accountNumber: '2300', accountName: 'Deferred Revenue', accountCategory: 'Liability' },
      // Equity
      { accountNumber: '3000', accountName: 'Partner Capital', accountCategory: 'Equity' },
      { accountNumber: '3100', accountName: 'Partner Draws', accountCategory: 'Equity' },
      { accountNumber: '3200', accountName: 'Retained Earnings', accountCategory: 'Equity' },
      // Revenue
      { accountNumber: '4000', accountName: 'Professional Fees', accountCategory: 'Revenue' },
      { accountNumber: '4100', accountName: 'Hourly Billing', accountCategory: 'Revenue' },
      { accountNumber: '4200', accountName: 'Fixed Fee Projects', accountCategory: 'Revenue' },
      { accountNumber: '4300', accountName: 'Retainer Revenue', accountCategory: 'Revenue' },
      { accountNumber: '4400', accountName: 'Reimbursable Expenses', accountCategory: 'Revenue' },
      // COGS
      { accountNumber: '5000', accountName: 'Direct Labor', accountCategory: 'COGS' },
      { accountNumber: '5100', accountName: 'Subcontractors', accountCategory: 'COGS' },
      { accountNumber: '5200', accountName: 'Project Expenses', accountCategory: 'COGS' },
      // Expenses
      { accountNumber: '6000', accountName: 'Professional Staff', accountCategory: 'Expense' },
      { accountNumber: '6100', accountName: 'Administrative Staff', accountCategory: 'Expense' },
      { accountNumber: '6200', accountName: 'Rent & Facilities', accountCategory: 'Expense' },
      { accountNumber: '6300', accountName: 'Professional Development', accountCategory: 'Expense' },
      { accountNumber: '6400', accountName: 'Marketing & BD', accountCategory: 'Expense' },
      { accountNumber: '6500', accountName: 'Technology & Software', accountCategory: 'Expense' },
      { accountNumber: '6600', accountName: 'Professional Insurance', accountCategory: 'Expense' },
      { accountNumber: '6700', accountName: 'Travel & Entertainment', accountCategory: 'Expense' },
    ],
  },
];

// =============================================================================
// Category Colors
// =============================================================================

const CATEGORY_COLORS: Record<string, string> = {
  Asset: 'bg-blue-100 text-blue-800',
  Liability: 'bg-red-100 text-red-800',
  Equity: 'bg-purple-100 text-purple-800',
  Revenue: 'bg-green-100 text-green-800',
  COGS: 'bg-orange-100 text-orange-800',
  Expense: 'bg-yellow-100 text-yellow-800',
};

// =============================================================================
// CoA Setup Component
// =============================================================================

interface CoaSetupProps {
  onComplete: (accountCount: number) => void;
  onCancel: () => void;
}

export function CoaSetup({ onComplete, onCancel }: CoaSetupProps) {
  const router = useRouter();
  const [step, setStep] = useState<'choose' | 'review' | 'customize'>('choose');
  const [setupMethod, setSetupMethod] = useState<'template' | 'import' | 'scratch'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const seedMutation = trpc.accounts.seed.useMutation({
    onSuccess: (result) => {
      toast.success(`Created ${result.created} accounts successfully`);
      onComplete(result.created);
    },
    onError: (error) => {
      toast.error(`Failed to create accounts: ${error.message}`);
    },
  });

  const template = INDUSTRY_TEMPLATES.find(t => t.id === selectedTemplate);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tmpl = INDUSTRY_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) {
      // Select all accounts by default
      setSelectedAccounts(new Set(tmpl.accounts.map(a => a.accountNumber)));
    }
  };

  const toggleAccount = (accountNumber: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountNumber)) {
        next.delete(accountNumber);
      } else {
        next.add(accountNumber);
      }
      return next;
    });
  };

  const handleCreateAccounts = async () => {
    if (!template) return;

    setIsSeeding(true);
    try {
      const accountsToCreate = template.accounts
        .filter(a => selectedAccounts.has(a.accountNumber))
        .map(a => ({
          accountNumber: a.accountNumber,
          accountName: a.accountName,
          accountCategory: a.accountCategory,
          description: a.description,
          isControlAccount: a.isControlAccount ?? false,
          isActive: true,
        }));

      await seedMutation.mutateAsync(accountsToCreate);
    } finally {
      setIsSeeding(false);
    }
  };

  // Step 1: Choose setup method
  if (step === 'choose') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Chart of Accounts Setup</h2>
          <p className="text-muted-foreground">
            How would you like to set up your chart of accounts?
          </p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setSetupMethod('template')}
            className={`w-full text-left p-4 border rounded-lg transition-colors ${
              setupMethod === 'template'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'hover:border-primary/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                setupMethod === 'template' ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}>
                {setupMethod === 'template' && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-base font-medium">Start from a template</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose an industry-specific template with pre-configured accounts.
                  You can customize it to fit your needs.
                </p>
                <Badge variant="secondary" className="mt-2">Recommended</Badge>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSetupMethod('import')}
            className={`w-full text-left p-4 border rounded-lg transition-colors ${
              setupMethod === 'import'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'hover:border-primary/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                setupMethod === 'import' ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}>
                {setupMethod === 'import' && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-base font-medium">Import from file</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload a CSV or Excel file with your existing chart of accounts.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSetupMethod('scratch')}
            className={`w-full text-left p-4 border rounded-lg transition-colors ${
              setupMethod === 'scratch'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'hover:border-primary/50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                setupMethod === 'scratch' ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}>
                {setupMethod === 'scratch' && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-base font-medium">Start from scratch</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create accounts manually one by one. Best for unique requirements.
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={onCancel}>
            Back
          </Button>
          <Button
            onClick={() => {
              if (setupMethod === 'template') {
                setStep('review');
              } else if (setupMethod === 'import') {
                router.push('/admin/migration');
              } else {
                router.push('/admin/accounts');
              }
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Select and review template
  if (step === 'review') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Select an Industry Template</h2>
          <p className="text-muted-foreground">
            Choose a template that best matches your business type
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {INDUSTRY_TEMPLATES.map(tmpl => (
            <Card
              key={tmpl.id}
              className={`cursor-pointer transition-all ${
                selectedTemplate === tmpl.id
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => handleSelectTemplate(tmpl.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{tmpl.icon}</span>
                  <CardTitle className="text-lg">{tmpl.name}</CardTitle>
                </div>
                <CardDescription>{tmpl.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {tmpl.accounts.length} accounts
                  </span>
                  {selectedTemplate === tmpl.id && (
                    <Badge variant="default">Selected</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {template && (
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              className="w-full"
            >
              Preview Accounts ({selectedAccounts.size} selected)
            </Button>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={() => setStep('choose')}>
            Back
          </Button>
          <Button
            onClick={() => setStep('customize')}
            disabled={!selectedTemplate}
          >
            Continue
          </Button>
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {template?.name} Template - {selectedAccounts.size} Accounts
              </DialogTitle>
              <DialogDescription>
                Review and select the accounts you want to create
              </DialogDescription>
            </DialogHeader>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-24">Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-32">Category</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {template?.accounts.map(account => (
                  <TableRow key={account.accountNumber}>
                    <TableCell>
                      <Checkbox
                        checked={selectedAccounts.has(account.accountNumber)}
                        onCheckedChange={() => toggleAccount(account.accountNumber)}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{account.accountNumber}</TableCell>
                    <TableCell>{account.accountName}</TableCell>
                    <TableCell>
                      <Badge className={CATEGORY_COLORS[account.accountCategory]}>
                        {account.accountCategory}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {account.description || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Step 3: Customize and create
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Confirm Account Creation</h2>
        <p className="text-muted-foreground">
          Ready to create your chart of accounts from the {template?.name} template
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-4xl">{template?.icon}</span>
            <div>
              <h3 className="text-lg font-semibold">{template?.name}</h3>
              <p className="text-muted-foreground">{selectedAccounts.size} accounts selected</p>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-3 gap-4 text-center">
            {['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense'].map(category => {
              const count = template?.accounts.filter(
                a => selectedAccounts.has(a.accountNumber) && a.accountCategory === category
              ).length ?? 0;
              return (
                <div key={category} className="p-3 rounded-lg bg-muted/50">
                  <Badge className={CATEGORY_COLORS[category]}>{category}</Badge>
                  <p className="text-2xl font-bold mt-2">{count}</p>
                  <p className="text-xs text-muted-foreground">accounts</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">What happens next?</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Your accounts will be created with the selected structure</li>
          <li>• You can add, modify, or remove accounts later</li>
          <li>• Account numbers can be customized after creation</li>
        </ul>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={() => setStep('review')}>
          Back
        </Button>
        <Button
          onClick={handleCreateAccounts}
          disabled={isSeeding || selectedAccounts.size === 0}
        >
          {isSeeding ? 'Creating...' : `Create ${selectedAccounts.size} Accounts`}
        </Button>
      </div>
    </div>
  );
}
