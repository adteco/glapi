/**
 * Revenue Recognition Monitoring and Alerting Configuration
 * Defines alerts specific to the 606Ledger revenue recognition system
 */

import { AlertRule, AlertSeverity, AlertChannel } from './types';

/**
 * Revenue Recognition Alert Rules
 */
export const revenueAlertRules: AlertRule[] = [
  // Revenue Calculation Alerts
  {
    id: 'revenue-calc-failure',
    name: 'Revenue Calculation Failure',
    description: 'Alert when revenue calculation fails for a subscription',
    condition: {
      metric: 'revenue.calculation.failures',
      operator: '>',
      threshold: 0,
      duration: '1m',
      aggregation: 'sum'
    },
    severity: AlertSeverity.CRITICAL,
    channels: [AlertChannel.PAGERDUTY, AlertChannel.SLACK],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/revenue-calc-failure',
      team: 'revenue-ops'
    }
  },

  {
    id: 'revenue-calc-slow',
    name: 'Slow Revenue Calculation',
    description: 'Alert when revenue calculation takes longer than expected',
    condition: {
      metric: 'revenue.calculation.duration',
      operator: '>',
      threshold: 5000, // 5 seconds
      duration: '5m',
      aggregation: 'p95'
    },
    severity: AlertSeverity.WARNING,
    channels: [AlertChannel.SLACK],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/revenue-calc-performance',
      team: 'engineering'
    }
  },

  // Revenue Recognition Job Alerts
  {
    id: 'recognition-job-failure',
    name: 'Revenue Recognition Job Failure',
    description: 'Alert when scheduled revenue recognition job fails',
    condition: {
      metric: 'revenue.recognition.job.failures',
      operator: '>',
      threshold: 0,
      duration: '1m',
      aggregation: 'sum'
    },
    severity: AlertSeverity.CRITICAL,
    channels: [AlertChannel.PAGERDUTY, AlertChannel.EMAIL],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/recognition-job-failure',
      team: 'revenue-ops'
    }
  },

  {
    id: 'recognition-job-delay',
    name: 'Revenue Recognition Job Delayed',
    description: 'Alert when recognition job is delayed beyond SLA',
    condition: {
      metric: 'revenue.recognition.job.delay',
      operator: '>',
      threshold: 3600000, // 1 hour in milliseconds
      duration: '1m',
      aggregation: 'max'
    },
    severity: AlertSeverity.HIGH,
    channels: [AlertChannel.SLACK, AlertChannel.EMAIL],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/recognition-job-delay',
      team: 'revenue-ops'
    }
  },

  // Data Integrity Alerts
  {
    id: 'revenue-discrepancy',
    name: 'Revenue Discrepancy Detected',
    description: 'Alert when calculated revenue differs from expected',
    condition: {
      metric: 'revenue.validation.discrepancy',
      operator: '>',
      threshold: 1000, // $1000 discrepancy
      duration: '5m',
      aggregation: 'sum'
    },
    severity: AlertSeverity.HIGH,
    channels: [AlertChannel.SLACK, AlertChannel.EMAIL],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/revenue-discrepancy',
      team: 'finance'
    }
  },

  {
    id: 'ssp-variance',
    name: 'SSP Variance Detected',
    description: 'Alert when SSP calculation shows unusual variance',
    condition: {
      metric: 'revenue.ssp.variance',
      operator: '>',
      threshold: 0.2, // 20% variance
      duration: '10m',
      aggregation: 'avg'
    },
    severity: AlertSeverity.MEDIUM,
    channels: [AlertChannel.SLACK],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/ssp-variance',
      team: 'revenue-ops'
    }
  },

  // Deferred Revenue Alerts
  {
    id: 'deferred-balance-mismatch',
    name: 'Deferred Revenue Balance Mismatch',
    description: 'Alert when deferred revenue balance doesn\'t reconcile',
    condition: {
      metric: 'revenue.deferred.mismatch',
      operator: '>',
      threshold: 100, // $100 mismatch
      duration: '5m',
      aggregation: 'sum'
    },
    severity: AlertSeverity.HIGH,
    channels: [AlertChannel.SLACK, AlertChannel.EMAIL],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/deferred-mismatch',
      team: 'finance'
    }
  },

  // Performance Obligation Alerts
  {
    id: 'po-satisfaction-overdue',
    name: 'Performance Obligation Overdue',
    description: 'Alert when performance obligations are not satisfied on time',
    condition: {
      metric: 'revenue.po.overdue.count',
      operator: '>',
      threshold: 10,
      duration: '10m',
      aggregation: 'sum'
    },
    severity: AlertSeverity.MEDIUM,
    channels: [AlertChannel.SLACK],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/po-overdue',
      team: 'revenue-ops'
    }
  },

  // Journal Entry Alerts
  {
    id: 'journal-entry-imbalance',
    name: 'Journal Entry Imbalance',
    description: 'Alert when journal entries don\'t balance',
    condition: {
      metric: 'revenue.journal.imbalance',
      operator: '>',
      threshold: 0.01, // $0.01 imbalance
      duration: '1m',
      aggregation: 'sum'
    },
    severity: AlertSeverity.CRITICAL,
    channels: [AlertChannel.PAGERDUTY, AlertChannel.SLACK],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/journal-imbalance',
      team: 'finance'
    }
  },

  // System Health Alerts
  {
    id: 'revenue-db-connection-pool',
    name: 'Database Connection Pool Exhausted',
    description: 'Alert when database connection pool is exhausted',
    condition: {
      metric: 'database.connections.available',
      operator: '<',
      threshold: 5,
      duration: '2m',
      aggregation: 'min'
    },
    severity: AlertSeverity.HIGH,
    channels: [AlertChannel.PAGERDUTY, AlertChannel.SLACK],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/db-connection-pool',
      team: 'engineering'
    }
  },

  {
    id: 'revenue-queue-backlog',
    name: 'Revenue Processing Queue Backlog',
    description: 'Alert when revenue processing queue has significant backlog',
    condition: {
      metric: 'queue.revenue.backlog',
      operator: '>',
      threshold: 1000,
      duration: '5m',
      aggregation: 'avg'
    },
    severity: AlertSeverity.MEDIUM,
    channels: [AlertChannel.SLACK],
    metadata: {
      runbook: 'https://docs.glapi.com/runbooks/queue-backlog',
      team: 'engineering'
    }
  }
];

