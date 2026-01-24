'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Calendar, CalendarDays } from 'lucide-react';

export interface PeriodSelectorProps {
  value?: string;
  onChange: (periodId: string) => void;
  compareValue?: string;
  onCompareChange?: (periodId: string | undefined) => void;
  showCompare?: boolean;
  label?: string;
  className?: string;
}

export function PeriodSelector({
  value,
  onChange,
  compareValue,
  onCompareChange,
  showCompare = false,
  label = 'Period',
  className,
}: PeriodSelectorProps) {
  // Fetch accounting periods
  const { data: periodsData, isLoading } = trpc.accountingPeriods.list.useQuery({
    orderBy: 'startDate',
    orderDirection: 'desc',
    filters: {
      status: ['OPEN', 'SOFT_CLOSED', 'CLOSED'],
    },
  });

  const periods = periodsData?.data || [];

  // Group periods by fiscal year
  const periodsByYear = React.useMemo(() => {
    const grouped: Record<string, typeof periods> = {};
    periods.forEach((period) => {
      const year = period.fiscalYear;
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(period);
    });
    return grouped;
  }, [periods]);

  const fiscalYears = Object.keys(periodsByYear).sort().reverse();

  const formatPeriodLabel = (period: (typeof periods)[0]) => {
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);
    return `${period.periodName} (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end gap-4">
        {/* Primary Period Selector */}
        <div className="min-w-[280px] space-y-1.5">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {label}
          </Label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <SelectItem value="loading" disabled>
                  Loading periods...
                </SelectItem>
              ) : periods.length === 0 ? (
                <SelectItem value="none" disabled>
                  No periods available
                </SelectItem>
              ) : (
                fiscalYears.map((year) => (
                  <React.Fragment key={year}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      FY {year}
                    </div>
                    {periodsByYear[year].map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {formatPeriodLabel(period)}
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Compare Period Selector */}
        {showCompare && onCompareChange && (
          <div className="min-w-[280px] space-y-1.5">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Compare With (Optional)
            </Label>
            <Select
              value={compareValue || 'none'}
              onValueChange={(v) => onCompareChange(v === 'none' ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No comparison" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No comparison</SelectItem>
                {isLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading periods...
                  </SelectItem>
                ) : (
                  fiscalYears.map((year) => (
                    <React.Fragment key={year}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        FY {year}
                      </div>
                      {periodsByYear[year]
                        .filter((p) => p.id !== value) // Exclude current period
                        .map((period) => (
                          <SelectItem key={period.id} value={period.id}>
                            {formatPeriodLabel(period)}
                          </SelectItem>
                        ))}
                    </React.Fragment>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

export default PeriodSelector;
