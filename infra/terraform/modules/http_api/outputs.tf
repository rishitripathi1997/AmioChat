output "api_id" {
  value = aws_apigatewayv2_api.http.id
}

output "api_url" {
  value = aws_apigatewayv2_stage.default.invoke_url
}
