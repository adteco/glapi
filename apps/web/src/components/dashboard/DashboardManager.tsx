'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Settings, 
  X, 
  GripVertical, 
  Trash2, 
  LayoutDashboard,
  Save,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DashboardConfig, 
  DashboardWidgetConfig, 
  WidgetSize 
} from './types';
import { WIDGET_REGISTRY, getWidgetDefinition } from './WidgetRegistry';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'glapi-dashboard-config';

const DEFAULT_CONFIG: DashboardConfig = {
  widgets: [
    { id: '1', type: 'metrics', size: 'full' },
    { id: '2', type: 'financial_reports', size: 'md' },
    { id: '3', type: 'quick_actions', size: 'md' },
    { id: '4', type: 'alerts', size: 'md' },
    { id: '5', type: 'backlog', size: 'md' },
    { id: '6', type: 'unbilled_time', size: 'md' },
    { id: '7', type: 'recent_transactions', size: 'full' },
    { id: '8', type: 'budget_overview', size: 'full' },
    { id: '9', type: 'unfulfilled_orders', size: 'full' },
  ],
};

export function DashboardManager() {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Load config
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        setConfig(DEFAULT_CONFIG);
      }
    } else {
      setConfig(DEFAULT_CONFIG);
    }
  }, []);

  // Save config
  const saveConfig = (newConfig: DashboardConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  };

  const handleAddWidget = (type: string) => {
    if (!config) return;

    const def = getWidgetDefinition(type);
    if (!def) return;

    const newWidget: DashboardWidgetConfig = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      size: def.defaultSize,
      title: def.name,
    };

    const newConfig = {
      ...config,
      widgets: [...config.widgets, newWidget],
    };

    saveConfig(newConfig);
    setIsAddModalOpen(false);
  };

  const handleRemoveWidget = (id: string) => {
    if (!config) return;

    const newConfig = {
      ...config,
      widgets: config.widgets.filter(w => w.id !== id),
    };

    saveConfig(newConfig);
  };

  const handleReset = () => {
    if (confirm('Reset dashboard to default?')) {
      saveConfig(DEFAULT_CONFIG);
    }
  };

  if (!config) return <div className="p-8 text-center italic">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Customize your view of the business.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={isEditMode ? "default" : "outline"} 
            onClick={() => setIsEditMode(!isEditMode)}
          >
            {isEditMode ? <Save className="mr-2 h-4 w-4" /> : <Settings className="mr-2 h-4 w-4" />}
            {isEditMode ? "Done Editing" : "Edit Dashboard"}
          </Button>
          
          {isEditMode && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}

          {!isEditMode && (
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Widget
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Widget</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  {WIDGET_REGISTRY.map((def) => (
                    <button
                      key={def.type}
                      className="flex flex-col items-start p-4 border rounded-lg hover:bg-gray-50 text-left transition-colors"
                      onClick={() => handleAddWidget(def.type)}
                    >
                      <div className="p-2 bg-blue-50 rounded-lg text-blue-600 mb-3">
                        {def.icon}
                      </div>
                      <h3 className="font-semibold">{def.name}</h3>
                      <p className="text-sm text-gray-500">{def.description}</p>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        {config.widgets.map((widgetConfig) => {
          const def = getWidgetDefinition(widgetConfig.type);
          if (!def) return null;

          const colSpan = {
            sm: 'lg:col-span-3',
            md: 'lg:col-span-6',
            lg: 'lg:col-span-8',
            full: 'lg:col-span-12',
          }[widgetConfig.size];

          return (
            <div key={widgetConfig.id} className={cn(colSpan, "relative group")}>
              {isEditMode && (
                <div className="absolute -top-3 -right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-8 w-8 rounded-full shadow-lg"
                    onClick={() => handleRemoveWidget(widgetConfig.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className={cn(
                "h-full",
                isEditMode && "ring-2 ring-blue-500/50 ring-offset-2 rounded-xl"
              )}>
                <def.component config={widgetConfig} />
              </div>
            </div>
          );
        })}

        {config.widgets.length === 0 && (
          <div className="col-span-12 py-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-gray-500">
            <LayoutDashboard className="h-12 w-12 mb-4 opacity-20" />
            <p>Your dashboard is empty</p>
            <Button variant="link" onClick={() => setIsAddModalOpen(true)}>
              Add your first widget
            </Button>
          </div>
        ) }
      </div>
    </div>
  );
}
