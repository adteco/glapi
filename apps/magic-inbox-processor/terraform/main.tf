terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for remote state
  # backend "s3" {
  #   bucket = "adteco-terraform-state"
  #   key    = "magic-inbox-processor/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "magic-inbox"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ============================================================================
# Data Sources
# ============================================================================

data "aws_caller_identity" "current" {}

data "aws_s3_bucket" "email_bucket" {
  bucket = var.email_bucket_name
}

data "aws_sns_topic" "email_notifications" {
  name = split(":", var.sns_topic_arn)[5]
}

# ============================================================================
# IAM Role for Lambda
# ============================================================================

resource "aws_iam_role" "lambda_role" {
  name = "magic-inbox-processor-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# CloudWatch Logs policy
resource "aws_iam_role_policy" "lambda_logs" {
  name = "cloudwatch-logs"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
}

# S3 read access for email bucket
resource "aws_iam_role_policy" "lambda_s3" {
  name = "s3-email-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion"
        ]
        Resource = "${data.aws_s3_bucket.email_bucket.arn}/${var.email_bucket_prefix}*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = data.aws_s3_bucket.email_bucket.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["${var.email_bucket_prefix}*"]
          }
        }
      }
    ]
  })
}

# ============================================================================
# Lambda Function
# ============================================================================

resource "aws_lambda_function" "magic_inbox_processor" {
  function_name = "magic-inbox-processor-${var.environment}"
  description   = "Processes incoming emails from SES and creates pending documents in GLAPI"

  filename         = "${path.module}/../function.zip"
  source_code_hash = filebase64sha256("${path.module}/../function.zip")

  handler = "index.handler"
  runtime = "nodejs20.x"

  role        = aws_iam_role.lambda_role.arn
  memory_size = var.lambda_memory_size
  timeout     = var.lambda_timeout

  environment {
    variables = {
      GLAPI_BASE_URL       = var.glapi_base_url
      GLAPI_INTERNAL_TOKEN = var.glapi_internal_token
      EMAIL_STORAGE_BUCKET = var.email_bucket_name
      ENABLE_AI_EXTRACTION = tostring(var.enable_ai_extraction)
      ANTHROPIC_API_KEY    = var.anthropic_api_key
      NODE_ENV             = var.environment == "prod" ? "production" : "development"
    }
  }

  # Enable X-Ray tracing (optional)
  tracing_config {
    mode = "Active"
  }

  depends_on = [
    aws_iam_role_policy.lambda_logs,
    aws_cloudwatch_log_group.lambda_logs
  ]
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/magic-inbox-processor-${var.environment}"
  retention_in_days = var.log_retention_days
}

# ============================================================================
# SNS Subscription
# ============================================================================

# Allow SNS to invoke Lambda
resource "aws_lambda_permission" "sns_invoke" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.magic_inbox_processor.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = var.sns_topic_arn
}

# Subscribe Lambda to SNS topic
resource "aws_sns_topic_subscription" "lambda_subscription" {
  topic_arn = var.sns_topic_arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.magic_inbox_processor.arn

  depends_on = [aws_lambda_permission.sns_invoke]
}

# ============================================================================
# CloudWatch Alarms (Optional)
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "magic-inbox-processor-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Magic Inbox Processor Lambda errors"

  dimensions = {
    FunctionName = aws_lambda_function.magic_inbox_processor.function_name
  }

  # Uncomment to add SNS notification
  # alarm_actions = [aws_sns_topic.alerts.arn]
}
