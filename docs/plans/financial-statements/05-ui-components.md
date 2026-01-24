# Phase 5: UI Components

## Overview
Refactor existing financial statement pages to use TRPC, add dimension filtering, account drill-down, saved configurations, and export functionality.

---

## Task 5.1: Create Dimension Filter Component

**Description**: Create a reusable multi-select dimension filter component for filtering financial statements by subsidiary, department, class, and location.

**Layer**: Web (`apps/web`)

**Estimated Time**: 4 hours

**File**: `/Users/fredpope/Development/glapi/apps/web/src/components/reports/DimensionFilters.tsx`

### Acceptance Criteria
- [ ] Create `DimensionFilters` component with multi-select for each dimension type
- [ ] Fetch dimension data via TRPC (subsidiaries, departments, classes, locations)
- [ ] Support "All" option (no filter) for each dimension
- [ ] Support "Select All" / "Clear All" shortcuts
- [ ] Remember last used filters in localStorage
- [ ] Emit filter changes via callback
- [ ] Show loading state while fetching dimensions

### TDD Test Cases

```typescript
// apps/web/src/components/reports/__tests__/DimensionFilters.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DimensionFilters } from '../DimensionFilters';
import { trpc } from '@/lib/trpc';

vi.mock('@/lib/trpc');

describe('DimensionFilters', () => {
  const mockSubsidiaries = [
    { id: 'sub-1', name: 'Main Company' },
    { id: 'sub-2', name: 'Subsidiary A' },
  ];

  const mockDepartments = [
    { id: 'dept-1', name: 'Engineering' },
    { id: 'dept-2', name: 'Sales' },
  ];

  beforeEach(() => {
    vi.mocked(trpc.subsidiaries.list.useQuery).mockReturnValue({
      data: { data: mockSubsidiaries },
      isLoading: false,
    });
    vi.mocked(trpc.departments.list.useQuery).mockReturnValue({
      data: { data: mockDepartments },
      isLoading: false,
    });
    // ... mock classes and locations
  });

  it('should render all dimension selectors', () => {
    render(<DimensionFilters onChange={vi.fn()} />);

    expect(screen.getByLabelText('Subsidiary')).toBeInTheDocument();
    expect(screen.getByLabelText('Departments')).toBeInTheDocument();
    expect(screen.getByLabelText('Classes')).toBeInTheDocument();
    expect(screen.getByLabelText('Locations')).toBeInTheDocument();
  });

  it('should show loading state while fetching dimensions', () => {
    vi.mocked(trpc.subsidiaries.list.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<DimensionFilters onChange={vi.fn()} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should call onChange when filters change', async () => {
    const onChange = vi.fn();
    render(<DimensionFilters onChange={onChange} />);

    // Select a subsidiary
    fireEvent.click(screen.getByLabelText('Subsidiary'));
    fireEvent.click(screen.getByText('Main Company'));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ subsidiaryId: 'sub-1' })
      );
    });
  });

  it('should support multi-select for departments', async () => {
    const onChange = vi.fn();
    render(<DimensionFilters onChange={onChange} />);

    // Open departments dropdown
    fireEvent.click(screen.getByLabelText('Departments'));

    // Select multiple departments
    fireEvent.click(screen.getByText('Engineering'));
    fireEvent.click(screen.getByText('Sales'));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentIds: ['dept-1', 'dept-2'],
        })
      );
    });
  });

  it('should have "Clear All" button for multi-selects', () => {
    render(<DimensionFilters onChange={vi.fn()} />);

    // Open departments dropdown
    fireEvent.click(screen.getByLabelText('Departments'));

    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('should load saved filters from localStorage', () => {
    localStorage.setItem('report-filters', JSON.stringify({
      subsidiaryId: 'sub-1',
      departmentIds: ['dept-1'],
    }));

    const onChange = vi.fn();
    render(<DimensionFilters onChange={onChange} />);

    // Should emit saved filters on mount
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        subsidiaryId: 'sub-1',
        departmentIds: ['dept-1'],
      })
    );
  });
});
```

### Implementation Skeleton

