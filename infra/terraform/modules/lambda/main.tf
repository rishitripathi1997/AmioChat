resource "null_resource" "build_backend" {
  triggers = {
    rest_hash   = filemd5("${var.backend_source_root}/packages/backend/src/rest/handler.ts")
    router_hash = filemd5("${var.backend_source_root}/packages/backend/src/rest/router.ts")
    ws_hash     = filemd5("${var.backend_source_root}/packages/backend/src/ws/handler.ts")
    logger_hash = filemd5("${var.backend_source_root}/packages/backend/src/lib/logger.ts")
    shared_hash = filemd5("${var.backend_source_root}/packages/shared/src/ws.ts")
  }

  provisioner "local-exec" {
    command     = "npm run build:backend"
    working_dir = var.backend_source_root
  }
}

data "archive_file" "rest" {
  depends_on = [null_resource.build_backend]

  type        = "zip"
  source_file = "${var.backend_source_root}/packages/backend/dist/rest/index.js"
  output_path = "${path.module}/rest.zip"
}

data "archive_file" "ws" {
  depends_on = [null_resource.build_backend]

  type        = "zip"
  source_file = "${var.backend_source_root}/packages/backend/dist/ws/index.js"
  output_path = "${path.module}/ws.zip"
}

locals {
  lambda_env = {
    ENVIRONMENT                         = var.environment
    DYNAMODB_TABLE_NAME                 = var.dynamodb_table_name
    MEDIA_BUCKET_NAME                   = var.media_bucket_name
    COGNITO_USER_POOL_ID                = var.cognito_user_pool_id
    AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
  }
}

resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_data" {
  name = "${var.name_prefix}-lambda-data"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:TransactWriteItems",
          "dynamodb:DeleteItem"
        ]
        Resource = [var.dynamodb_table_arn, "${var.dynamodb_table_arn}/index/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = ["${var.media_bucket_arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParametersByPath"]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/amiochat/*"
      },
      {
        Effect = "Allow"
        Action = [
          "chime:CreateMeeting",
          "chime:DeleteMeeting",
          "chime:GetMeeting",
          "chime:CreateAttendee",
          "chime:DeleteAttendee",
          "chime:GetAttendee",
          "chime:ListAttendees"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "rest" {
  name              = "/aws/lambda/${var.name_prefix}-rest"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "ws" {
  name              = "/aws/lambda/${var.name_prefix}-ws"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "rest" {
  function_name = "${var.name_prefix}-rest"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.rest.output_path
  source_code_hash = data.archive_file.rest.output_base64sha256

  environment {
    variables = local.lambda_env
  }

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.rest.name
  }

  depends_on = [aws_cloudwatch_log_group.rest]
}

resource "aws_lambda_function" "ws" {
  function_name = "${var.name_prefix}-ws"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.ws.output_path
  source_code_hash = data.archive_file.ws.output_base64sha256

  environment {
    variables = local.lambda_env
  }

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.ws.name
  }

  depends_on = [aws_cloudwatch_log_group.ws]
}
