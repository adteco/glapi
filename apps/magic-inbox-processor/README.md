# Magic Inbox Processor

AWS Lambda function that processes incoming emails from SES and creates pending documents in GLAPI.

## Architecture

```
Email → SES → S3 (storage) + SNS (notification)
                              ↓
                         Lambda (this)
                              ↓
                    GLAPI /api/internal/magic-inbox/lookup
                              ↓
                    GLAPI /api/webhooks/magic-inbox
                              ↓
                      Pending Document Created
```

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform >= 1.0
- Node.js 20.x
- pnpm

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GLAPI_BASE_URL` | Base URL for GLAPI (e.g., `https://api.adteco.ai`) | Yes |
| `GLAPI_INTERNAL_TOKEN` | Internal API token for authentication | Yes |
| `EMAIL_STORAGE_BUCKET` | S3 bucket name for email storage | No |
| `ENABLE_AI_EXTRACTION` | Enable AI-powered extraction (`true`/`false`) | No |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI extraction | No |

## Deployment

### 1. Build the Lambda

```bash
pnpm build:zip
```

This creates `function.zip` with the bundled Lambda code.

### 2. Configure Terraform

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### 3. Deploy with Terraform

```bash
# Initialize Terraform (first time only)
pnpm tf:init

# Preview changes
pnpm tf:plan

# Apply changes
pnpm tf:apply
```

### 4. Update Code Only

If you only need to update the Lambda code (no infrastructure changes):

```bash
pnpm deploy:code
```

## GLAPI Setup

Before the Lambda can work, you need to:

1. Set `INTERNAL_API_KEY` environment variable in GLAPI API server
2. Enable Magic Inbox for an organization via admin settings
3. The organization will get an email address like `yourprefix@adteco.ai`

## Testing

### Local Testing

```bash
pnpm test
```

### Test with Sample SNS Event

Create a test event in AWS Lambda console or use:

```bash
aws lambda invoke \
  --function-name magic-inbox-processor-prod \
  --payload file://test-event.json \
  response.json
```

## Monitoring

- **CloudWatch Logs**: `/aws/lambda/magic-inbox-processor-prod`
- **CloudWatch Alarm**: Alerts on >5 errors in 5 minutes

## Troubleshooting

### Lambda not receiving events

1. Check SNS subscription is active
2. Verify Lambda has permission to be invoked by SNS
3. Check SES receipt rule is publishing to the correct SNS topic

### "No organization found for email"

1. Ensure Magic Inbox is enabled for the organization in GLAPI
2. Check the email prefix matches what's configured
3. Verify the lookup endpoint is accessible

### S3 access denied

1. Check the Lambda role has S3 read permissions
2. Verify the bucket name and prefix are correct