```tsx
// apps/web/src/components/reports/DimensionFilters.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface DimensionFiltersProps {
  onChange: (filters: DimensionFilters) => void;
  initialFilters?: DimensionFilters;
  storageKey?: string;
}

interface DimensionFilters {
  subsidiaryId?: string;
  departmentIds?: string[];
  classIds?: string[];
  locationIds?: string[];
}

export function DimensionFilters({
  onChange,
  initialFilters,
  storageKey = 'report-dimension-filters',
}: DimensionFiltersProps) {
  // Fetch dimension data
  const { data: subsidiaries, isLoading: subsLoading } = trpc.subsidiaries.list.useQuery();
  const { data: departments, isLoading: deptLoading } = trpc.departments.list.useQuery();
  const { data: classes, isLoading: classLoading } = trpc.classes.list.useQuery();
  const { data: locations, isLoading: locLoading } = trpc.locations.list.useQuery();

  // Local state
  const [filters, setFilters] = useState<DimensionFilters>(() => {
    // Try to load from localStorage first
    const saved = typeof window !== 'undefined'
      ? localStorage.getItem(storageKey)
      : null;
    return saved ? JSON.parse(saved) : (initialFilters || {});
  });

  // Save to localStorage and emit change
  const updateFilters = useCallback((newFilters: DimensionFilters) => {
    setFilters(newFilters);
    localStorage.setItem(storageKey, JSON.stringify(newFilters));
    onChange(newFilters);
  }, [onChange, storageKey]);

  // Emit initial filters on mount
  useEffect(() => {
    onChange(filters);
  }, []);

  const isLoading = subsLoading || deptLoading || classLoading || locLoading;

  if (isLoading) {
    return <div className="text-muted-foreground">Loading filters...</div>;
  }

  return (
    <div className="flex flex-wrap gap-4 items-end">
      {/* Subsidiary - Single Select */}
      <div className="space-y-2">
        <Label htmlFor="subsidiary">Subsidiary</Label>
        <Select
          value={filters.subsidiaryId || 'all'}
          onValueChange={(value) =>
            updateFilters({
              ...filters,
              subsidiaryId: value === 'all' ? undefined : value,
            })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Subsidiaries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subsidiaries</SelectItem>
            {subsidiaries?.data.map((sub) => (
              <SelectItem key={sub.id} value={sub.id}>
                {sub.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Departments - Multi Select */}
      <MultiSelectDimension
        label="Departments"
        items={departments?.data || []}
        selectedIds={filters.departmentIds || []}
        onChange={(ids) => updateFilters({ ...filters, departmentIds: ids })}
      />

      {/* Classes - Multi Select */}
      <MultiSelectDimension
        label="Classes"
        items={classes?.data || []}
        selectedIds={filters.classIds || []}
        onChange={(ids) => updateFilters({ ...filters, classIds: ids })}
      />

      {/* Locations - Multi Select */}
      <MultiSelectDimension
        label="Locations"
        items={locations?.data || []}
        selectedIds={filters.locationIds || []}
        onChange={(ids) => updateFilters({ ...filters, locationIds: ids })}
      />

      {/* Clear All Button */}
      {(filters.subsidiaryId || filters.departmentIds?.length ||
        filters.classIds?.length || filters.locationIds?.length) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => updateFilters({})}
        >
          <X className="h-4 w-4 mr-1" />
          Clear All Filters
        </Button>
      )}
    </div>
  );
}

interface MultiSelectDimensionProps {
  label: string;
  items: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function MultiSelectDimension({
  label,
  items,
  selectedIds,
  onChange,
}: MultiSelectDimensionProps) {
  const [open, setOpen] = useState(false);

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => onChange(items.map((i) => i.id));
  const clearAll = () => onChange([]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[200px] justify-between">
            {selectedIds.length === 0
              ? `All ${label}`
              : `${selectedIds.length} selected`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2">
          <div className="flex justify-between mb-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear All
            </Button>
          </div>
          <div className="max-h-[200px] overflow-auto space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center space-x-2 p-1 hover:bg-muted rounded cursor-pointer"
                onClick={() => toggleItem(item.id)}
              >
                <Checkbox checked={selectedIds.includes(item.id)} />
                <span className="text-sm">{item.name}</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

---

## Task 5.2: Refactor Balance Sheet Page to Use TRPC

**Description**: Update the Balance Sheet page to use TRPC instead of REST fetch, add dimension filters, and implement account drill-down.

**Layer**: Web (`apps/web`)

**Estimated Time**: 4 hours

**File**: `/Users/fredpope/Development/glapi/apps/web/src/app/reports/financial/balance-sheet/page.tsx`

### Acceptance Criteria
- [ ] Replace REST fetch with `trpc.financialStatements.balanceSheet.useQuery`
- [ ] Add `DimensionFilters` component
- [ ] Add period selector using `trpc.accountingPeriods.list.useQuery`
- [ ] Implement account hierarchy drill-down (expand/collapse)
- [ ] Add prior period comparison toggle
- [ ] Add working capital metric display
- [ ] Add export button that calls TRPC export mutation

### TDD Test Cases

```typescript
// apps/web/src/app/reports/financial/balance-sheet/__tests__/page.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BalanceSheetPage from '../page';
import { trpc } from '@/lib/trpc';