/**
 * Custom Alert Handlers
 */
export class RevenueAlertHandler {
  /**
   * Handle revenue calculation failure
   */
  async handleCalculationFailure(alert: any): Promise<void> {
    // Log detailed error information
    console.error('Revenue calculation failed:', {
      subscriptionId: alert.metadata.subscriptionId,
      error: alert.metadata.error,
      timestamp: alert.timestamp
    });

    // Create incident ticket
    await this.createIncident({
      title: `Revenue Calculation Failed - ${alert.metadata.subscriptionId}`,
      severity: 'high',
      assignee: 'revenue-ops',
      details: alert.metadata
    });

    // Attempt automatic retry if applicable
    if (alert.metadata.retryable) {
      await this.scheduleRetry(alert.metadata.subscriptionId);
    }
  }

  /**
   * Handle revenue discrepancy
   */
  async handleDiscrepancy(alert: any): Promise<void> {
    // Generate discrepancy report
    const report = await this.generateDiscrepancyReport({
      subscriptionId: alert.metadata.subscriptionId,
      expected: alert.metadata.expected,
      actual: alert.metadata.actual,
      difference: alert.metadata.difference
    });

    // Notify finance team
    await this.notifyFinance(report);

    // Create audit log entry
    await this.auditLog({
      event: 'revenue_discrepancy',
      details: report,
      timestamp: new Date()
    });
  }

  /**
   * Handle deferred revenue mismatch
   */
  async handleDeferredMismatch(alert: any): Promise<void> {
    // Trigger reconciliation process
    await this.triggerReconciliation({
      type: 'deferred_revenue',
      date: alert.metadata.date,
      discrepancy: alert.metadata.discrepancy
    });

    // Generate reconciliation report
    const report = await this.generateReconciliationReport();

    // Notify stakeholders
    await this.notifyStakeholders(report);
  }

  private async createIncident(incident: any): Promise<void> {
    // Implementation for creating incident ticket
    console.log('Creating incident:', incident);
  }

