output "rest_function_arn" {
  value = aws_lambda_function.rest.arn
}

output "rest_invoke_arn" {
  value = aws_lambda_function.rest.invoke_arn
}

output "rest_function_name" {
  value = aws_lambda_function.rest.function_name
}

output "ws_function_arn" {
  value = aws_lambda_function.ws.arn
}

output "ws_invoke_arn" {
  value = aws_lambda_function.ws.invoke_arn
}

output "ws_function_name" {
  value = aws_lambda_function.ws.function_name
}

output "lambda_role_arn" {
  value = aws_iam_role.lambda.arn
}

output "lambda_role_name" {
  value = aws_iam_role.lambda.name
}