vi.mock('@/lib/trpc');

describe('Balance Sheet Page', () => {
  const mockBalanceSheet = {
    reportName: 'Balance Sheet',
    periodName: 'January 2024',
    subsidiaryName: 'All Subsidiaries',
    asOfDate: '2024-01-31',
    currentAssetsSection: {
      name: 'Current Assets',
      lineItems: [
        { accountId: 'a1', accountNumber: '1000', accountName: 'Cash', currentPeriodAmount: 50000 },
      ],
      sectionTotal: 50000,
    },
    totalCurrentAssets: 50000,
    nonCurrentAssetsSection: { name: 'Non-Current Assets', lineItems: [], sectionTotal: 0 },
    totalNonCurrentAssets: 0,
    totalAssets: 50000,
    // ... rest of balance sheet data
    balanceCheck: 0,
    workingCapital: 30000,
  };

  beforeEach(() => {
    vi.mocked(trpc.financialStatements.balanceSheet.useQuery).mockReturnValue({
      data: mockBalanceSheet,
      isLoading: false,
      error: null,
    });

    vi.mocked(trpc.accountingPeriods.list.useQuery).mockReturnValue({
      data: {
        data: [
          { id: 'period-1', periodName: 'January 2024', status: 'CLOSED' },
          { id: 'period-2', periodName: 'December 2023', status: 'CLOSED' },
        ],
      },
      isLoading: false,
    });
  });

  it('should display Balance Sheet title', () => {
    render(<BalanceSheetPage />);
    expect(screen.getByText('Balance Sheet')).toBeInTheDocument();
  });

  it('should display dimension filters', () => {
    render(<BalanceSheetPage />);
    expect(screen.getByLabelText('Subsidiary')).toBeInTheDocument();
    expect(screen.getByLabelText('Departments')).toBeInTheDocument();
  });

  it('should display balance sheet data when loaded', async () => {
    render(<BalanceSheetPage />);

    await waitFor(() => {
      expect(screen.getByText('Current Assets')).toBeInTheDocument();
      expect(screen.getByText('Cash')).toBeInTheDocument();
      expect(screen.getByText('$50,000.00')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    vi.mocked(trpc.financialStatements.balanceSheet.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<BalanceSheetPage />);
    expect(screen.getByText(/loading|generating/i)).toBeInTheDocument();
  });

  it('should display balance check status', async () => {
    render(<BalanceSheetPage />);

    await waitFor(() => {
      expect(screen.getByText(/balanced/i)).toBeInTheDocument();
    });
  });

  it('should display working capital metric', async () => {
    render(<BalanceSheetPage />);

    await waitFor(() => {
      expect(screen.getByText('Working Capital')).toBeInTheDocument();
      expect(screen.getByText('$30,000.00')).toBeInTheDocument();
    });
  });

  it('should update query when period changes', async () => {
    render(<BalanceSheetPage />);

    // Open period selector
    fireEvent.click(screen.getByLabelText('Accounting Period'));
    fireEvent.click(screen.getByText('December 2023'));

    await waitFor(() => {
      expect(trpc.financialStatements.balanceSheet.useQuery).toHaveBeenCalledWith(
        expect.objectContaining({ periodId: 'period-2' })
      );
    });
  });

  it('should support account drill-down', async () => {
    // Add parent account with children
    const dataWithHierarchy = {
      ...mockBalanceSheet,
      currentAssetsSection: {
        ...mockBalanceSheet.currentAssetsSection,
        lineItems: [
          {
            accountId: 'a1',
            accountNumber: '1000',
            accountName: 'Cash',
            currentPeriodAmount: 50000,
            childAccounts: [
              { accountId: 'a1-1', accountNumber: '1010', accountName: 'Checking', currentPeriodAmount: 30000 },
              { accountId: 'a1-2', accountNumber: '1020', accountName: 'Savings', currentPeriodAmount: 20000 },
            ],
          },
        ],
      },
    };

    vi.mocked(trpc.financialStatements.balanceSheet.useQuery).mockReturnValue({
      data: dataWithHierarchy,
      isLoading: false,
      error: null,
    });

    render(<BalanceSheetPage />);

    // Click expand button on Cash row
    fireEvent.click(screen.getByTestId('expand-a1'));

    await waitFor(() => {
      expect(screen.getByText('Checking')).toBeInTheDocument();
      expect(screen.getByText('Savings')).toBeInTheDocument();
    });
  });

  it('should call export mutation when export button clicked', async () => {
    const exportMutation = vi.fn().mockResolvedValue({
      buffer: 'base64data',
      contentType: 'application/pdf',
      filename: 'balance-sheet.pdf',
    });

    vi.mocked(trpc.financialStatements.export.useMutation).mockReturnValue({
      mutateAsync: exportMutation,
      isLoading: false,
    });

    render(<BalanceSheetPage />);

    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('PDF'));

    await waitFor(() => {
      expect(exportMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: 'BALANCE_SHEET',
          format: 'pdf',
        })
      );
    });
  });
});
```

---

## Task 5.3: Refactor Income Statement Page to Use TRPC

**Description**: Update the Income Statement page with TRPC, add margin displays, and period comparison.

**Layer**: Web (`apps/web`)

**Estimated Time**: 4 hours

**File**: `/Users/fredpope/Development/glapi/apps/web/src/app/reports/financial/income-statement/page.tsx`

### Acceptance Criteria
- [ ] Replace REST fetch with TRPC query
- [ ] Add dimension filters
- [ ] Display gross, operating, and net margins
- [ ] Add YTD column toggle
- [ ] Add prior period comparison with variance
- [ ] Add trend indicators (up/down arrows) for variances

---

## Task 5.4: Implement Cash Flow Statement Page with TRPC

**Description**: Replace mock data with actual TRPC query for Cash Flow Statement.

**Layer**: Web (`apps/web`)

**Estimated Time**: 4 hours

**File**: `/Users/fredpope/Development/glapi/apps/web/src/app/reports/financial/cash-flow-statement/page.tsx`

### Acceptance Criteria
- [ ] Replace mock data with `trpc.financialStatements.cashFlowStatement.useQuery`
- [ ] Display Operating, Investing, Financing sections
- [ ] Show beginning/ending cash reconciliation
- [ ] Display cash flow trend indicator
- [ ] Add cash flow ratio metrics (Free Cash Flow)

---

## Task 5.5: Create Saved Report Configuration UI

**Description**: Add UI for saving, loading, and managing report configurations.

**Layer**: Web (`apps/web`)

**Estimated Time**: 4 hours

**Files**:
- `/Users/fredpope/Development/glapi/apps/web/src/components/reports/SavedConfigsDropdown.tsx`
- `/Users/fredpope/Development/glapi/apps/web/src/components/reports/SaveConfigDialog.tsx`

### Acceptance Criteria
- [ ] Create dropdown showing saved configurations
- [ ] Add "Save Current Configuration" option
- [ ] Add "Set as Default" option per config
- [ ] Load default config on page load
- [ ] Add delete confirmation for configs

### Implementation Skeleton

```tsx
// apps/web/src/components/reports/SavedConfigsDropdown.tsx

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bookmark, ChevronDown, Star, Trash2 } from 'lucide-react';
import { SaveConfigDialog } from './SaveConfigDialog';
import { toast } from 'sonner';

