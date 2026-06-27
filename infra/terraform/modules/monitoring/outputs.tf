output "dashboard_name" {
  value = aws_cloudwatch_dashboard.main.dashboard_name
}

output "alarm_names" {
  value = [
    aws_cloudwatch_metric_alarm.rest_lambda_errors.alarm_name,
    aws_cloudwatch_metric_alarm.ws_lambda_errors.alarm_name,
    aws_cloudwatch_metric_alarm.rest_lambda_throttles.alarm_name,
    aws_cloudwatch_metric_alarm.http_api_5xx.alarm_name,
    aws_cloudwatch_metric_alarm.ws_integration_errors.alarm_name,
  ]
}
