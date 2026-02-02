output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.magic_inbox_processor.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.magic_inbox_processor.arn
}

output "lambda_role_arn" {
  description = "ARN of the Lambda IAM role"
  value       = aws_iam_role.lambda_role.arn
}

output "sns_subscription_arn" {
  description = "ARN of the SNS subscription"
  value       = aws_sns_topic_subscription.lambda_subscription.arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch Log Group name"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}
