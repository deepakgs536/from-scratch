resource "aws_apigatewayv2_api" "shared_gateway" {
  name          = "api-${var.environment}-${var.project_name}-gateway"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.shared_gateway.id
  name        = "$default"
  auto_deploy = true
}

output "api_gateway_endpoint" {
  value       = aws_apigatewayv2_api.shared_gateway.api_endpoint
  description = "The base URL for the HTTP API Gateway"
}
