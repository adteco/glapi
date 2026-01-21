'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useOnboardingAnalytics, type OnboardingStepKey } from '@/hooks/use-onboarding-analytics';

// =============================================================================
// Types
// =============================================================================

interface HelpTopic {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
  docLink?: string;
}

// =============================================================================
// Help Content Data
// =============================================================================

const HELP_TOPICS: Record<string, HelpTopic[]> = {
  welcome: [
    {
      id: 'what-is-glapi',
      title: 'What is GLAPI?',
      description: 'Learn about the core features',
      content: (
        <div className="space-y-4">
          <p>
            GLAPI (General Ledger API) is a modern accounting platform that provides:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Double-Entry Accounting</strong> - Full journal entry support with automatic balancing</li>
            <li><strong>Multi-Entity Support</strong> - Manage multiple subsidiaries and departments</li>
            <li><strong>Revenue Recognition</strong> - ASC 606 compliant revenue tracking</li>
            <li><strong>Real-time Reporting</strong> - Financial statements and analytics</li>
            <li><strong>API-First Design</strong> - Integrate with your existing systems</li>
          </ul>
        </div>
      ),
      docLink: '/docs/getting-started',
    },
    {
      id: 'onboarding-overview',
      title: 'Onboarding Overview',
      description: 'What to expect during setup',
      content: (
        <div className="space-y-4">
          <p>This wizard will guide you through setting up your accounting system:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Organization</strong> - Configure your company structure</li>
            <li><strong>Chart of Accounts</strong> - Set up your account categories</li>
            <li><strong>Opening Balances</strong> - Enter starting account values</li>
            <li><strong>Integrations</strong> - Connect external services</li>
          </ol>
          <p className="text-muted-foreground">
            You can skip any step and complete it later from Settings.
          </p>
        </div>
      ),
    },
  ],
  organization: [
    {
      id: 'org-structure',
      title: 'Organization Structure',
      description: 'Understanding subsidiaries and departments',
      content: (
        <div className="space-y-4">
          <p>GLAPI supports hierarchical organization structures:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Subsidiaries</strong> - Separate legal entities under your organization</li>
            <li><strong>Departments</strong> - Internal cost centers for expense tracking</li>
            <li><strong>Locations</strong> - Physical or virtual locations for reporting</li>
            <li><strong>Classes</strong> - Custom classifications for transactions</li>
          </ul>
          <p className="text-muted-foreground">
            These dimensions can be used to segment your financial data in reports.
          </p>
        </div>
      ),
      docLink: '/docs/organization-setup',
    },
    {
      id: 'fiscal-year',
      title: 'Fiscal Year Settings',
      description: 'Setting up your accounting periods',
      content: (
        <div className="space-y-4">
          <p>Configure your fiscal year to match your business cycle:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Calendar Year</strong> - January 1 to December 31</li>
            <li><strong>Fiscal Year</strong> - Custom start date (e.g., April 1 for many businesses)</li>
            <li><strong>Period Structure</strong> - Monthly, quarterly, or 4-4-5 weeks</li>
          </ul>
          <p className="text-muted-foreground">
            Your fiscal year affects how reports are grouped and when books can be closed.
          </p>
        </div>
      ),
    },
  ],
  chart_of_accounts: [
    {
      id: 'coa-basics',
      title: 'Chart of Accounts Basics',
      description: 'Understanding account categories',
      content: (
        <div className="space-y-4">
          <p>The chart of accounts organizes all your financial accounts:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Assets (1xxx)</strong> - What you own (Cash, Receivables, Equipment)</li>
            <li><strong>Liabilities (2xxx)</strong> - What you owe (Payables, Loans)</li>
            <li><strong>Equity (3xxx)</strong> - Owner&apos;s stake (Capital, Retained Earnings)</li>
            <li><strong>Revenue (4xxx)</strong> - Income from operations</li>
            <li><strong>COGS (5xxx)</strong> - Direct costs of sales</li>
            <li><strong>Expenses (6xxx)</strong> - Operating expenses</li>
          </ul>
        </div>
      ),
      docLink: '/docs/chart-of-accounts',
    },
    {
      id: 'industry-templates',
      title: 'Industry Templates',
      description: 'Pre-configured account structures',
      content: (
        <div className="space-y-4">
          <p>Choose a template that matches your business type:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>General Business</strong> - Standard accounts for most companies</li>
            <li><strong>SaaS / Software</strong> - Includes deferred revenue, ARR tracking</li>
            <li><strong>Construction</strong> - Job costing, retainage, WIP accounts</li>
            <li><strong>Professional Services</strong> - Time tracking, project accounting</li>
          </ul>
          <p className="text-muted-foreground">
            Templates can be customized after creation - add, remove, or rename accounts.
          </p>
        </div>
      ),
    },
    {
      id: 'control-accounts',
      title: 'Control Accounts',
      description: 'Automatic sub-ledger totals',
      content: (
        <div className="space-y-4">
          <p>
            Control accounts automatically aggregate balances from related sub-ledgers:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Accounts Receivable</strong> - Sum of all customer balances</li>
            <li><strong>Accounts Payable</strong> - Sum of all vendor balances</li>
            <li><strong>Inventory</strong> - Sum of all inventory items</li>
          </ul>
          <p className="text-muted-foreground">
            You cannot post directly to control accounts - use the sub-ledger instead.
          </p>
        </div>
      ),
    },
  ],
  opening_balances: [
    {
      id: 'balance-date',
      title: 'Choosing the Balance Date',
      description: 'When to set your opening balances',
      content: (
        <div className="space-y-4">
          <p>The opening balance date is when you start using GLAPI:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>End of Period</strong> - Use the last day of a month or quarter</li>
            <li><strong>Reconciled Point</strong> - Choose a date when accounts are fully reconciled</li>
            <li><strong>Before First Transaction</strong> - All transactions in GLAPI should be after this date</li>
          </ul>
          <p className="text-muted-foreground">
            Example: If starting GLAPI on January 15th, use December 31st as your opening balance date.
          </p>
        </div>
      ),
    },
    {
      id: 'trial-balance',
      title: 'Trial Balance',
      description: 'Ensuring debits equal credits',
      content: (
        <div className="space-y-4">
          <p>
            A trial balance verifies that your books are in balance:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Debits</strong> - Increases in Assets and Expenses</li>
            <li><strong>Credits</strong> - Increases in Liabilities, Equity, and Revenue</li>
            <li><strong>Balance Rule</strong> - Total Debits must equal Total Credits</li>
          </ul>
          <p className="text-muted-foreground">
            If your trial balance doesn&apos;t balance, check for missing accounts or transposition errors.
          </p>
        </div>
      ),
      docLink: '/docs/opening-balances',
    },
  ],
  integrations: [
    {
      id: 'bank-feeds',
      title: 'Bank Feed Integration',
      description: 'Automatic transaction import',
      content: (
        <div className="space-y-4">
          <p>Connect your bank accounts for automatic transaction import:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Real-time Sync</strong> - Transactions appear within hours</li>
            <li><strong>Auto-categorization</strong> - AI suggests account mappings</li>
            <li><strong>Reconciliation</strong> - Match imported transactions to entries</li>
          </ul>
          <p className="text-muted-foreground">
            Bank connections are secured via Plaid with bank-level encryption.
          </p>
        </div>
      ),
      docLink: '/docs/bank-feeds',
    },
    {
      id: 'api-access',
      title: 'API Integration',
      description: 'Connect your own systems',
      content: (
        <div className="space-y-4">
          <p>GLAPI provides a full REST API for integration:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Create Transactions</strong> - Post journal entries programmatically</li>
            <li><strong>Query Balances</strong> - Get real-time account balances</li>
            <li><strong>Generate Reports</strong> - Pull financial statements via API</li>
            <li><strong>Webhooks</strong> - Get notified of changes in real-time</li>
          </ul>
          <p className="text-muted-foreground">
            API keys can be managed in Settings &gt; API Access.
          </p>
        </div>
      ),
      docLink: '/docs/api-reference',
    },
  ],
};

