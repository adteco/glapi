'use client';

import * as React from 'react';
import { Download, FileSpreadsheet, FileText, FileJson, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type ExportFormat = 'pdf' | 'xlsx' | 'csv' | 'json';

export interface ExportDropdownProps {
  onExport: (format: ExportFormat) => Promise<void>;
  disabled?: boolean;
  className?: string;
  reportName?: string;
}

const formatOptions: Array<{
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    format: 'pdf',
    label: 'PDF',
    description: 'Best for printing and sharing',
    icon: FileText,
  },
  {
    format: 'xlsx',
    label: 'Excel',
    description: 'Editable spreadsheet format',
    icon: FileSpreadsheet,
  },
  {
    format: 'csv',
    label: 'CSV',
    description: 'Plain text, comma-separated',
    icon: FileText,
  },
  {
    format: 'json',
    label: 'JSON',
    description: 'For programmatic access',
    icon: FileJson,
  },
];

export function ExportDropdown({
  onExport,
  disabled = false,
  className,
  reportName = 'Report',
}: ExportDropdownProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportingFormat, setExportingFormat] = React.useState<ExportFormat | null>(null);

  const handleExport = React.useCallback(
    async (format: ExportFormat) => {
      setIsExporting(true);
      setExportingFormat(format);
      try {
        await onExport(format);
      } finally {
        setIsExporting(false);
        setExportingFormat(null);
      }
    },
    [onExport]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('flex items-center gap-2', className)}
          disabled={disabled || isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span>Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export {reportName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formatOptions.map((option) => {
          const Icon = option.icon;
          const isCurrentlyExporting = exportingFormat === option.format;

          return (
            <DropdownMenuItem
              key={option.format}
              onClick={() => handleExport(option.format)}
              disabled={isExporting}
              className="flex flex-col items-start gap-1 py-2"
            >
              <div className="flex w-full items-center gap-2">
                {isCurrentlyExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="font-medium">{option.label}</span>
              </div>
              <span className="text-xs text-muted-foreground pl-6">
                {option.description}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportDropdown;
