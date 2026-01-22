'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Filter, X, Building2, MapPin, Briefcase, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

export interface DimensionFilters {
  subsidiaryIds?: string[];
  classIds?: string[];
  departmentIds?: string[];
  locationIds?: string[];
}

interface DimensionFilterProps {
  value: DimensionFilters;
  onChange: (filters: DimensionFilters) => void;
  className?: string;
}

export function DimensionFilter({ value, onChange, className }: DimensionFilterProps) {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<DimensionFilters>(value);

  // Fetch dimension data
  const { data: subsidiaries } = trpc.subsidiaries.list.useQuery({});
  const { data: classes } = trpc.classes.list.useQuery({});
  const { data: departments } = trpc.departments.list.useQuery({});
  const { data: locations } = trpc.locations.list.useQuery({});

  useEffect(() => {
    setLocalFilters(value);
  }, [value]);

  const activeFilterCount = [
    value.subsidiaryIds?.length ?? 0,
    value.classIds?.length ?? 0,
    value.departmentIds?.length ?? 0,
    value.locationIds?.length ?? 0,
  ].reduce((a, b) => a + (b > 0 ? 1 : 0), 0);

  const handleApply = () => {
    onChange(localFilters);
    setOpen(false);
  };

  const handleClear = () => {
    const emptyFilters: DimensionFilters = {
      subsidiaryIds: [],
      classIds: [],
      departmentIds: [],
      locationIds: [],
    };
    setLocalFilters(emptyFilters);
    onChange(emptyFilters);
    setOpen(false);
  };

  const toggleItem = (
    key: keyof DimensionFilters,
    id: string,
    checked: boolean
  ) => {
    setLocalFilters((prev) => {
      const current = prev[key] ?? [];
      if (checked) {
        return { ...prev, [key]: [...current, id] };
      }
      return { ...prev, [key]: current.filter((i) => i !== id) };
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-2', className)}>
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filter by Dimension</h4>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-auto p-0 text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            )}
          </div>

          <Separator />

          {/* Subsidiaries */}
          <DimensionSection
            title="Subsidiaries"
            icon={<Building2 className="h-4 w-4" />}
            items={(subsidiaries ?? []).map((s: any) => ({
              id: s.id,
              name: s.name,
              code: s.code,
            }))}
            selectedIds={localFilters.subsidiaryIds ?? []}
            onToggle={(id, checked) => toggleItem('subsidiaryIds', id, checked)}
          />

          {/* Classes */}
          <DimensionSection
            title="Classes"
            icon={<Tag className="h-4 w-4" />}
            items={(classes ?? []).map((c: any) => ({
              id: c.id,
              name: c.name,
              code: c.code,
            }))}
            selectedIds={localFilters.classIds ?? []}
            onToggle={(id, checked) => toggleItem('classIds', id, checked)}
          />

          {/* Departments */}
          <DimensionSection
            title="Departments"
            icon={<Briefcase className="h-4 w-4" />}
            items={(departments ?? []).map((d: any) => ({
              id: d.id,
              name: d.name,
              code: d.code,
            }))}
            selectedIds={localFilters.departmentIds ?? []}
            onToggle={(id, checked) => toggleItem('departmentIds', id, checked)}
          />

          {/* Locations */}
          <DimensionSection
            title="Locations"
            icon={<MapPin className="h-4 w-4" />}
            items={(locations ?? []).map((l: any) => ({
              id: l.id,
              name: l.name,
              code: l.code,
            }))}
            selectedIds={localFilters.locationIds ?? []}
            onToggle={(id, checked) => toggleItem('locationIds', id, checked)}
          />

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply}>
              Apply Filters
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DimensionSectionProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{ id: string; name: string; code?: string }>;
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}

function DimensionSection({
  title,
  icon,
  items,
  selectedIds,
  onToggle,
}: DimensionSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {title}
        {selectedIds.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {selectedIds.length}
          </Badge>
        )}
      </div>
      <ScrollArea className="h-28">
        <div className="space-y-2 pr-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center space-x-2">
              <Checkbox
                id={item.id}
                checked={selectedIds.includes(item.id)}
                onCheckedChange={(checked) => onToggle(item.id, checked === true)}
              />
              <Label
                htmlFor={item.id}
                className="text-sm font-normal cursor-pointer truncate"
              >
                {item.name}
                {item.code && (
                  <span className="text-muted-foreground ml-1">({item.code})</span>
                )}
              </Label>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ActiveFiltersProps {
  filters: DimensionFilters;
  onRemove: (key: keyof DimensionFilters, id: string) => void;
  onClearAll: () => void;
}

export function ActiveFilters({ filters, onRemove, onClearAll }: ActiveFiltersProps) {
  const { data: subsidiaries } = trpc.subsidiaries.list.useQuery({});
  const { data: classes } = trpc.classes.list.useQuery({});
  const { data: departments } = trpc.departments.list.useQuery({});
  const { data: locations } = trpc.locations.list.useQuery({});

  const getName = (key: keyof DimensionFilters, id: string): string => {
    switch (key) {
      case 'subsidiaryIds':
        return subsidiaries?.data?.find((s: any) => s.id === id)?.name || id;
      case 'classIds':
        return classes?.data?.find((c: any) => c.id === id)?.name || id;
      case 'departmentIds':
        return departments?.data?.find((d: any) => d.id === id)?.name || id;
      case 'locationIds':
        return locations?.data?.find((l: any) => l.id === id)?.name || id;
      default:
        return id;
    }
  };

  const getLabel = (key: keyof DimensionFilters): string => {
    switch (key) {
      case 'subsidiaryIds':
        return 'Subsidiary';
      case 'classIds':
        return 'Class';
      case 'departmentIds':
        return 'Department';
      case 'locationIds':
        return 'Location';
      default:
        return key;
    }
  };

  const allFilters: Array<{ key: keyof DimensionFilters; id: string }> = [];
  (Object.keys(filters) as Array<keyof DimensionFilters>).forEach((key) => {
    (filters[key] ?? []).forEach((id) => {
      allFilters.push({ key, id });
    });
  });

  if (allFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Active filters:</span>
      {allFilters.map(({ key, id }) => (
        <Badge key={`${key}-${id}`} variant="secondary" className="gap-1">
          <span className="text-xs text-muted-foreground">{getLabel(key)}:</span>
          {getName(key, id)}
          <button
            onClick={() => onRemove(key, id)}
            className="ml-1 rounded-full hover:bg-muted-foreground/20"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 px-2 text-xs"
      >
        Clear all
      </Button>
    </div>
  );
}
