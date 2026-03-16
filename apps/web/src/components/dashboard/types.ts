import { ReactNode } from 'react';

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export interface DashboardWidgetConfig {
  id: string;
  type: string;
  size: WidgetSize;
  title?: string;
  settings?: Record<string, any>;
}

export interface DashboardConfig {
  widgets: DashboardWidgetConfig[];
}

export interface WidgetDefinition {
  type: string;
  name: string;
  description: string;
  icon: ReactNode;
  defaultSize: WidgetSize;
  component: React.ComponentType<{ config: DashboardWidgetConfig }>;
}
