resource "aws_apigatewayv2_api" "shared_gateway" {
  count         = var.api_gateway_type == "httpv2" ? 1 : 0
  name          = "api-${var.environment}-${var.project_name}-gateway"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  count       = var.api_gateway_type == "httpv2" ? 1 : 0
  api_id      = aws_apigatewayv2_api.shared_gateway[0].id
  name        = "$default"
  auto_deploy = true
}

locals {
  api_endpoint = var.api_gateway_type == "httpv2" ? aws_apigatewayv2_api.shared_gateway[0].api_endpoint : aws_api_gateway_stage.rest_stage[0].invoke_url
  api_execution_arn = var.api_gateway_type == "httpv2" ? aws_apigatewayv2_api.shared_gateway[0].execution_arn : aws_api_gateway_rest_api.shared_rest_gateway[0].execution_arn
}

output "api_gateway_endpoint" {
  value       = local.api_endpoint
  description = "The base URL for the API Gateway"
}