// =============================================================================
// Help Button Component
// =============================================================================

interface HelpButtonProps {
  stepKey: OnboardingStepKey;
  topicId?: string;
  variant?: 'icon' | 'text' | 'link';
  className?: string;
}

export function HelpButton({ stepKey, topicId, variant = 'icon', className }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const analytics = useOnboardingAnalytics();

  const topics = HELP_TOPICS[stepKey] ?? [];
  const topic = topicId ? topics.find(t => t.id === topicId) : null;
  const displayTopics = topic ? [topic] : topics;

  const handleOpen = () => {
    setOpen(true);
    analytics.trackHelpClicked(stepKey, topicId ?? 'all');
  };

  if (displayTopics.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="sm" onClick={handleOpen} className={className}>
            <span className="text-lg">?</span>
          </Button>
        ) : variant === 'link' ? (
          <button onClick={handleOpen} className={`text-primary underline ${className}`}>
            Learn more
          </button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleOpen} className={className}>
            Need Help?
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{topic?.title ?? 'Help & Resources'}</DialogTitle>
          {topic && <DialogDescription>{topic.description}</DialogDescription>}
        </DialogHeader>

        {topic ? (
          <div className="py-4">
            {topic.content}
            {topic.docLink && (
              <div className="mt-4 pt-4 border-t">
                <a
                  href={topic.docLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  View full documentation
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {displayTopics.map(t => (
              <div
                key={t.id}
                className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => {
                  analytics.trackHelpClicked(stepKey, t.id);
                }}
              >
                <h4 className="font-medium">{t.title}</h4>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Help Tooltip Component (uses native title attribute)
// =============================================================================

interface HelpTooltipProps {
  content: string;
  children: React.ReactNode;
}

export function HelpTooltip({ content, children }: HelpTooltipProps) {
  return (
    <span title={content} className="cursor-help">
      {children}
    </span>
  );
}

// =============================================================================
// Help Card Component (for inline help)
// =============================================================================

interface HelpCardProps {
  title: string;
  children: React.ReactNode;
  variant?: 'info' | 'tip' | 'warning';
}

export function HelpCard({ title, children, variant = 'info' }: HelpCardProps) {
  const bgColors = {
    info: 'bg-blue-50 border-blue-200',
    tip: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
  };

  const textColors = {
    info: 'text-blue-800',
    tip: 'text-green-800',
    warning: 'text-yellow-800',
  };

  const icons = {
    info: 'i',
    tip: '*',
    warning: '!',
  };

  return (
    <div className={`rounded-lg border p-4 ${bgColors[variant]}`}>
      <div className="flex items-start gap-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${textColors[variant]} bg-white`}>
          {icons[variant]}
        </div>
        <div className="flex-1">
          <h4 className={`font-medium mb-1 ${textColors[variant]}`}>{title}</h4>
          <div className={`text-sm ${textColors[variant]} opacity-90`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
