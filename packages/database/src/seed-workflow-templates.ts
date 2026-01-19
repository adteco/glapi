/**
 * Seed file for common workflow automation templates
 *
 * This file provides pre-configured workflow definitions demonstrating
 * the workflow automation engine capabilities.
 *
 * Usage:
 *   pnpm --filter database seed:workflow-templates
 *
 * Templates included:
 *   - Order-to-Cash (shipping + alerting)
 *   - Invoice Overdue Alerting
 *   - High-Value Transaction Alert
 *   - Monthly Close Schedule
 *   - New Customer Welcome
 */

import { db } from './db';
import {
  workflowDefinitions,
  workflowSteps,
  workflowEventSubscriptions,
  workflowSchedules,
  type EventTriggerConfig,
  type ScheduleTriggerConfig,
  type InternalActionConfig,
  type NotificationActionConfig,
  type ConditionActionConfig,
  type DelayActionConfig,
  type TransformActionConfig,
} from './db/schema/workflow-automation';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// ============================================================================
// Workflow Templates
// ============================================================================

interface WorkflowTemplate {
  workflowCode: string;
  name: string;
  description: string;
  triggerType: 'event' | 'schedule' | 'webhook' | 'manual' | 'api';
  triggerConfig: EventTriggerConfig | ScheduleTriggerConfig;
  category: string;
  tags: string[];
  steps: WorkflowStepTemplate[];
  eventSubscription?: {
    eventType: string;
    documentTypes?: string[];
  };
  schedule?: {
    cronExpression: string;
    timezone: string;
  };
}

