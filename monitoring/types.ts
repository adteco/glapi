/**
 * Monitoring System Types
 * Common types and interfaces for monitoring and alerting
 */

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  PAGERDUTY = 'pagerduty',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  OPSGENIE = 'opsgenie'
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  channels: AlertChannel[];
  enabled?: boolean;
  metadata?: Record<string, any>;
  actions?: AlertAction[];
  schedule?: AlertSchedule;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
  threshold: number;
  duration: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p50' | 'p75' | 'p90' | 'p95' | 'p99';
  filters?: Record<string, any>;
}

export interface AlertAction {
  type: 'email' | 'slack' | 'webhook' | 'custom';
  config: Record<string, any>;
  delay?: number;
  retryPolicy?: RetryPolicy;
}

export interface AlertSchedule {
  timezone: string;
  activeHours?: {
    start: string;
    end: string;
  };
  activeDays?: number[];
  exceptions?: ScheduleException[];
}

export interface ScheduleException {
  date: string;
  reason: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  metadata: Record<string, any>;
  history: AlertEvent[];
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed'
}

export interface AlertEvent {
  timestamp: Date;
  type: 'triggered' | 'acknowledged' | 'resolved' | 'escalated' | 'commented';
  user?: string;
  message?: string;
  metadata?: Record<string, any>;
}

export interface MetricQuery {
  metric: string;
  aggregation?: string;
  filters?: Record<string, any>;
  groupBy?: string[];
  period?: string;
  offset?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  layout?: LayoutConfig;
  refreshInterval?: number;
  variables?: DashboardVariable[];
}

export interface Widget {
  id?: string;
  type: 'metric' | 'timeseries' | 'table' | 'heatmap' | 'pie' | 'bar' | 'text';
  title: string;
  query: string | MetricQuery;
  format?: string;
  period?: string;
  size?: WidgetSize;
  position?: WidgetPosition;
  config?: Record<string, any>;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface LayoutConfig {
  type: 'grid' | 'flex';
  columns?: number;
  rows?: number;
  gap?: number;
}

export interface DashboardVariable {
  name: string;
  type: 'constant' | 'query' | 'custom';
  value?: any;
  query?: string;
  options?: any[];
  default?: any;
}

export interface MonitoringConfig {
  alerts: AlertRule[];
  dashboards: Dashboard[];
  integrations: Integration[];
  settings: MonitoringSettings;
}

export interface Integration {
  type: 'datadog' | 'newrelic' | 'prometheus' | 'cloudwatch' | 'custom';
  name: string;
  config: Record<string, any>;
  enabled: boolean;
}

export interface MonitoringSettings {
  alertRetention: number;
  metricRetention: number;
  logRetention: number;
  timezone: string;
  notificationDefaults: NotificationDefaults;
}

export interface NotificationDefaults {
  channels: AlertChannel[];
  suppressionWindow: number;
  batchingEnabled: boolean;
  batchingWindow: number;
}