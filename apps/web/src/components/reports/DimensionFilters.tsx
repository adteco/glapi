'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Building2, Folder, MapPin, Tag, X, ChevronDown } from 'lucide-react';

export interface DimensionFilterValues {
  subsidiaryId?: string;
  departmentIds: string[];
  classIds: string[];
  locationIds: string[];
}

interface DimensionFiltersProps {
  value: DimensionFilterValues;
  onChange: (value: DimensionFilterValues) => void;
  showSubsidiary?: boolean;
  showDepartments?: boolean;
  showClasses?: boolean;
  showLocations?: boolean;
  className?: string;
  compact?: boolean;
}

interface MultiSelectOption {
  id: string;
  name: string;
}

interface MultiSelectDropdownProps {
  label: string;
  icon: React.ReactNode;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  isLoading?: boolean;
  compact?: boolean;
}

function MultiSelectDropdown({
  label,
  icon,
  options,
  selectedIds,
  onChange,
  isLoading,
  compact,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelectAll = () => {
    onChange(options.map((o) => o.id));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedCount = selectedIds.length;
  const displayText =
    selectedCount === 0
      ? `All ${label}`
      : selectedCount === 1
        ? options.find((o) => o.id === selectedIds[0])?.name || '1 selected'
        : `${selectedCount} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'justify-between',
            compact ? 'h-8 px-2 text-xs' : 'h-10 px-3'
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {icon}
            <span className="truncate">{displayText}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="border-b px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleSelectAll}
                disabled={isLoading}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleClearAll}
                disabled={isLoading || selectedCount === 0}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : options.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No {label.toLowerCase()} available
            </div>
          ) : (
            <div className="space-y-1">
              {options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedIds.includes(option.id)}
                    onCheckedChange={() => handleToggle(option.id)}
                  />
                  <span className="truncate text-sm">{option.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DimensionFilters({
  value,
  onChange,
  showSubsidiary = true,
  showDepartments = true,
  showClasses = true,
  showLocations = true,
  className,
  compact = false,
}: DimensionFiltersProps) {
  // Fetch dimension data
  const { data: subsidiaries, isLoading: subsidiariesLoading } =
    trpc.subsidiaries.list.useQuery({});
  const { data: departments, isLoading: departmentsLoading } =
    trpc.departments.list.useQuery({});
  const { data: classes, isLoading: classesLoading } =
    trpc.classes.list.useQuery({});
  const { data: locations, isLoading: locationsLoading } =
    trpc.locations.list.useQuery({});

  const handleSubsidiaryChange = (subsidiaryId: string) => {
    onChange({
      ...value,
      subsidiaryId: subsidiaryId === 'all' ? undefined : subsidiaryId,
    });
  };

  const handleDepartmentsChange = (departmentIds: string[]) => {
    onChange({ ...value, departmentIds });
  };

  const handleClassesChange = (classIds: string[]) => {
    onChange({ ...value, classIds });
  };

  const handleLocationsChange = (locationIds: string[]) => {
    onChange({ ...value, locationIds });
  };

  const handleClearAll = () => {
    onChange({
      subsidiaryId: undefined,
      departmentIds: [],
      classIds: [],
      locationIds: [],
    });
  };

  const hasFilters =
    value.subsidiaryId ||
    value.departmentIds.length > 0 ||
    value.classIds.length > 0 ||
    value.locationIds.length > 0;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {showSubsidiary && (
          <div className={compact ? '' : 'min-w-[200px]'}>
            <Select
              value={value.subsidiaryId || 'all'}
              onValueChange={handleSubsidiaryChange}
            >
              <SelectTrigger
                className={cn(compact ? 'h-8 text-xs' : 'h-10')}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="All Subsidiaries" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subsidiaries</SelectItem>
                {subsidiariesLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading...
                  </SelectItem>
                ) : (
                  subsidiaries?.filter((s) => s.id).map((subsidiary) => (
                    <SelectItem key={subsidiary.id} value={subsidiary.id!}>
                      {subsidiary.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {showDepartments && (
          <MultiSelectDropdown
            label="Departments"
            icon={<Folder className="h-4 w-4 text-muted-foreground" />}
            options={
              departments?.filter((d) => d.id).map((d) => ({ id: d.id!, name: d.name })) || []
            }
            selectedIds={value.departmentIds}
            onChange={handleDepartmentsChange}
            isLoading={departmentsLoading}
            compact={compact}
          />
        )}

        {showClasses && (
          <MultiSelectDropdown
            label="Classes"
            icon={<Tag className="h-4 w-4 text-muted-foreground" />}
            options={classes?.filter((c) => c.id).map((c) => ({ id: c.id!, name: c.name })) || []}
            selectedIds={value.classIds}
            onChange={handleClassesChange}
            isLoading={classesLoading}
            compact={compact}
          />
        )}

        {showLocations && (
          <MultiSelectDropdown
            label="Locations"
            icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
            options={
              locations?.filter((l) => l.id).map((l) => ({ id: l.id!, name: l.name })) || []
            }
            selectedIds={value.locationIds}
            onChange={handleLocationsChange}
            isLoading={locationsLoading}
            compact={compact}
          />
        )}

        {hasFilters && (
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'default'}
            onClick={handleClearAll}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1 h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Active filters display */}
      {hasFilters && !compact && (
        <div className="flex flex-wrap gap-1.5">
          {value.subsidiaryId && (
            <Badge variant="secondary" className="gap-1">
              <Building2 className="h-3 w-3" />
              {subsidiaries?.find((s) => s.id === value.subsidiaryId)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleSubsidiaryChange('all')}
              />
            </Badge>
          )}
          {value.departmentIds.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1">
              <Folder className="h-3 w-3" />
              {departments?.find((d) => d.id === id)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  handleDepartmentsChange(
                    value.departmentIds.filter((i) => i !== id)
                  )
                }
              />
            </Badge>
          ))}
          {value.classIds.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1">
              <Tag className="h-3 w-3" />
              {classes?.find((c) => c.id === id)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  handleClassesChange(value.classIds.filter((i) => i !== id))
                }
              />
            </Badge>
          ))}
          {value.locationIds.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1">
              <MapPin className="h-3 w-3" />
              {locations?.find((l) => l.id === id)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  handleLocationsChange(
                    value.locationIds.filter((i) => i !== id)
                  )
                }
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default DimensionFilters;
