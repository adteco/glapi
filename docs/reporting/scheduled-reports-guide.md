# Scheduled Reports Guide

This guide covers the scheduled reports feature, including setup, monitoring, and troubleshooting.

## Overview

The scheduled reports system allows you to automate report generation and delivery on a recurring basis. Reports can be delivered via email or webhook, with support for multiple output formats (JSON, CSV, PDF, XLSX).

## Features

- **Multiple frequencies**: Once, daily, weekly, monthly, quarterly, yearly, or custom cron expressions
- **Timezone support**: All schedules respect IANA timezone settings
- **Multiple delivery methods**: Email with attachments, webhook (POST/PUT)
- **Retry logic**: Automatic retries with exponential backoff
- **Dead letter queue**: Failed deliveries are captured for manual review
- **Monitoring dashboard**: Real-time visibility into delivery status

## Creating a Schedule

### Using the UI

1. Navigate to **Reports > Scheduled Reports**
2. Click **New Schedule**
3. Fill in the schedule details:
   - **Name**: A descriptive name for the schedule
   - **Report Type**: The type of report to generate
   - **Frequency**: How often to run (daily, weekly, etc.)
   - **Time of Day**: When to execute (in your selected timezone)
   - **Output Format**: JSON, CSV, PDF, or XLSX
   - **Delivery Config**: Email recipients or webhook URL

### Using the API

```typescript
// Create a schedule via TRPC
const schedule = await trpc.reportSchedules.create.mutate({
  name: "Monthly Income Statement",
  reportType: "income_statement",
  frequency: "monthly",
  dayOfMonth: 1, // First of the month
  timeOfDay: "06:00:00",
  timezone: "America/New_York",
  outputFormat: "pdf",
  deliveryConfig: {
    type: "email",
    emailRecipients: ["finance@company.com"],
    emailSubject: "Monthly Income Statement - {{reportName}}",
    emailBodyTemplate: "Please find attached the {{reportType}} report."
  },
  notifyOnSuccess: false,
  notifyOnFailure: true,
  notificationEmails: ["admin@company.com"]
});
```

## Delivery Methods

### Email Delivery

Email delivery supports:
- Multiple recipients
- Custom subject and body templates with placeholders
- File attachments in any output format

**Template placeholders**:
- `{{reportName}}` - The schedule name
- `{{reportType}}` - The report type
- `{{executionDate}}` - When the report was generated

### Webhook Delivery

Webhook delivery sends a POST or PUT request with:
- Report data (JSON or base64-encoded for binary formats)
- Metadata including report type, content type, and filename
- Custom headers for authentication

**Webhook payload format**:
```json
{
  "report": { /* report data */ },
  "metadata": {
    "scheduleId": "uuid",
    "executionId": "uuid",
    "reportType": "income_statement"
  },
  "contentType": "application/json",
  "filename": "income_statement_2026-01.json",
  "deliveredAt": "2026-01-15T10:00:00Z"
}
```

## Monitoring

### Dashboard Overview

Access the monitoring dashboard at **Reports > Scheduled Reports > Monitoring**

The dashboard shows:
- **Active Schedules**: Number of currently active schedules
- **Pending Deliveries**: Deliveries waiting to be processed
- **Delivered**: Successfully completed deliveries
- **Dead Letter Queue**: Failed deliveries requiring attention

### Health Indicators

- **Healthy** (green): No items in dead letter queue
- **Attention** (yellow): 1-10 items in dead letter queue
- **Warning** (red): More than 10 items in dead letter queue

### Delivery Pipeline

The pipeline shows the flow of deliveries:
```
Pending → Processing → Delivered
              ↓
          Failed (retrying)
              ↓
        Dead Letter Queue
```

## Troubleshooting

### Common Issues

#### 1. Schedule Not Running

**Symptoms**: Schedule shows as "active" but no executions appear

**Possible Causes**:
- Schedule's `nextRunAt` is in the future
- Schedule has reached `maxRuns` limit
- Schedule's `runUntil` date has passed
- Schedule is disabled (`isEnabled: false`)

**Resolution**:
```sql
-- Check schedule status
SELECT id, name, status, is_enabled, next_run_at, total_runs, max_runs
FROM report_schedules
WHERE id = 'your-schedule-id';
```

#### 2. Email Delivery Failures

**Symptoms**: Deliveries show "failed" status with email-related errors

**Common Error Codes**:
- `EMAIL_DELIVERY_FAILED`: General email sending failure
- `INVALID_CONFIG`: Missing or invalid email recipients

**Resolution**:
1. Verify email addresses are valid
2. Check email provider configuration
3. Review delivery attempt logs in the monitoring dashboard

#### 3. Webhook Delivery Failures

**Symptoms**: Webhook deliveries failing with HTTP errors

