environment       = "prod"
aws_region        = "us-east-1"
web_domain_name   = "glapi.adteco.com"
api_domain_name   = "glapi-api.adteco.com"
route53_zone_name = "adteco.com"

vpc_id   = "vpc-067638efaa57ff6dc"
vpc_cidr = "10.1.0.0/16"
public_subnet_ids = [
  "subnet-0a1461a7cc3f062e9",
  "subnet-09c0ade06377f6203",
  "subnet-051e3657abe4bb6cc",
]

certificate_arn = "arn:aws:acm:us-east-1:340173080692:certificate/f2473b55-5ec0-4579-a12f-422e164f8968"
web_secret_name = "glapi/prod/web"
api_secret_name = "glapi/prod/api"

web_desired_count = 2
api_desired_count = 2
