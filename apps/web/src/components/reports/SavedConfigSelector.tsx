'use client';

import * as React from 'react';
import { Check, ChevronDown, Plus, Star, Trash2, Edit2, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export type ReportType = 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW_STATEMENT';

export interface ReportConfig {
  subsidiaryId?: string | null;
  departmentIds?: string[];
  classIds?: string[];
  locationIds?: string[];
  includeInactive?: boolean;
  showAccountHierarchy?: boolean;
  showZeroBalances?: boolean;
  includeYTD?: boolean;
  compareWithPriorPeriod?: boolean;
  defaultExportFormat?: 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
}

export interface SavedConfig {
  id: string;
  name: string;
  reportType: ReportType;
  config: ReportConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedConfigSelectorProps {
  reportType: ReportType;
  currentConfig: ReportConfig;
  savedConfigs: SavedConfig[];
  selectedConfigId?: string | null;
  onSelectConfig: (config: SavedConfig) => void;
  onSaveConfig: (name: string, isDefault: boolean) => Promise<void>;
  onUpdateConfig: (id: string, name: string, isDefault: boolean) => Promise<void>;
  onDeleteConfig: (id: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function SavedConfigSelector({
  reportType,
  currentConfig,
  savedConfigs,
  selectedConfigId,
  onSelectConfig,
  onSaveConfig,
  onUpdateConfig,
  onDeleteConfig,
  onSetDefault,
  isLoading = false,
  className,
}: SavedConfigSelectorProps) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingConfig, setEditingConfig] = React.useState<SavedConfig | null>(null);
  const [configName, setConfigName] = React.useState('');
  const [isDefaultConfig, setIsDefaultConfig] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const selectedConfig = React.useMemo(
    () => savedConfigs.find((c) => c.id === selectedConfigId),
    [savedConfigs, selectedConfigId]
  );

  const defaultConfig = React.useMemo(
    () => savedConfigs.find((c) => c.isDefault),
    [savedConfigs]
  );

  const reportTypeLabel = React.useMemo(() => {
    switch (reportType) {
      case 'BALANCE_SHEET':
        return 'Balance Sheet';
      case 'INCOME_STATEMENT':
        return 'Income Statement';
      case 'CASH_FLOW_STATEMENT':
        return 'Cash Flow Statement';
      default:
        return 'Report';
    }
  }, [reportType]);

  const handleOpenSaveDialog = React.useCallback(() => {
    setConfigName('');
    setIsDefaultConfig(false);
    setIsSaveDialogOpen(true);
  }, []);

  const handleOpenEditDialog = React.useCallback((config: SavedConfig, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingConfig(config);
    setConfigName(config.name);
    setIsDefaultConfig(config.isDefault);
    setIsEditDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(async () => {
    if (!configName.trim()) return;

    setIsSaving(true);
    try {
      await onSaveConfig(configName.trim(), isDefaultConfig);
      setIsSaveDialogOpen(false);
      setConfigName('');
      setIsDefaultConfig(false);
    } finally {
      setIsSaving(false);
    }
  }, [configName, isDefaultConfig, onSaveConfig]);

  const handleUpdate = React.useCallback(async () => {
    if (!editingConfig || !configName.trim()) return;

    setIsSaving(true);
    try {
      await onUpdateConfig(editingConfig.id, configName.trim(), isDefaultConfig);
      setIsEditDialogOpen(false);
      setEditingConfig(null);
      setConfigName('');
      setIsDefaultConfig(false);
    } finally {
      setIsSaving(false);
    }
  }, [editingConfig, configName, isDefaultConfig, onUpdateConfig]);

  const handleDelete = React.useCallback(async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await onDeleteConfig(id);
  }, [onDeleteConfig]);

  const handleSetDefault = React.useCallback(async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await onSetDefault(id);
  }, [onSetDefault]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('flex items-center gap-2 min-w-[160px] justify-between', className)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="truncate">
                  {selectedConfig ? selectedConfig.name : 'Saved Configurations'}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Saved Configurations</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {savedConfigs.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No saved configurations
            </div>
          ) : (
            savedConfigs.map((config) => (
              <DropdownMenuItem
                key={config.id}
                onClick={() => onSelectConfig(config)}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {config.id === selectedConfigId && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span className="truncate">{config.name}</span>
                  {config.isDefault && (
                    <Star className="h-3 w-3 shrink-0 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!config.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => handleSetDefault(config.id, e)}
                      title="Set as default"
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleOpenEditDialog(config, e)}
                    title="Edit"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => handleDelete(config.id, e)}
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleOpenSaveDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Save Current Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save New Config Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Configuration</DialogTitle>
            <DialogDescription>
              Save your current {reportTypeLabel} settings for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="config-name">Configuration Name</Label>
              <Input
                id="config-name"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="e.g., Monthly Review Settings"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-default"
                checked={isDefaultConfig}
                onCheckedChange={(checked) => setIsDefaultConfig(checked === true)}
              />
              <Label htmlFor="is-default" className="cursor-pointer">
                Set as default for {reportTypeLabel}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!configName.trim() || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Config Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Configuration</DialogTitle>
            <DialogDescription>
              Update the name or default status of this configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-config-name">Configuration Name</Label>
              <Input
                id="edit-config-name"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="e.g., Monthly Review Settings"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-is-default"
                checked={isDefaultConfig}
                onCheckedChange={(checked) => setIsDefaultConfig(checked === true)}
              />
              <Label htmlFor="edit-is-default" className="cursor-pointer">
                Set as default for {reportTypeLabel}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!configName.trim() || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SavedConfigSelector;
