variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "rest_function_name" {
  type = string
}

variable "ws_function_name" {
  type = string
}

variable "http_api_id" {
  type = string
}

variable "websocket_api_id" {
  type = string
}

variable "dynamodb_table_name" {
  type = string
}

variable "alarm_error_threshold" {
  type        = number
  description = "Lambda Errors sum per 5 minutes before alarm"
  default     = 5
}

variable "alarm_http_5xx_threshold" {
  type        = number
  description = "HTTP API 5XX count per 5 minutes before alarm"
  default     = 10
}

variable "alarm_emails" {
  type        = list(string)
  description = "Email addresses for CloudWatch alarm SNS notifications (confirm subscription via email after apply)"
  default     = []
}

locals {
  alarm_prefix     = "${var.name_prefix}-ops"
  enable_alarm_sns = length(var.alarm_emails) > 0
}

resource "aws_sns_topic" "alarms" {
  count = local.enable_alarm_sns ? 1 : 0
  name  = "${local.alarm_prefix}-alarms"
}

resource "aws_sns_topic_policy" "alarms" {
  count = local.enable_alarm_sns ? 1 : 0
  arn   = aws_sns_topic.alarms[0].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudWatchPublish"
      Effect    = "Allow"
      Principal = { Service = "cloudwatch.amazonaws.com" }
      Action    = "SNS:Publish"
      Resource  = aws_sns_topic.alarms[0].arn
    }]
  })
}

resource "aws_sns_topic_subscription" "alarm_email" {
  for_each = local.enable_alarm_sns ? toset(var.alarm_emails) : toset([])

  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = each.value
}

locals {
  alarm_action_arns = local.enable_alarm_sns ? [aws_sns_topic.alarms[0].arn] : []
}

resource "aws_cloudwatch_metric_alarm" "rest_lambda_errors" {
  alarm_name          = "${local.alarm_prefix}-rest-errors"
  alarm_description   = "REST Lambda error count exceeded threshold"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_error_threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_action_arns
  ok_actions          = local.alarm_action_arns

  dimensions = {
    FunctionName = var.rest_function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "ws_lambda_errors" {
  alarm_name          = "${local.alarm_prefix}-ws-errors"
  alarm_description   = "WebSocket Lambda error count exceeded threshold"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_error_threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_action_arns
  ok_actions          = local.alarm_action_arns

  dimensions = {
    FunctionName = var.ws_function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "rest_lambda_throttles" {
  alarm_name          = "${local.alarm_prefix}-rest-throttles"
  alarm_description   = "REST Lambda throttled invocations"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_action_arns
  ok_actions          = local.alarm_action_arns

  dimensions = {
    FunctionName = var.rest_function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "http_api_5xx" {
  alarm_name          = "${local.alarm_prefix}-http-5xx"
  alarm_description   = "HTTP API 5XX responses exceeded threshold"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "5xx"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = var.alarm_http_5xx_threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_action_arns
  ok_actions          = local.alarm_action_arns

  dimensions = {
    ApiId = var.http_api_id
  }
}

resource "aws_cloudwatch_metric_alarm" "ws_integration_errors" {
  alarm_name          = "${local.alarm_prefix}-ws-integration-errors"
  alarm_description   = "WebSocket API integration errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "IntegrationError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_action_arns
  ok_actions          = local.alarm_action_arns

  dimensions = {
    ApiId = var.websocket_api_id
  }
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name_prefix}-ops"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# AmioChat ${var.environment} — operations dashboard"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 12
        height = 6
        properties = {
          title  = "Lambda invocations"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", var.rest_function_name, { stat = "Sum", label = "REST" }],
            ["...", var.ws_function_name, { stat = "Sum", label = "WebSocket" }],
          ]
          period = 300
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 1
        width  = 12
        height = 6
        properties = {
          title  = "Lambda errors"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", var.rest_function_name, { stat = "Sum", label = "REST" }],
            ["...", var.ws_function_name, { stat = "Sum", label = "WebSocket" }],
          ]
          period = 300
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 7
        width  = 12
        height = 6
        properties = {
          title  = "HTTP API"
          region = var.aws_region
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", var.http_api_id, { stat = "Sum", label = "Requests" }],
            [".", "4xx", ".", ".", { stat = "Sum", label = "4XX" }],
            [".", "5xx", ".", ".", { stat = "Sum", label = "5XX" }],
          ]
          period = 300
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 7
        width  = 12
        height = 6
        properties = {
          title  = "WebSocket API"
          region = var.aws_region
          metrics = [
            ["AWS/ApiGateway", "ConnectCount", "ApiId", var.websocket_api_id, { stat = "Sum", label = "Connects" }],
            [".", "MessageCount", ".", ".", { stat = "Sum", label = "Messages" }],
            [".", "IntegrationError", ".", ".", { stat = "Sum", label = "Integration errors" }],
          ]
          period = 300
          view   = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 13
        width  = 24
        height = 6
        properties = {
          title  = "DynamoDB consumed capacity"
          region = var.aws_region
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.dynamodb_table_name, { stat = "Sum" }],
            [".", "ConsumedWriteCapacityUnits", ".", ".", { stat = "Sum" }],
          ]
          period = 300
          view   = "timeSeries"
        }
      },
    ]
  })
}
