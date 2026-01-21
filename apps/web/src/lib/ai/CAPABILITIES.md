# GLAPI Conversational Ledger - Capabilities & Limits

This document outlines the capabilities, limitations, and usage guidelines for the GLAPI conversational ledger assistant.

## Overview

The conversational ledger assistant allows users to interact with the GLAPI accounting system using natural language. It can help with:
- Querying data (customers, vendors, invoices, etc.)
- Creating and updating records
- Generating financial reports
- Explaining accounting concepts

## Capabilities

### Data Queries (Low Risk)

| Capability | Example Utterances | Rate Limit |
|-----------|-------------------|------------|
| List Customers | "Show me all customers", "Find customers named Acme" | 60/min |
| List Vendors | "Show me our vendors", "List suppliers" | 60/min |
| List Employees | "Show all employees", "Find team members" | 60/min |
| List Invoices | "Show unpaid invoices", "Find invoices for customer ABC" | 60/min |
| List Leads/Prospects | "Show sales leads", "List prospects" | 60/min |

### Report Generation (Low Risk)

| Capability | Example Utterances | Rate Limit |
|-----------|-------------------|------------|
| Balance Sheet | "Generate balance sheet", "Show financial position" | 30/min |
| Income Statement | "Show P&L", "Generate income statement" | 30/min |
| Cash Flow Statement | "Show cash flow", "Generate cash position" | 30/min |

### Data Creation (Medium Risk - Requires Confirmation)

| Capability | Example Utterances | Rate Limit |
|-----------|-------------------|------------|
| Create Customer | "Create a new customer called Acme Corp" | 30/min |
| Create Vendor | "Add a new vendor" | 30/min |
| Create Employee | "Add a new team member" | 30/min |
| Create Lead | "Register a new lead" | 30/min |

### Financial Operations (High Risk - Requires Confirmation)

| Capability | Example Utterances | Rate Limit |
|-----------|-------------------|------------|
| Create Invoice | "Create an invoice for $5000" | 20/min |
| Create Payment | "Record a payment" | 20/min |

### Accounting Operations (Critical - Requires Elevated Permissions)

| Capability | Example Utterances | Rate Limit | Required Role |
|-----------|-------------------|------------|---------------|
| Create Journal Entry | "Create a journal entry" | 10/min | Accountant+ |
| Post Journal Entry | "Post the journal entry" | 10/min | Accountant+ |

### General Help

| Capability | Example Utterances | Rate Limit |
|-----------|-------------------|------------|
| Help | "What can you do?", "Help" | 100/min |
| Explain Concepts | "What is a journal entry?", "Explain ASC 606" | 60/min |

## Limitations

### What the Assistant Cannot Do

1. **Direct Database Access**: Cannot run arbitrary SQL queries
2. **System Configuration**: Cannot modify system settings (admin only via UI)
3. **Bulk Operations**: Limited to single-record operations
4. **File Uploads**: Cannot process file attachments
5. **External Integrations**: Cannot directly call external APIs

### Safety Restrictions

1. **Content Safety**: Blocks SQL injection, script injection, prompt injection attempts
2. **PII Detection**: Warns when sensitive data (SSN, credit cards) is detected
3. **Rate Limiting**: Enforces per-minute limits based on operation risk level
4. **Financial Limits**: Enforces transaction amount limits by role:
   - Admin: Unlimited
   - Accountant: $1,000,000
   - Manager: $100,000
   - Staff: $10,000
   - Viewer: No financial operations

### Role-Based Restrictions

| Role | Can Read | Can Write | Can Delete | Critical Ops |
|------|----------|-----------|------------|--------------|
| Admin | All | All | All | Yes |
| Accountant | All | Most | No | Journal entries |
| Manager | All | Business data | No | No |
| Staff | Limited | Limited | No | No |
| Viewer | All | No | No | No |

## Observability

### Telemetry Events

The assistant tracks the following events in PostHog:

| Event | Description | Properties |
|-------|-------------|------------|
| `conversational_ledger_opened` | User opens chat | conversationId |
| `conversational_ledger_message_sent` | User sends message | conversationId, messageLength |
| `conversational_ledger_response_received` | AI responds | conversationId, intentId, riskLevel, success |
| `conversational_ledger_action_confirmed` | User confirms action | conversationId, pendingActionId, riskLevel |
| `conversational_ledger_action_cancelled` | User cancels action | conversationId, pendingActionId |
| `conversational_ledger_action_completed` | Action executed | conversationId, success, intentId |
| `conversational_ledger_error` | Error occurred | conversationId, error |

### Audit Logging

All operations are logged with:
- Timestamp
- User ID and organization
- Intent/tool attempted
- Whether allowed or denied
- Confirmation status
- Risk level
- Sanitized parameters

### Recommended Dashboards

1. **Usage Dashboard**
   - Messages per day/hour
   - Unique users per day
   - Most common intents
   - Average conversation length

2. **Error Dashboard**
   - Errors per day
   - Error types breakdown
   - Failed intent attempts
   - Rate limit hits

3. **Safety Dashboard**
   - Blocked requests by reason
   - PII detections
   - High-risk operations confirmed vs cancelled
   - Permission denials by role

## Best Practices

### For Users

1. Be specific in your requests
2. Review confirmation dialogs carefully before confirming
3. Start with queries before attempting modifications
4. Report any unexpected behavior to administrators

### For Administrators

1. Review audit logs regularly for high-risk operations
2. Monitor the safety dashboard for anomalies
3. Adjust rate limits if needed
4. Review and update role permissions quarterly

## Troubleshooting

### Common Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| "Permission denied" | User lacks required permission | Contact admin to update role |
| "Rate limit exceeded" | Too many requests | Wait a minute and try again |
| "Action requires confirmation" | High-risk operation | Review and confirm or cancel |
| "Session expired" | Inactive for too long | Refresh and try again |

### Error Codes

| Code | Meaning |
|------|---------|
| PERMISSION_DENIED | User lacks required permission |
| RATE_LIMITED | Rate limit exceeded |
| BLOCKED_CONTENT | Content safety violation |
| FINANCIAL_LIMIT_EXCEEDED | Transaction exceeds limit |
| CONFIRMATION_REQUIRED | Action needs user confirmation |

---

*Last Updated: January 2026*
*Version: 1.0.0*