interface SavedConfigsDropdownProps {
  reportType: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW';
  currentFilters: Record<string, unknown>;
  onLoadConfig: (filters: Record<string, unknown>) => void;
}

export function SavedConfigsDropdown({
  reportType,
  currentFilters,
  onLoadConfig,
}: SavedConfigsDropdownProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const { data: configs, refetch } = trpc.savedReportConfigs.list.useQuery({
    reportType,
  });

  const setDefaultMutation = trpc.savedReportConfigs.setDefault.useMutation({
    onSuccess: () => {
      toast.success('Default configuration updated');
      refetch();
    },
  });

  const deleteMutation = trpc.savedReportConfigs.delete.useMutation({
    onSuccess: () => {
      toast.success('Configuration deleted');
      refetch();
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Bookmark className="h-4 w-4 mr-2" />
            Saved Configs
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {configs?.length === 0 ? (
            <DropdownMenuItem disabled>
              No saved configurations
            </DropdownMenuItem>
          ) : (
            configs?.map((config) => (
              <DropdownMenuItem
                key={config.id}
                className="flex items-center justify-between"
                onClick={() => onLoadConfig(config.filters)}
              >
                <span className="flex items-center gap-2">
                  {config.isDefault && (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  )}
                  {config.name}
                </span>
                <div className="flex items-center gap-1">
                  {!config.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDefaultMutation.mutate({ id: config.id });
                      }}
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this configuration?')) {
                        deleteMutation.mutate({ id: config.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
            Save Current Configuration
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SaveConfigDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        reportType={reportType}
        filters={currentFilters}
        onSaved={() => {
          refetch();
          setSaveDialogOpen(false);
        }}
      />
    </>
  );
}
```

---

## Task 5.6: Add Export Dropdown Component

**Description**: Create a reusable export dropdown for PDF, Excel, CSV exports.

**Layer**: Web (`apps/web`)

**Estimated Time**: 3 hours

**File**: `/Users/fredpope/Development/glapi/apps/web/src/components/reports/ExportDropdown.tsx`

### Acceptance Criteria
- [ ] Support PDF, Excel, CSV export options
- [ ] Show loading state during export
- [ ] Download file after export completes
- [ ] Handle export errors gracefully

### Implementation Skeleton

```tsx
// apps/web/src/components/reports/ExportDropdown.tsx

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExportDropdownProps {
  reportType: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW';
  filters: {
    periodId: string;
    subsidiaryId?: string;
    departmentIds?: string[];
    classIds?: string[];
    locationIds?: string[];
  };
  comparePeriodId?: string;
}

export function ExportDropdown({
  reportType,
  filters,
  comparePeriodId,
}: ExportDropdownProps) {
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const exportMutation = trpc.financialStatements.export.useMutation({
    onSuccess: (data) => {
      // Decode base64 and download
      const byteCharacters = atob(data.buffer);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.contentType });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported as ${data.filename}`);
      setExportingFormat(null);
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
      setExportingFormat(null);
    },
  });

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv') => {
    setExportingFormat(format);
    await exportMutation.mutateAsync({
      reportType,
      format,
      ...filters,
      includeComparison: !!comparePeriodId,
      comparePeriodId,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exportingFormat !== null}>
          {exportingFormat ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('xlsx')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Commit Messages

```
feat(web): add dimension filter component with multi-select

- Create DimensionFilters component for subsidiary, department, class, location
- Support multi-select for departments, classes, locations
- Persist filters to localStorage
- Include clear all filters button

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
feat(web): refactor Balance Sheet to use TRPC with drill-down

- Replace REST fetch with trpc.financialStatements.balanceSheet
- Add account hierarchy drill-down (expand/collapse)
- Add working capital metric display
- Add prior period comparison
- Integrate dimension filters

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
feat(web): implement Cash Flow Statement with TRPC

- Replace mock data with trpc.financialStatements.cashFlowStatement
- Display operating/investing/financing sections
- Show cash reconciliation
- Add cash flow trend indicators

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
feat(web): add saved report configuration UI

- Create SavedConfigsDropdown for loading saved configs
- Create SaveConfigDialog for saving new configs
- Support setting default configuration
- Load default config on page mount

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
feat(web): add export dropdown for PDF/Excel/CSV

- Create ExportDropdown component
- Handle base64 decode and file download
- Show loading state during export
- Support PDF, Excel, CSV formats

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
