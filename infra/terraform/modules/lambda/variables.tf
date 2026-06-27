variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "dynamodb_table_arn" {
  type = string
}

variable "dynamodb_table_name" {
  type = string
}

variable "media_bucket_arn" {
  type = string
}

variable "media_bucket_name" {
  type = string
}

variable "cognito_user_pool_id" {
  type = string
}

variable "backend_source_root" {
  type        = string
  description = "Path to monorepo root (for Lambda build)"
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention for Lambda log groups"
  default     = 14
}
