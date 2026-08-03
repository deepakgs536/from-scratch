variable "aws_region" {
  type        = string
  description = "AWS Region to deploy to"
  default     = "ap-southeast-1"
}

variable "project_name" {
  type        = string
  description = "Name of the project"
  default     = "ecommerce"
}

variable "environment" {
  type        = string
  description = "Environment (e.g., dev, staging, prod)"
  default     = "dev"
}

variable "application_service" {
  type        = string
  description = "Value for the ApplicationService tag"
  default     = "ecommerce-backend"
}

variable "cost_centre" {
  type        = string
  description = "Value for the CostCentre tag"
  default     = "CC-54321"
}

variable "lab_role_arn" {
  type        = string
  description = "The ARN of the AWS Academy LabRole. Must be provided to run Terraform."
}

variable "api_gateway_type" {
  type        = string
  description = "Type of API Gateway to create: 'httpv2' or 'rest'"
  default     = "httpv2"
  validation {
    condition     = contains(["httpv2", "rest"], var.api_gateway_type)
    error_message = "The api_gateway_type must be either 'httpv2' or 'rest'."
  }
}
