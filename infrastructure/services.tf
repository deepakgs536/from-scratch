locals {
  services = {
    product      = { handler = "handler.handler", runtime = "nodejs20.x" }
    inventory    = { handler = "handler.handler", runtime = "nodejs20.x" }
    cart         = { handler = "handler.handler", runtime = "nodejs20.x" }
    order        = { handler = "handler.handler", runtime = "nodejs20.x" }
    payment      = { handler = "handler.handler", runtime = "nodejs20.x" }
    user         = { handler = "handler.handler", runtime = "nodejs20.x" }
    auth         = { handler = "handler.handler", runtime = "nodejs20.x" }
    media        = { handler = "handler.handler", runtime = "nodejs20.x" }
    analytics    = { handler = "app.handler",     runtime = "nodejs20.x" }
    notification = { handler = "handler.handler", runtime = "nodejs20.x" }
  }

  api_routes = [
    # Cart Service
    { route = "GET /cart/{userId}", service = "cart" },
    { route = "PUT /cart/{userId}/items/{itemId}", service = "cart" },
    { route = "POST /cart/{userId}/items", service = "cart" },
    { route = "DELETE /cart/{userId}", service = "cart" },
    { route = "OPTIONS /cart/{userId}/items/{itemId}", service = "cart" },
    { route = "OPTIONS /cart/{userId}/checkout", service = "cart" },
    { route = "POST /cart/{userId}/checkout", service = "cart" },
    { route = "OPTIONS /cart/{userId}", service = "cart" },
    { route = "OPTIONS /cart/{userId}/items", service = "cart" },
    { route = "DELETE /cart/{userId}/items/{itemId}", service = "cart" },

    # Payment Service
    { route = "OPTIONS /payments", service = "payment" },
    { route = "POST /payments/initiate", service = "payment" },
    { route = "POST /payments/webhook", service = "payment" },
    { route = "OPTIONS /payments/initiate", service = "payment" },
    { route = "OPTIONS /payments/webhook", service = "payment" },
    { route = "GET /payments", service = "payment" },
    { route = "GET /payments/{paymentId}", service = "payment" },
    { route = "PUT /payments/{paymentId}", service = "payment" },
    { route = "GET /payments/order/{orderId}", service = "payment" },

    # Order Service
    { route = "OPTIONS /orders", service = "order" },
    { route = "DELETE /orders/{orderId}", service = "order" },
    { route = "PUT /orders/{orderId}", service = "order" },
    { route = "OPTIONS /orders/{orderId}/status", service = "order" },
    { route = "OPTIONS /orders/{orderId}", service = "order" },
    { route = "GET /orders/{orderId}", service = "order" },
    { route = "GET /orders", service = "order" },
    { route = "PUT /orders/{orderId}/status", service = "order" },
    { route = "GET /orders/user/{userId}", service = "order" },
    { route = "OPTIONS /orders/user/{userId}", service = "order" },
    { route = "POST /orders", service = "order" },

    # Inventory Service
    { route = "POST /inventory/adjust", service = "inventory" },
    { route = "OPTIONS /inventory/{productId}", service = "inventory" },
    { route = "PUT /inventory/{productId}", service = "inventory" },
    { route = "OPTIONS /inventory/adjust", service = "inventory" },
    { route = "GET /inventory/{productId}", service = "inventory" },
    { route = "OPTIONS /inventory", service = "inventory" },
    { route = "GET /inventory", service = "inventory" },

    # Product Service
    { route = "POST /products", service = "product" },
    { route = "OPTIONS /products/{id}", service = "product" },
    { route = "GET /products/{id}", service = "product" },
    { route = "OPTIONS /products", service = "product" },
    { route = "GET /products", service = "product" },
    { route = "DELETE /products/{id}", service = "product" },
    { route = "PUT /products/{id}", service = "product" },

    # Analytics Service
    { route = "GET /analytics/orders", service = "analytics" },
    { route = "GET /analytics/health", service = "analytics" },
    { route = "GET /analytics/customers", service = "analytics" },
    { route = "GET /analytics/dashboard", service = "analytics" },
    { route = "GET /analytics/revenue", service = "analytics" },
    { route = "GET /analytics/products", service = "analytics" },
    { route = "GET /analytics/payments", service = "analytics" },
    { route = "GET /analytics/inventory", service = "analytics" },

    # Media Service
    { route = "OPTIONS /media/health", service = "media" },
    { route = "GET /media/download-url", service = "media" },
    { route = "DELETE /media", service = "media" },
    { route = "GET /media/health", service = "media" },
    { route = "OPTIONS /media/download-url", service = "media" },
    { route = "OPTIONS /media/upload-url", service = "media" },
    { route = "POST /media/upload-url", service = "media" },
    { route = "OPTIONS /media", service = "media" },

    # User Service
    { route = "GET /users/{userId}", service = "user" },
    { route = "GET /users", service = "user" },
    { route = "OPTIONS /users/{userId}", service = "user" },
    { route = "PUT /users/{userId}", service = "user" },
    { route = "OPTIONS /users", service = "user" },

    # Ranking Routes - Routing to a default or throwing error (Leaving this out as there is no ranking service in the 10 services. The user can add later)
  ]
}

