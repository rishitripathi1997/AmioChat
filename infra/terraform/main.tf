locals {
  name_prefix = "${var.project_name}-${var.environment}"
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

  name_prefix = local.name_prefix
  environment = var.environment
}

module "lambda" {
  source = "./modules/lambda"

  name_prefix        = local.name_prefix
  environment        = var.environment
  dynamodb_table_arn = module.dynamodb.table_arn
  media_bucket_arn   = module.s3.bucket_arn
}

module "http_api" {
  source = "./modules/http_api"

  name_prefix       = local.name_prefix
  environment       = var.environment
  lambda_invoke_arn = module.lambda.rest_invoke_arn
  lambda_function_name = module.lambda.rest_function_name
}

module "websocket_api" {
  source = "./modules/websocket_api"

  name_prefix          = local.name_prefix
  environment          = var.environment
  lambda_invoke_arn    = module.lambda.ws_invoke_arn
  lambda_function_name = module.lambda.ws_function_name
}
