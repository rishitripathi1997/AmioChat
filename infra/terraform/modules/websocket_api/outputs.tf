output "api_id" {
  value = aws_apigatewayv2_api.websocket.id
}

output "api_url" {
  value = aws_apigatewayv2_stage.default.invoke_url
}

output "execution_arn" {
  value = aws_apigatewayv2_api.websocket.execution_arn
}