**Common Error Codes**:
- `HTTP_401`: Authentication failure - check webhook headers
- `HTTP_500`: Server error on the receiving end
- `WEBHOOK_TIMEOUT`: Request took longer than timeout setting
- `WEBHOOK_CONNECTION_FAILED`: Cannot reach the webhook URL

**Resolution**:
1. Verify the webhook URL is accessible
2. Check authentication headers are correct
3. Increase timeout if the endpoint is slow
4. Test the webhook endpoint directly

#### 4. Dead Letter Queue Items

**Symptoms**: Items appearing in the dead letter queue

**Cause**: Delivery failed after maximum retry attempts (default: 5)

**Resolution**:
1. Go to **Monitoring > Dead Letter Queue**
2. Review the error message for each item
3. Fix the underlying issue (e.g., invalid email, unavailable webhook)
4. Click **Retry** to reprocess the delivery

### Retry Logic

Deliveries use exponential backoff with jitter:
- Attempt 1: Immediate
- Attempt 2: ~5 seconds delay
- Attempt 3: ~10 seconds delay
- Attempt 4: ~20 seconds delay
- Attempt 5: ~40 seconds delay
- After 5 failures: Moved to dead letter queue

### Logs and Audit Trail

Every delivery attempt is logged with:
- Start and completion timestamps
- Duration in milliseconds
- HTTP status (for webhooks)
- Error details if failed

Access logs via the API:
```typescript
const attempts = await trpc.deliveryQueue.getAttempts.query({
  deliveryId: "delivery-uuid"
});
```

## Configuration Reference

### Schedule Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name for the schedule |
| `reportType` | enum | Type of report to generate |
| `frequency` | enum | How often to run (once, daily, weekly, monthly, quarterly, yearly, cron) |
| `cronExpression` | string | Custom cron expression (when frequency is "cron") |
| `timezone` | string | IANA timezone name (e.g., "America/New_York") |
| `dayOfWeek` | number | 0-6 for weekly schedules (0 = Sunday) |
| `dayOfMonth` | number | 1-31 for monthly schedules |
| `timeOfDay` | string | HH:MM:SS format (e.g., "06:00:00") |
| `outputFormat` | enum | json, csv, pdf, xlsx |
| `maxRetries` | number | Max delivery retry attempts (default: 3) |
| `retryDelaySeconds` | number | Base delay between retries (default: 300) |
| `runUntil` | date | Stop running after this date |
| `maxRuns` | number | Stop after this many executions |

### Delivery Config Fields

**Email**:
| Field | Type | Description |
|-------|------|-------------|
| `emailRecipients` | string[] | List of email addresses |
| `emailSubject` | string | Email subject (supports placeholders) |
| `emailBodyTemplate` | string | Plain text body |
| `emailBodyHtml` | string | HTML body |
| `attachmentFilename` | string | Custom filename for attachment |

**Webhook**:
| Field | Type | Description |
|-------|------|-------------|
| `webhookUrl` | string | URL to POST/PUT to |
| `webhookMethod` | enum | POST or PUT |
| `webhookHeaders` | object | Custom HTTP headers |
| `webhookTimeout` | number | Timeout in milliseconds (default: 30000) |

## API Reference

### TRPC Routes

**Schedules**:
- `reportSchedules.create` - Create a new schedule
- `reportSchedules.get` - Get schedule by ID
- `reportSchedules.update` - Update a schedule
- `reportSchedules.delete` - Delete a schedule
- `reportSchedules.list` - List schedules with filters
- `reportSchedules.activate` - Activate a draft schedule
- `reportSchedules.pause` - Pause an active schedule
- `reportSchedules.resume` - Resume a paused schedule
- `reportSchedules.triggerExecution` - Manually trigger a run
- `reportSchedules.getStats` - Get scheduler statistics

**Delivery Queue**:
- `deliveryQueue.list` - List deliveries with filters
- `deliveryQueue.get` - Get delivery by ID
- `deliveryQueue.getAttempts` - Get delivery attempt history
- `deliveryQueue.getStats` - Get delivery statistics
- `deliveryQueue.getDashboardStats` - Get combined dashboard stats
- `deliveryQueue.getDeadLetterItems` - Get dead letter queue items
- `deliveryQueue.retryDeadLetter` - Retry a single dead letter item
- `deliveryQueue.retryDeadLetterBulk` - Retry multiple dead letter items
- `deliveryQueue.validateConfig` - Validate a delivery config

## Best Practices

1. **Set appropriate timeouts**: Webhook timeouts should match your endpoint's response time
2. **Use timezone-aware scheduling**: Always specify a timezone to avoid DST issues
3. **Monitor the dead letter queue**: Set up alerts for items in the DLQ
4. **Test webhooks before production**: Use the validate config endpoint to check webhook accessibility
5. **Use notification emails**: Enable failure notifications to catch issues early
6. **Review execution history**: Periodically check success rates in the UI
