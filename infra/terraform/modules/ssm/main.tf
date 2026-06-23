variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_client_id" {
  type = string
}

variable "dynamodb_table_name" {
  type = string
}

variable "media_bucket_name" {
  type = string
}

variable "http_api_url" {
  type = string
}

variable "websocket_api_url" {
  type = string
}

locals {
  prefix = "/amiochat/${var.environment}"
}

resource "aws_ssm_parameter" "aws_region" {
  name  = "${local.prefix}/aws-region"
  type  = "String"
  value = var.aws_region
}

resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name  = "${local.prefix}/cognito-user-pool-id"
  type  = "String"
  value = var.cognito_user_pool_id
}

resource "aws_ssm_parameter" "cognito_client_id" {
  name  = "${local.prefix}/cognito-client-id"
  type  = "String"
  value = var.cognito_client_id
}

resource "aws_ssm_parameter" "dynamodb_table_name" {
  name  = "${local.prefix}/dynamodb-table-name"
  type  = "String"
  value = var.dynamodb_table_name
}

resource "aws_ssm_parameter" "media_bucket_name" {
  name  = "${local.prefix}/media-bucket-name"
  type  = "String"
  value = var.media_bucket_name
}

resource "aws_ssm_parameter" "http_api_url" {
  name  = "${local.prefix}/http-api-url"
  type  = "String"
  value = var.http_api_url
}

resource "aws_ssm_parameter" "websocket_api_url" {
  name  = "${local.prefix}/websocket-api-url"
  type  = "String"
  value = var.websocket_api_url
}

resource "aws_ssm_parameter" "cognito_issuer" {
  name  = "${local.prefix}/cognito-issuer"
  type  = "String"
  value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${var.cognito_user_pool_id}"
}
