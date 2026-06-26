variable "aws_region" {
  description = "AWS region for the state bucket and lock table"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile (personal account recommended)"
  type        = string
  default     = null
}

variable "project_name" {
  description = "Project name prefix for resources"
  type        = string
  default     = "amiochat"
}