resource "aws_lambda_function" "service_lambda" {
  for_each      = local.services
  function_name = "lambda-${var.environment}-${var.project_name}-${each.key}"
  role          = var.lab_role_arn
  handler       = each.value.handler
  runtime       = each.value.runtime
  filename      = "${path.module}/dist/${each.key}-service.zip"

  # Hash triggers redeploy when the zip changes
  source_code_hash = filebase64sha256("${path.module}/dist/${each.key}-service.zip")
  
  environment {
    variables = {
      SERVICE_NAME = each.key
      
      # Dynamically injected DynamoDB Tables
      PRODUCTS_TABLE  = aws_dynamodb_table.products.name
      INVENTORY_TABLE = aws_dynamodb_table.inventory.name
      CARTS_TABLE     = aws_dynamodb_table.carts.name
      ORDERS_TABLE    = aws_dynamodb_table.orders.name
      PAYMENTS_TABLE  = aws_dynamodb_table.payments.name
      ANALYTICS_TABLE = aws_dynamodb_table.analytics.name
      USERS_TABLE     = aws_dynamodb_table.users.name
      
      # S3 Buckets

      
      # Dynamically injected SNS Topics
      PRODUCT_EVENTS_TOPIC_ARN   = aws_sns_topic.product_events.arn
      INVENTORY_EVENTS_TOPIC_ARN = aws_sns_topic.inventory_events.arn
      ORDER_EVENTS_TOPIC_ARN     = aws_sns_topic.order_events.arn
      PAYMENT_EVENTS_TOPIC_ARN   = aws_sns_topic.payment_events.arn
      USER_EVENTS_TOPIC_ARN      = aws_sns_topic.user_events.arn
      
      # Dynamically injected SQS Queues
      ORDER_QUEUE_URL     = aws_sqs_queue.order_queue.id
      ANALYTICS_QUEUE_URL = aws_sqs_queue.analytics_queue.id
      INVENTORY_QUEUE_URL = aws_sqs_queue.inventory_queue.id
      PAYMENT_QUEUE_URL   = aws_sqs_queue.payment_queue.id
      USER_QUEUE_URL      = aws_sqs_queue.user_queue.id
      
      # Service URLs (all internally route back to the Shared API Gateway!)
      PRODUCT_SERVICE_URL   = aws_apigatewayv2_api.shared_gateway.api_endpoint
      INVENTORY_SERVICE_URL = aws_apigatewayv2_api.shared_gateway.api_endpoint
      ORDER_SERVICE_URL     = aws_apigatewayv2_api.shared_gateway.api_endpoint
      CART_SERVICE_URL      = aws_apigatewayv2_api.shared_gateway.api_endpoint
      PAYMENT_SERVICE_URL   = aws_apigatewayv2_api.shared_gateway.api_endpoint
    }
  }
}



# Lambda Permissions allowing API Gateway to invoke the function
resource "aws_lambda_permission" "api_gateway_invoke" {
  for_each = local.services

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.service_lambda[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.shared_gateway.execution_arn}/*/*"
}
