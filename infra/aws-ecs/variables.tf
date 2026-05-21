variable "aws_region" {
  description = "AWS region for ECS resources."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "Environment must be staging or prod."
  }
}

variable "vpc_id" {
  description = "VPC where ALB and ECS tasks run."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR allowed to reach ECS tasks from the ALB."
  type        = string
  default     = "172.31.0.0/16"
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for ALB and Fargate tasks."
  type        = list(string)
}

variable "certificate_arn" {
  description = "ACM certificate ARN covering web_domain_name and api_domain_name."
  type        = string
}

variable "web_domain_name" {
  description = "Public web hostname."
  type        = string
}

variable "api_domain_name" {
  description = "Public API hostname."
  type        = string
}

variable "web_secret_arn" {
  description = "Secrets Manager secret ARN containing web runtime env vars."
  type        = string
}

variable "api_secret_arn" {
  description = "Secrets Manager secret ARN containing API runtime env vars."
  type        = string
}

variable "web_desired_count" {
  description = "Desired ECS task count for web."
  type        = number
  default     = 1
}

variable "api_desired_count" {
  description = "Desired ECS task count for API."
  type        = number
  default     = 1
}

variable "web_cpu" {
  description = "Web task CPU units."
  type        = number
  default     = 512
}

variable "web_memory" {
  description = "Web task memory in MiB."
  type        = number
  default     = 1024
}

variable "api_cpu" {
  description = "API task CPU units."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "API task memory in MiB."
  type        = number
  default     = 1024
}