  private async scheduleRetry(subscriptionId: string): Promise<void> {
    // Implementation for scheduling retry
    console.log('Scheduling retry for:', subscriptionId);
  }

  private async generateDiscrepancyReport(data: any): Promise<any> {
    // Implementation for generating report
    return {
      ...data,
      generatedAt: new Date(),
      reportId: `RPT-${Date.now()}`
    };
  }

  private async notifyFinance(report: any): Promise<void> {
    // Implementation for notifying finance team
    console.log('Notifying finance team:', report);
  }

  private async auditLog(entry: any): Promise<void> {
    // Implementation for audit logging
    console.log('Audit log entry:', entry);
  }

  private async triggerReconciliation(params: any): Promise<void> {
    // Implementation for triggering reconciliation
    console.log('Triggering reconciliation:', params);
  }

  private async generateReconciliationReport(): Promise<any> {
    // Implementation for generating reconciliation report
    return {
      reportId: `REC-${Date.now()}`,
      generatedAt: new Date()
    };
  }

  private async notifyStakeholders(report: any): Promise<void> {
    // Implementation for notifying stakeholders
    console.log('Notifying stakeholders:', report);
  }
}

/**
 * Monitoring Dashboard Configuration
 */
export const revenueDashboards = {
  main: {
    name: 'Revenue Recognition Overview',
    widgets: [
      {
        type: 'metric',
        title: 'Total ARR',
        query: 'sum(revenue.arr.total)',
        format: 'currency'
      },
      {
        type: 'metric',
        title: 'MRR',
        query: 'sum(revenue.mrr.total)',
        format: 'currency'
      },
      {
        type: 'metric',
        title: 'Deferred Revenue',
        query: 'sum(revenue.deferred.balance)',
        format: 'currency'
      },
      {
        type: 'timeseries',
        title: 'Revenue Recognition Trend',
        query: 'sum(revenue.recognized.amount) by (day)',
        period: '30d'
      },
      {
        type: 'timeseries',
        title: 'Calculation Performance',
        query: 'p95(revenue.calculation.duration)',
        period: '7d'
      },
      {
        type: 'table',
        title: 'Recent Failures',
        query: 'revenue.calculation.failures | last 10',
        columns: ['timestamp', 'subscriptionId', 'error', 'duration']
      }
    ]
  },

  performance: {
    name: 'Revenue System Performance',
    widgets: [
      {
        type: 'timeseries',
        title: 'API Response Time',
        query: 'p50,p95,p99(api.response.time) where service="revenue"',
        period: '24h'
      },
      {
        type: 'timeseries',
        title: 'Database Query Performance',
        query: 'avg(db.query.duration) by (query_type)',
        period: '24h'
      },
      {
        type: 'metric',
        title: 'Queue Backlog',
        query: 'max(queue.revenue.backlog)',
        format: 'number'
      },
      {
        type: 'heatmap',
        title: 'Error Rate by Endpoint',
        query: 'rate(api.errors) by (endpoint)',
        period: '1h'
      }
    ]
  },

  compliance: {
    name: 'Revenue Compliance Dashboard',
    widgets: [
      {
        type: 'metric',
        title: 'ASC 606 Compliance Score',
        query: 'revenue.compliance.score',
        format: 'percentage'
      },
      {
        type: 'table',
        title: 'Audit Violations',
        query: 'revenue.audit.violations | last 20',
        columns: ['timestamp', 'type', 'severity', 'details']
      },
      {
        type: 'timeseries',
        title: 'SSP Variance Trend',
        query: 'avg(revenue.ssp.variance) by (item_type)',
        period: '30d'
      },
      {
        type: 'metric',
        title: 'Journal Entry Balance',
        query: 'sum(abs(revenue.journal.imbalance))',
        format: 'currency'
      }
    ]
  }
};

/**
 * Alert Types and Interfaces
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
  WEBHOOK = 'webhook'
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  channels: AlertChannel[];
  metadata?: Record<string, any>;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  threshold: number;
  duration: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'p50' | 'p95' | 'p99';
}

export default {
  revenueAlertRules,
  RevenueAlertHandler,
  revenueDashboards
};