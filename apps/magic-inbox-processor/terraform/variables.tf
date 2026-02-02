variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "sns_topic_arn" {
  description = "ARN of the SNS topic that receives SES notifications"
  type        = string
  default     = "arn:aws:sns:us-east-1:340173080692:adteco-magic-email-sns"
}

variable "email_bucket_name" {
  description = "S3 bucket name where SES stores emails"
  type        = string
  default     = "adteco-magic-inbox"
}

variable "email_bucket_prefix" {
  description = "S3 key prefix for stored emails"
  type        = string
  default     = "emails/"
}

variable "glapi_base_url" {
  description = "Base URL for GLAPI"
  type        = string
  default     = "https://api.adteco.ai"
}

variable "glapi_internal_token" {
  description = "Internal API token for GLAPI authentication"
  type        = string
  sensitive   = true
}

variable "enable_ai_extraction" {
  description = "Enable AI-powered document extraction"
  type        = bool
  default     = false
}

variable "anthropic_api_key" {
  description = "Anthropic API key for AI extraction (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 60
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}
