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

output "alarm_sns_topic_arn" {
  description = "SNS topic for alarm notifications (null when alarm_emails is empty)"
  value       = length(aws_sns_topic.alarms) > 0 ? aws_sns_topic.alarms[0].arn : null
}

output "alarm_email_subscriptions_pending" {
  description = "Emails that must confirm AWS SNS subscription before receiving alerts"
  value       = var.alarm_emails
}
