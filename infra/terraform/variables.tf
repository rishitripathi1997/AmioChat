variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile name (use personal account profile for AmioChat)"
  type        = string
  default     = null
}

variable "project_name" {
  description = "Project name used in resource naming"
  type        = string
  default     = "amiochat"
}

variable "web_app_origins" {
  description = "Allowed CORS origins for the HTTP API"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "log_retention_days" {
  description = "CloudWatch log retention for Lambda functions (OPS-01)"
  type        = number
  default     = 14
}

variable "alarm_emails" {
  description = "Email addresses for CloudWatch alarm SNS notifications (confirm via AWS email after apply)"
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for email in var.alarm_emails : can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", email))
    ])
    error_message = "Each alarm_emails entry must be a valid email address."
  }
}