interface WorkflowStepTemplate {
  stepCode: string;
  stepName: string;
  description?: string;
  stepOrder: number;
  actionType: 'webhook' | 'internal_action' | 'notification' | 'condition' | 'delay' | 'transform' | 'approval' | 'loop' | 'parallel' | 'sub_workflow';
  actionConfig: InternalActionConfig | NotificationActionConfig | ConditionActionConfig | DelayActionConfig | TransformActionConfig;
  errorStrategy?: 'stop' | 'continue' | 'retry' | 'branch';
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

// ============================================================================
// Template: Order-to-Cash (Shipping to Cash with Alerting)
// ============================================================================

const orderToCashWorkflow: WorkflowTemplate = {
  workflowCode: 'ORDER_TO_CASH',
  name: 'Order-to-Cash Processing',
  description: 'Automates the order-to-cash cycle: order confirmation, shipping notification, invoice generation, and payment reminders',
  triggerType: 'event',
  triggerConfig: {
    eventType: 'sales_order.approved',
    documentTypes: ['sales_order'],
    conditions: [
      { field: 'status', operator: 'eq', value: 'approved' },
    ],
  } as EventTriggerConfig,
  category: 'revenue',
  tags: ['order-to-cash', 'shipping', 'invoicing', 'automation'],
  steps: [
    {
      stepCode: 'CONFIRM_ORDER',
      stepName: 'Send Order Confirmation',
      description: 'Send order confirmation notification to customer',
      stepOrder: 1,
      actionType: 'notification',
      actionConfig: {
        channels: ['email', 'in_app'],
        recipients: {
          dynamicRecipient: '{{customer.email}}',
        },
        subjectTemplate: 'Order Confirmation - {{order.orderNumber}}',
        bodyTemplate: 'Thank you for your order #{{order.orderNumber}}. Total: {{formatCurrency order.totalAmount}}. We will notify you when it ships.',
        priority: 'normal',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'CREATE_SHIPPING',
      stepName: 'Create Shipping Record',
      description: 'Create shipping/fulfillment record for the order',
      stepOrder: 2,
      actionType: 'internal_action',
      actionConfig: {
        actionName: 'createShippingRecord',
        parameterTemplates: {
          orderId: '{{order.id}}',
          warehouseId: '{{order.warehouseId}}',
          items: '{{order.lineItems}}',
        },
      } as InternalActionConfig,
      errorStrategy: 'stop',
      maxRetries: 3,
      retryDelayMs: 60000,
    },
    {
      stepCode: 'WAIT_SHIPMENT',
      stepName: 'Wait for Shipment',
      description: 'Wait for shipment to be marked as shipped',
      stepOrder: 3,
      actionType: 'delay',
      actionConfig: {
        delayType: 'until_condition',
        untilCondition: [
          { field: 'shipping.status', operator: 'eq', value: 'shipped' },
        ],
        pollIntervalMs: 300000, // 5 minutes
        maxWaitMs: 604800000, // 7 days
      } as DelayActionConfig,
      errorStrategy: 'branch',
      timeoutMs: 604800000,
    },
    {
      stepCode: 'NOTIFY_SHIPPED',
      stepName: 'Send Shipping Notification',
      description: 'Notify customer that order has shipped',
      stepOrder: 4,
      actionType: 'notification',
      actionConfig: {
        channels: ['email', 'sms'],
        recipients: {
          dynamicRecipient: '{{customer.email}}',
        },
        subjectTemplate: 'Your Order #{{order.orderNumber}} Has Shipped!',
        bodyTemplate: 'Great news! Your order has shipped. Tracking: {{shipping.trackingNumber}}. Expected delivery: {{formatDate shipping.estimatedDelivery}}.',
        priority: 'normal',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'CREATE_INVOICE',
      stepName: 'Generate Invoice',
      description: 'Create invoice from the shipped order',
      stepOrder: 5,
      actionType: 'internal_action',
      actionConfig: {
        actionName: 'createInvoiceFromOrder',
        parameterTemplates: {
          orderId: '{{order.id}}',
          shippingId: '{{shipping.id}}',
          invoiceDate: '{{now}}',
          dueDate: '{{addDays now 30}}',
        },
      } as InternalActionConfig,
      errorStrategy: 'stop',
      maxRetries: 3,
    },
    {
      stepCode: 'NOTIFY_INVOICE',
      stepName: 'Send Invoice Notification',
      description: 'Send invoice to customer',
      stepOrder: 6,
      actionType: 'notification',
      actionConfig: {
        channels: ['email'],
        recipients: {
          dynamicRecipient: '{{customer.email}}',
        },
        subjectTemplate: 'Invoice #{{invoice.invoiceNumber}} - Payment Due {{formatDate invoice.dueDate}}',
        bodyTemplate: 'Please find attached your invoice #{{invoice.invoiceNumber}} for ${{formatCurrency invoice.totalAmount}}. Payment is due by {{formatDate invoice.dueDate}}.',
        priority: 'normal',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
  ],
  eventSubscription: {
    eventType: 'sales_order.approved',
    documentTypes: ['sales_order'],
  },
};

// ============================================================================
// Template: Invoice Overdue Alerting
// ============================================================================

const invoiceOverdueWorkflow: WorkflowTemplate = {
  workflowCode: 'INVOICE_OVERDUE_ALERT',
  name: 'Invoice Overdue Alerting',
  description: 'Monitors invoices and sends escalating alerts when they become overdue',
  triggerType: 'schedule',
  triggerConfig: {
    cronExpression: '0 8 * * *', // Daily at 8 AM
    timezone: 'America/New_York',
  } as ScheduleTriggerConfig,
  category: 'collections',
  tags: ['invoicing', 'collections', 'alerting', 'ar'],
  steps: [
    {
      stepCode: 'FIND_OVERDUE',
      stepName: 'Find Overdue Invoices',
      description: 'Query for invoices past due date',
      stepOrder: 1,
      actionType: 'internal_action',
      actionConfig: {
        actionName: 'queryOverdueInvoices',
        parameters: {
          daysOverdue: 1,
          status: ['open', 'partially_paid'],
        },
      } as InternalActionConfig,
      errorStrategy: 'stop',
    },
    {
      stepCode: 'CHECK_COUNT',
      stepName: 'Check Overdue Count',
      description: 'Branch based on whether there are overdue invoices',
      stepOrder: 2,
      actionType: 'condition',
      actionConfig: {
        conditions: [
          {
            condition: [
              { field: 'overdueInvoices.count', operator: 'eq', value: 0 },
            ],
            branchName: 'no_overdue',
          },
        ],
        defaultBranchName: 'process_overdue',
      } as ConditionActionConfig,
      errorStrategy: 'stop',
    },
    {
      stepCode: 'CATEGORIZE',
      stepName: 'Categorize by Severity',
      description: 'Transform invoices into severity buckets',
      stepOrder: 3,
      actionType: 'transform',
      actionConfig: {
        transformations: [
          {
            source: '{{overdueInvoices | filter: daysOverdue < 7}}',
            target: 'buckets.mild',
          },
          {
            source: '{{overdueInvoices | filter: daysOverdue >= 7 AND daysOverdue < 30}}',
            target: 'buckets.moderate',
          },
          {
            source: '{{overdueInvoices | filter: daysOverdue >= 30 AND daysOverdue < 60}}',
            target: 'buckets.serious',
          },
          {
            source: '{{overdueInvoices | filter: daysOverdue >= 60}}',
            target: 'buckets.critical',
          },
        ],
      } as TransformActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'ALERT_MILD',
      stepName: 'Send Mild Reminders (1-6 days)',
      description: 'Send friendly payment reminders to customers',
      stepOrder: 4,
      actionType: 'notification',
      actionConfig: {
        channels: ['email'],
        recipients: {
          dynamicRecipient: '{{buckets.mild[*].customer.email}}',
        },
        subjectTemplate: 'Friendly Reminder: Invoice Payment Due',
        bodyTemplate: 'This is a friendly reminder that your invoice #{{invoice.invoiceNumber}} is past due. Please remit payment at your earliest convenience.',
        priority: 'low',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'ALERT_MODERATE',
      stepName: 'Send Moderate Reminders (7-29 days)',
      description: 'Send payment reminders with urgency',
      stepOrder: 5,
      actionType: 'notification',
      actionConfig: {
        channels: ['email', 'in_app'],
        recipients: {
          dynamicRecipient: '{{buckets.moderate[*].customer.email}}',
        },
        subjectTemplate: 'Payment Overdue: Invoice #{{invoice.invoiceNumber}}',
        bodyTemplate: 'Your invoice #{{invoice.invoiceNumber}} for ${{formatCurrency invoice.totalAmount}} is {{invoice.daysOverdue}} days overdue. Please contact us if you need to discuss payment arrangements.',
        priority: 'normal',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'ALERT_SERIOUS',
      stepName: 'Send Serious Alerts (30-59 days)',
      description: 'Send urgent alerts to customer and internal team',
      stepOrder: 6,
      actionType: 'notification',
      actionConfig: {
        channels: ['email', 'slack', 'in_app'],
        recipients: {
          dynamicRecipient: '{{buckets.serious[*].customer.email}}',
          roleIds: ['role-ar-manager', 'role-collections'],
        },
        subjectTemplate: 'URGENT: Invoice #{{invoice.invoiceNumber}} is {{invoice.daysOverdue}} Days Overdue',
        bodyTemplate: 'Invoice #{{invoice.invoiceNumber}} for ${{formatCurrency invoice.totalAmount}} is seriously overdue. Immediate action required. Account may be placed on credit hold.',
        priority: 'high',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'ALERT_CRITICAL',
      stepName: 'Send Critical Escalation (60+ days)',
      description: 'Escalate to leadership and consider collection action',
      stepOrder: 7,
      actionType: 'notification',
      actionConfig: {
        channels: ['email', 'slack', 'in_app'],
        recipients: {
          roleIds: ['role-cfo', 'role-controller', 'role-ar-manager'],
        },
        subjectTemplate: 'CRITICAL: {{buckets.critical.length}} Invoices 60+ Days Overdue',
        bodyTemplate: 'The following invoices are critically overdue and require executive attention:\n{{#each buckets.critical}}\n- {{customer.name}}: Invoice #{{invoiceNumber}} - ${{formatCurrency totalAmount}} ({{daysOverdue}} days)\n{{/each}}\n\nTotal at risk: ${{formatCurrency buckets.critical.totalAmount}}',
        priority: 'urgent',
      } as NotificationActionConfig,
      errorStrategy: 'stop',
    },
  ],
  schedule: {
    cronExpression: '0 8 * * *',
    timezone: 'America/New_York',
  },
};

// ============================================================================
// Template: High-Value Transaction Alert
// ============================================================================

const highValueTransactionWorkflow: WorkflowTemplate = {
  workflowCode: 'HIGH_VALUE_ALERT',
  name: 'High-Value Transaction Alert',
  description: 'Immediately alerts finance leadership when high-value transactions are created',
  triggerType: 'event',
  triggerConfig: {
    eventType: 'transaction.created',
    documentTypes: ['journal_entry', 'vendor_bill', 'purchase_order', 'invoice'],
    conditions: [
      { field: 'documentAmount', operator: 'gte', value: 100000 },
    ],
  } as EventTriggerConfig,
  category: 'controls',
  tags: ['alerting', 'controls', 'high-value', 'compliance'],
  steps: [
    {
      stepCode: 'ENRICH_DATA',
      stepName: 'Enrich Transaction Data',
      description: 'Fetch additional context about the transaction',
      stepOrder: 1,
      actionType: 'internal_action',
      actionConfig: {
        actionName: 'enrichTransactionData',
        parameterTemplates: {
          transactionId: '{{transaction.id}}',
          documentType: '{{transaction.documentType}}',
        },
      } as InternalActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'CHECK_THRESHOLD',
      stepName: 'Determine Alert Level',
      description: 'Categorize by dollar amount for appropriate escalation',
      stepOrder: 2,
      actionType: 'condition',
      actionConfig: {
        conditions: [
          {
            condition: [
              { field: 'transaction.documentAmount', operator: 'gte', value: 1000000 },
            ],
            branchName: 'critical_alert',
          },
          {
            condition: [
              { field: 'transaction.documentAmount', operator: 'gte', value: 500000 },
            ],
            branchName: 'high_alert',
          },
        ],
        defaultBranchName: 'standard_alert',
      } as ConditionActionConfig,
      errorStrategy: 'stop',
    },
    {
      stepCode: 'NOTIFY_STANDARD',
      stepName: 'Standard Alert ($100K-$499K)',
      description: 'Notify controller and accounting manager',
      stepOrder: 3,
      actionType: 'notification',
      actionConfig: {
        channels: ['email', 'in_app'],
        recipients: {
          roleIds: ['role-controller', 'role-accounting-manager'],
        },
        subjectTemplate: 'High-Value Transaction: ${{formatCurrency transaction.documentAmount}} - {{transaction.documentType}}',
        bodyTemplate: 'A high-value {{transaction.documentType}} has been created:\n\nAmount: ${{formatCurrency transaction.documentAmount}}\nCreated by: {{transaction.createdByName}}\nDescription: {{transaction.description}}\nReference: {{transaction.referenceNumber}}\n\nPlease review and ensure appropriate approvals are in place.',
        priority: 'high',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'NOTIFY_HIGH',
      stepName: 'High Alert ($500K-$999K)',
      description: 'Notify CFO and controller with urgency',
      stepOrder: 4,
      actionType: 'notification',
      actionConfig: {
        channels: ['email', 'slack', 'in_app'],
        recipients: {
          roleIds: ['role-cfo', 'role-controller'],
        },
        subjectTemplate: '⚠️ HIGH VALUE: ${{formatCurrency transaction.documentAmount}} {{transaction.documentType}}',
        bodyTemplate: 'A very high-value {{transaction.documentType}} requires your attention:\n\nAmount: ${{formatCurrency transaction.documentAmount}}\nCreated by: {{transaction.createdByName}}\nDescription: {{transaction.description}}\n\nThis transaction exceeds the $500K threshold and may require additional approval.',
        priority: 'urgent',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'NOTIFY_CRITICAL',
      stepName: 'Critical Alert ($1M+)',
      description: 'Immediate notification to executive team',
      stepOrder: 5,
      actionType: 'notification',
      actionConfig: {
        channels: ['email', 'slack', 'sms', 'in_app'],
        recipients: {
          roleIds: ['role-ceo', 'role-cfo', 'role-controller'],
        },
        subjectTemplate: '🚨 CRITICAL: ${{formatCurrency transaction.documentAmount}} Transaction Created',
        bodyTemplate: 'IMMEDIATE ATTENTION REQUIRED\n\nA transaction exceeding $1M has been created:\n\nType: {{transaction.documentType}}\nAmount: ${{formatCurrency transaction.documentAmount}}\nCreated by: {{transaction.createdByName}}\nDepartment: {{transaction.departmentName}}\nDescription: {{transaction.description}}\n\nThis requires executive review before processing.',
        priority: 'urgent',
      } as NotificationActionConfig,
      errorStrategy: 'stop',
    },
  ],
  eventSubscription: {
    eventType: 'transaction.created',
    documentTypes: ['journal_entry', 'vendor_bill', 'purchase_order', 'invoice'],
  },
};

// ============================================================================
// Template: Monthly Close Schedule
// ============================================================================

const monthlyCloseWorkflow: WorkflowTemplate = {
  workflowCode: 'MONTHLY_CLOSE',
  name: 'Monthly Close Process',
  description: 'Automates the monthly close checklist with notifications and status tracking',
  triggerType: 'schedule',
  triggerConfig: {
    cronExpression: '0 6 1 * *', // 1st of each month at 6 AM
    timezone: 'America/New_York',
  } as ScheduleTriggerConfig,
  category: 'close',
  tags: ['monthly-close', 'automation', 'checklist', 'finance'],
  steps: [
    {
      stepCode: 'START_CLOSE',
      stepName: 'Initialize Close Period',
      description: 'Mark the period as in closing and notify team',
      stepOrder: 1,
      actionType: 'internal_action',
      actionConfig: {
        actionName: 'initializeClosePeriod',
        parameterTemplates: {
          periodDate: '{{previousMonth}}',
          closeType: 'monthly',
        },
      } as InternalActionConfig,
      errorStrategy: 'stop',
    },
    {
      stepCode: 'NOTIFY_START',
      stepName: 'Send Close Kickoff',
      description: 'Notify accounting team that close has started',
      stepOrder: 2,
      actionType: 'notification',
      actionConfig: {
        channels: ['email', 'slack', 'in_app'],
        recipients: {
          roleIds: ['role-accounting-manager', 'role-accountant', 'role-controller'],
        },
        subjectTemplate: 'Monthly Close Started: {{formatDate previousMonth "MMMM YYYY"}}',
        bodyTemplate: 'The monthly close process for {{formatDate previousMonth "MMMM YYYY"}} has begun.\n\nDeadline: {{formatDate closeDeadline}}\n\nPlease complete your assigned tasks in the close checklist.',
        priority: 'high',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'CHECK_PREREQS',
      stepName: 'Verify Prerequisites',
      description: 'Check that all prerequisite tasks are complete',
      stepOrder: 3,
      actionType: 'internal_action',
      actionConfig: {
        actionName: 'checkClosePrerequisites',
        parameters: {
          checks: [
            'all_transactions_posted',
            'bank_reconciliations_complete',
            'ap_cutoff_verified',
            'ar_cutoff_verified',
            'payroll_posted',
          ],
        },
      } as InternalActionConfig,
      errorStrategy: 'branch',
      timeoutMs: 86400000, // 24 hours
    },
    {
      stepCode: 'RUN_CLOSE_ENTRIES',
      stepName: 'Generate Close Entries',
      description: 'Create standard month-end adjusting entries',
      stepOrder: 4,
      actionType: 'internal_action',
      actionConfig: {
        actionName: 'generateCloseEntries',
        parameterTemplates: {
          periodDate: '{{previousMonth}}',
          entryTypes: '["depreciation", "amortization", "accruals", "prepaids"]',
        },
      } as InternalActionConfig,
      errorStrategy: 'stop',
      maxRetries: 2,
    },
    {
      stepCode: 'GENERATE_REPORTS',
      stepName: 'Generate Financial Reports',
      description: 'Create trial balance and financial statements',
      stepOrder: 5,
      actionType: 'internal_action',
      actionConfig: {
        actionName: 'generateFinancialReports',
        parameterTemplates: {
          periodDate: '{{previousMonth}}',
          reports: '["trial_balance", "income_statement", "balance_sheet", "cash_flow"]',
        },
      } as InternalActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'NOTIFY_REVIEW',
      stepName: 'Request Controller Review',
      description: 'Notify controller to review close package',
      stepOrder: 6,
      actionType: 'notification',
      actionConfig: {
        channels: ['email', 'in_app'],
        recipients: {
          roleIds: ['role-controller'],
        },
        subjectTemplate: 'Monthly Close Ready for Review: {{formatDate previousMonth "MMMM YYYY"}}',
        bodyTemplate: 'The monthly close package for {{formatDate previousMonth "MMMM YYYY"}} is ready for your review.\n\nPlease review the following:\n- Trial Balance\n- Adjusting Entries\n- Financial Statements\n- Variance Analysis\n\nApprove to finalize the close.',
        priority: 'high',
      } as NotificationActionConfig,
      errorStrategy: 'stop',
    },
  ],
  schedule: {
    cronExpression: '0 6 1 * *',
    timezone: 'America/New_York',
  },
};

// ============================================================================
// Template: New Customer Welcome
// ============================================================================

const newCustomerWorkflow: WorkflowTemplate = {
  workflowCode: 'NEW_CUSTOMER_WELCOME',
  name: 'New Customer Welcome',
  description: 'Sends welcome communications and sets up new customer accounts',
  triggerType: 'event',
  triggerConfig: {
    eventType: 'customer.created',
    documentTypes: ['customer'],
  } as EventTriggerConfig,
  category: 'sales',
  tags: ['customer', 'onboarding', 'welcome', 'automation'],
  steps: [
    {
      stepCode: 'SETUP_ACCOUNT',
      stepName: 'Setup Customer Account',
      description: 'Create default settings and payment terms',
      stepOrder: 1,
      actionType: 'internal_action',
      actionConfig: {
        actionName: 'setupCustomerDefaults',
        parameterTemplates: {
          customerId: '{{customer.id}}',
          paymentTerms: '{{customer.paymentTerms || "NET30"}}',
          creditLimit: '{{customer.creditLimit || 10000}}',
        },
      } as InternalActionConfig,
      errorStrategy: 'stop',
    },
    {
      stepCode: 'SEND_WELCOME',
      stepName: 'Send Welcome Email',
      description: 'Send personalized welcome email to customer',
      stepOrder: 2,
      actionType: 'notification',
      actionConfig: {
        channels: ['email'],
        recipients: {
          dynamicRecipient: '{{customer.email}}',
        },
        subjectTemplate: 'Welcome to {{company.name}}, {{customer.contactName}}!',
        bodyTemplate: 'Dear {{customer.contactName}},\n\nWelcome to {{company.name}}! We are excited to have you as a customer.\n\nYour account has been set up with the following details:\n- Customer ID: {{customer.customerNumber}}\n- Payment Terms: {{customer.paymentTerms}}\n- Credit Limit: ${{formatCurrency customer.creditLimit}}\n\nIf you have any questions, please contact your account representative.\n\nBest regards,\n{{company.name}} Team',
        priority: 'normal',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'NOTIFY_SALES',
      stepName: 'Notify Sales Team',
      description: 'Alert sales rep about new customer',
      stepOrder: 3,
      actionType: 'notification',
      actionConfig: {
        channels: ['slack', 'in_app'],
        recipients: {
          dynamicRecipient: '{{customer.salesRepEmail}}',
          roleIds: ['role-sales-manager'],
        },
        subjectTemplate: 'New Customer Created: {{customer.companyName}}',
        bodyTemplate: 'A new customer has been created:\n\nCompany: {{customer.companyName}}\nContact: {{customer.contactName}}\nEmail: {{customer.email}}\nPhone: {{customer.phone}}\n\nPlease reach out within 24 hours to welcome them.',
        priority: 'normal',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'SCHEDULE_FOLLOWUP',
      stepName: 'Schedule Follow-up',
      description: 'Wait 7 days then send follow-up',
      stepOrder: 4,
      actionType: 'delay',
      actionConfig: {
        delayType: 'fixed',
        durationMs: 604800000, // 7 days
      } as DelayActionConfig,
      errorStrategy: 'continue',
    },
    {
      stepCode: 'SEND_FOLLOWUP',
      stepName: 'Send Follow-up Email',
      description: 'Check in with new customer after 7 days',
      stepOrder: 5,
      actionType: 'notification',
      actionConfig: {
        channels: ['email'],
        recipients: {
          dynamicRecipient: '{{customer.email}}',
        },
        subjectTemplate: 'How are things going, {{customer.contactName}}?',
        bodyTemplate: 'Hi {{customer.contactName}},\n\nIt has been a week since you joined us, and we wanted to check in.\n\nHave you had a chance to explore our products? Do you have any questions we can help with?\n\nWe are here to ensure you have the best experience possible.\n\nBest regards,\n{{company.name}} Team',
        priority: 'low',
      } as NotificationActionConfig,
      errorStrategy: 'continue',
    },
  ],
  eventSubscription: {
    eventType: 'customer.created',
    documentTypes: ['customer'],
  },
};

// All workflow templates
const workflowTemplates: WorkflowTemplate[] = [
  orderToCashWorkflow,
  invoiceOverdueWorkflow,
  highValueTransactionWorkflow,
  monthlyCloseWorkflow,
  newCustomerWorkflow,
];

// ============================================================================
// Seeding Functions
// ============================================================================

async function seedWorkflowTemplates(organizationId: string) {
  console.log('Seeding workflow templates...');

  for (const template of workflowTemplates) {
    // Check if workflow already exists
    const existing = await db.select()
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.organizationId, organizationId),
          eq(workflowDefinitions.workflowCode, template.workflowCode)
        )
      );

    if (existing.length > 0) {
      console.log(`  Workflow ${template.workflowCode} already exists, skipping...`);
      continue;
    }

    // Create workflow definition
    const workflowId = createId();
    await db.insert(workflowDefinitions).values({
      id: workflowId,
      organizationId,
      name: template.name,
      description: template.description,
      workflowCode: template.workflowCode,
      version: 1,
      isLatestVersion: true,
      status: 'draft', // Created as draft, user can activate
      triggerType: template.triggerType,
      triggerConfig: template.triggerConfig,
      category: template.category,
      tags: template.tags,
      maxExecutionTimeMs: 3600000,
      maxRetries: 3,
      retryDelayMs: 60000,
      enableLogging: true,
      enableMetrics: true,
    });

    console.log(`  Created workflow: ${template.name}`);

    // Create steps
    for (const stepTemplate of template.steps) {
      const stepId = createId();
      await db.insert(workflowSteps).values({
        id: stepId,
        workflowDefinitionId: workflowId,
        stepCode: stepTemplate.stepCode,
        stepName: stepTemplate.stepName,
        description: stepTemplate.description,
        stepOrder: stepTemplate.stepOrder,
        actionType: stepTemplate.actionType,
        actionConfig: stepTemplate.actionConfig,
        errorStrategy: stepTemplate.errorStrategy || 'stop',
        maxRetries: stepTemplate.maxRetries,
        retryDelayMs: stepTemplate.retryDelayMs,
        timeoutMs: stepTemplate.timeoutMs,
      });
    }

    console.log(`    Created ${template.steps.length} step(s)`);

    // Create event subscription if applicable
    if (template.eventSubscription) {
      await db.insert(workflowEventSubscriptions).values({
        id: createId(),
        organizationId,
        workflowDefinitionId: workflowId,
        eventType: template.eventSubscription.eventType,
        documentTypes: template.eventSubscription.documentTypes || null,
        isActive: false, // Inactive until workflow is activated
      });
      console.log(`    Created event subscription for: ${template.eventSubscription.eventType}`);
    }

    // Create schedule if applicable
    if (template.schedule) {
      await db.insert(workflowSchedules).values({
        id: createId(),
        organizationId,
        workflowDefinitionId: workflowId,
        cronExpression: template.schedule.cronExpression,
        timezone: template.schedule.timezone,
        isActive: false, // Inactive until workflow is activated
      });
      console.log(`    Created schedule: ${template.schedule.cronExpression}`);
    }
  }
}

async function seedAllWorkflowTemplates(organizationId: string) {
  console.log(`\nSeeding workflow templates for organization: ${organizationId}`);
  console.log('='.repeat(60));

  try {
    await seedWorkflowTemplates(organizationId);

    console.log('\n' + '='.repeat(60));
    console.log('Workflow templates seeded successfully!');
    console.log(`\nCreated ${workflowTemplates.length} workflow definitions`);
    console.log('\nTemplates created:');
    for (const template of workflowTemplates) {
      console.log(`  - ${template.name} (${template.workflowCode})`);
    }
    console.log('\nNote: All workflows are created in "draft" status.');
    console.log('Activate them by changing status to "active" in the UI or API.');
  } catch (error) {
    console.error('Error seeding workflow templates:', error);
    throw error;
  }
}

// ============================================================================
// Export for programmatic use
// ============================================================================

export {
  workflowTemplates,
  seedWorkflowTemplates,
  seedAllWorkflowTemplates,
  WorkflowTemplate,
  WorkflowStepTemplate,
};

// ============================================================================
// CLI execution
// ============================================================================

async function main() {
  const organizationId = process.env.ORGANIZATION_ID || 'org-default';

  console.log('Workflow Template Seed Script');
  console.log('='.repeat(60));
  console.log(`Organization ID: ${organizationId}`);
  console.log('');

  try {
    await seedAllWorkflowTemplates(organizationId);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await db.$client.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
