terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "adteco-terraform-state"
    key            = "glapi/aws-ecs/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "adteco-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
}
