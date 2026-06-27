locals {
  name_prefix         = "${var.project_name}-${var.environment}"
  backend_source_root = abspath("${path.root}/../..")
  cors_allow_origins  = var.web_app_origins
}

module "cognito" {
  source = "./modules/cognito"

  name_prefix = local.name_prefix
  environment = var.environment
}

module "dynamodb" {
  source = "./modules/dynamodb"

  name_prefix = local.name_prefix
  environment = var.environment
}

module "s3" {
  source = "./modules/s3"

  name_prefix        = local.name_prefix
  environment        = var.environment
  cors_allow_origins = local.cors_allow_origins
}

module "lambda" {
  source = "./modules/lambda"

  name_prefix          = local.name_prefix
  environment          = var.environment
  aws_region           = var.aws_region
  dynamodb_table_arn   = module.dynamodb.table_arn
  dynamodb_table_name  = module.dynamodb.table_name
  media_bucket_arn     = module.s3.bucket_arn
  media_bucket_name    = module.s3.bucket_name
  cognito_user_pool_id = module.cognito.user_pool_id
  backend_source_root  = local.backend_source_root
}

module "http_api" {
  source = "./modules/http_api"

  name_prefix          = local.name_prefix
  environment          = var.environment
  aws_region           = var.aws_region
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id
  cors_allow_origins   = local.cors_allow_origins
  lambda_invoke_arn    = module.lambda.rest_invoke_arn
  lambda_function_name = module.lambda.rest_function_name
}

module "websocket_api" {
  source = "./modules/websocket_api"

  name_prefix          = local.name_prefix
  environment          = var.environment
  lambda_invoke_arn    = module.lambda.ws_invoke_arn
  lambda_function_name = module.lambda.ws_function_name
}

resource "aws_iam_role_policy" "lambda_ws_connections" {
  name = "${local.name_prefix}-lambda-ws-connections"
  role = module.lambda.lambda_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["execute-api:ManageConnections"]
      Resource = "${module.websocket_api.execution_arn}/*"
    }]
  })
}

module "ssm" {
  source = "./modules/ssm"

  environment          = var.environment
  aws_region           = var.aws_region
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id      = module.cognito.client_id
  dynamodb_table_name  = module.dynamodb.table_name
  media_bucket_name    = module.s3.bucket_name
  http_api_url         = module.http_api.api_url
  websocket_api_url    = module.websocket_api.api_url
}
