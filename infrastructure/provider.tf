terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-southeast-1"

  # This automatically applies these tags to all resources created by this provider!
  default_tags {
    tags = {
      ApplicationService = var.application_service
      CostCentre         = var.cost_centre
      Environment        = var.environment
      Project            = var.project_name
    }
  }
}
 