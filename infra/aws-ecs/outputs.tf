output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "web_service_name" {
  value = aws_ecs_service.web.name
}

output "api_service_name" {
  value = aws_ecs_service.api.name
}

output "web_ecr_repository_url" {
  value = aws_ecr_repository.web.repository_url
}

output "api_ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "route53_web_record" {
  value = try(aws_route53_record.web[0].fqdn, null)
}

output "route53_api_record" {
  value = try(aws_route53_record.api[0].fqdn, null)
}

output "web_url" {
  value = "https://${var.web_domain_name}"
}

output "api_url" {
  value = "https://${var.api_domain_name}"
}
