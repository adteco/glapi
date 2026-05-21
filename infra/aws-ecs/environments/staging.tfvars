environment       = "staging"
aws_region        = "us-east-1"
web_domain_name   = "glapi-staging.adteco.com"
api_domain_name   = "glapi-staging-api.adteco.com"
route53_zone_name = "adteco.com"

vpc_id   = "vpc-0c25cd9474ccb743d"
vpc_cidr = "10.0.0.0/16"
public_subnet_ids = [
  "subnet-0b0a658da165d3ac6",
  "subnet-0ea72d69e4380b89f",
]

certificate_arn = "arn:aws:acm:us-east-1:340173080692:certificate/f2473b55-5ec0-4579-a12f-422e164f8968"
web_secret_name = "glapi/staging/web"
api_secret_name = "glapi/staging/api"

web_desired_count = 1
api_desired_count = 1
