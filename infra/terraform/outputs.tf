output "environment" {
  description = "Deployed environment"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito app client ID"
  value       = module.cognito.client_id
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = module.dynamodb.table_name
}

output "media_bucket_name" {
  description = "S3 media bucket name"
  value       = module.s3.bucket_name
}

output "http_api_url" {
  description = "HTTP API base URL"
  value       = module.http_api.api_url
}

output "websocket_api_url" {
  description = "WebSocket API URL (wss://...)"
  value       = module.websocket_api.api_url
}

output "ssm_parameter_prefix" {
  description = "SSM path prefix for app configuration"
  value       = module.ssm.parameter_prefix
}

output "amplify_environment_variables" {
  description = "Copy into Amplify Console → Environment variables (add AUTH_SESSION_SECRET manually)"
  value = {
    NEXT_PUBLIC_AUTH_MODE            = "cognito"
    NEXT_PUBLIC_AWS_REGION           = var.aws_region
    NEXT_PUBLIC_COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    NEXT_PUBLIC_COGNITO_CLIENT_ID    = module.cognito.client_id
    NEXT_PUBLIC_API_URL              = module.http_api.api_url
    NEXT_PUBLIC_WS_URL               = module.websocket_api.api_url
  }
}

output "cloudwatch_dashboard_name" {
  description = "CloudWatch operations dashboard name"
  value       = module.monitoring.dashboard_name
}

output "lambda_log_groups" {
  description = "Lambda CloudWatch log group names"
  value = {
    rest = module.lambda.rest_log_group_name
    ws   = module.lambda.ws_log_group_name
  }
}
