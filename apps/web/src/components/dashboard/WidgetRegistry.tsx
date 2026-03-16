'use client';

import React from 'react';
import {
  Activity,
  BarChart3,
  Briefcase,
  Calendar,
  Clock,
  TrendingUp,
  FileText,
  Target,
  ShoppingCart,
} from 'lucide-react';
import { BacklogWidget } from './widgets/BacklogWidget';
import { UnbilledTimeWidget } from './widgets/UnbilledTimeWidget';
import { RecentTransactionsWidget } from './widgets/RecentTransactionsWidget';
import { MetricsWidget } from './widgets/MetricsWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';
import { AlertsWidget } from './widgets/AlertsWidget';
import { BudgetOverviewWidget } from './widgets/BudgetOverviewWidget';
import { UnfulfilledOrdersWidget } from './widgets/UnfulfilledOrdersWidget';
import { FinancialReportsWidget } from './widgets/FinancialReportsWidget';
import type { WidgetDefinition } from './types';

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    type: 'metrics',
    name: 'Key Metrics',
    description: 'Overview of revenue, income, cash balance, and active customers',
    icon: <TrendingUp className="h-4 w-4" />,
    defaultSize: 'full',
    component: MetricsWidget,
  },
  {
    type: 'financial_reports',
    name: 'Financial Reports',
    description: 'Quick access to key financial statements',
    icon: <BarChart3 className="h-4 w-4" />,
    defaultSize: 'md',
    component: FinancialReportsWidget,
  },
  {
    type: 'quick_actions',
    name: 'Quick Actions',
    description: 'Shortcuts to create new transactions',
    icon: <FileText className="h-4 w-4" />,
    defaultSize: 'md',
    component: QuickActionsWidget,
  },
  {
    type: 'alerts',
    name: 'Alerts & Tasks',
    description: 'Important items requiring immediate attention',
    icon: <Target className="h-4 w-4" />,
    defaultSize: 'md',
    component: AlertsWidget,
  },
  {
    type: 'backlog',
    name: 'Project Backlog',
    description: 'Remaining budget to complete by customer',
    icon: <Briefcase className="h-4 w-4" />,
    defaultSize: 'md',
    component: BacklogWidget,
  },
  {
    type: 'unbilled_time',
    name: 'Unbilled Time',
    description: 'Approved time entries pending billing by customer',
    icon: <Clock className="h-4 w-4" />,
    defaultSize: 'md',
    component: UnbilledTimeWidget,
  },
  {
    type: 'unfulfilled_orders',
    name: 'Unfulfilled Orders',
    description: 'Open sales orders pending invoicing by customer',
    icon: <ShoppingCart className="h-4 w-4" />,
    defaultSize: 'md',
    component: UnfulfilledOrdersWidget,
  },
  {
    type: 'budget_overview',
    name: 'Budget Overview',
    description: 'Current period budget performance',
    icon: <Calendar className="h-4 w-4" />,
    defaultSize: 'full',
    component: BudgetOverviewWidget,
  },
  {
    type: 'recent_transactions',
    name: 'Recent Transactions',
    description: 'Latest business transactions and activities',
    icon: <Activity className="h-4 w-4" />,
    defaultSize: 'lg',
    component: RecentTransactionsWidget,
  },
];

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find(w => w.type === type);
}
