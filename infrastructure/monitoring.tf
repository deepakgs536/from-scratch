locals {
  fn = {
    product      = aws_lambda_function.service_lambda["product"].function_name
    inventory    = aws_lambda_function.service_lambda["inventory"].function_name
    cart         = aws_lambda_function.service_lambda["cart"].function_name
    order        = aws_lambda_function.service_lambda["order"].function_name
    payment      = aws_lambda_function.service_lambda["payment"].function_name
    user         = aws_lambda_function.service_lambda["user"].function_name
    auth         = aws_lambda_function.service_lambda["auth"].function_name
    analytics    = aws_lambda_function.service_lambda["analytics"].function_name
    notification = aws_lambda_function.service_lambda["notification"].function_name
  }
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "Ecommerce-System-Health-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [

      # ── SYSTEM HEALTH header ──────────────────────────────────
      {
        type = "text", x = 0, y = 0, width = 24, height = 1
        properties = { markdown = "## 🏥 System Health" }
      },

      # Total Requests
      {
        type = "metric", x = 0, y = 1, width = 8, height = 3
        properties = {
          view   = "singleValue"
          region = var.aws_region
          title  = "Total Requests"
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.product,      { id = "i1", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.inventory,    { id = "i2", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.cart,         { id = "i3", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.order,        { id = "i4", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.payment,      { id = "i5", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.user,         { id = "i6", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.auth,         { id = "i7", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.analytics,    { id = "i8", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.notification, { id = "i9", visible = false }],
            [{ expression = "SUM([i1,i2,i3,i4,i5,i6,i7,i8,i9])", label = "Requests", id = "total", color = "#1f77b4" }]
          ]
        }
      },

      # Total Errors — temporarily hidden (uncomment to re-enable)
      # {
      #   type = "metric", x = 8, y = 1, width = 8, height = 3
      #   properties = {
      #     view   = "singleValue"
      #     region = var.aws_region
      #     title  = "Total Errors"
      #     stat   = "Sum"
      #     period = 300
      #     metrics = [
      #       ["AWS/Lambda", "Errors", "FunctionName", local.fn.product,      { id = "e1", visible = false }],
      #       ["AWS/Lambda", "Errors", "FunctionName", local.fn.inventory,    { id = "e2", visible = false }],
      #       ["AWS/Lambda", "Errors", "FunctionName", local.fn.cart,         { id = "e3", visible = false }],
      #       ["AWS/Lambda", "Errors", "FunctionName", local.fn.order,        { id = "e4", visible = false }],
      #       ["AWS/Lambda", "Errors", "FunctionName", local.fn.payment,      { id = "e5", visible = false }],
      #       ["AWS/Lambda", "Errors", "FunctionName", local.fn.user,         { id = "e6", visible = false }],
      #       ["AWS/Lambda", "Errors", "FunctionName", local.fn.auth,         { id = "e7", visible = false }],
      #       ["AWS/Lambda", "Errors", "FunctionName", local.fn.analytics,    { id = "e8", visible = false }],
      #       ["AWS/Lambda", "Errors", "FunctionName", local.fn.notification, { id = "e9", visible = false }],
      #       [{ expression = "SUM([e1,e2,e3,e4,e5,e6,e7,e8,e9])", label = "Errors", id = "errtotal", color = "#d62728" }]
      #     ]
      #   }
      # },

      # Avg Latency
      {
        type = "metric", x = 8, y = 1, width = 8, height = 3
        properties = {
          view   = "singleValue"
          region = var.aws_region
          title  = "Avg Latency (ms)"
          stat   = "Average"
          period = 300
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", local.fn.product,      { id = "d1", visible = false }],
            ["AWS/Lambda", "Duration", "FunctionName", local.fn.inventory,    { id = "d2", visible = false }],
            ["AWS/Lambda", "Duration", "FunctionName", local.fn.cart,         { id = "d3", visible = false }],
            ["AWS/Lambda", "Duration", "FunctionName", local.fn.order,        { id = "d4", visible = false }],
            ["AWS/Lambda", "Duration", "FunctionName", local.fn.payment,      { id = "d5", visible = false }],
            ["AWS/Lambda", "Duration", "FunctionName", local.fn.user,         { id = "d6", visible = false }],
            ["AWS/Lambda", "Duration", "FunctionName", local.fn.auth,         { id = "d7", visible = false }],
            ["AWS/Lambda", "Duration", "FunctionName", local.fn.analytics,    { id = "d8", visible = false }],
            ["AWS/Lambda", "Duration", "FunctionName", local.fn.notification, { id = "d9", visible = false }],
            [{ expression = "AVG([d1,d2,d3,d4,d5,d6,d7,d8,d9])", label = "Avg Duration", id = "avgdur", color = "#ff7f0e" }]
          ]
        }
      },

      # Success Rate — fixed expression (no MAX on mixed types)
      {
        type = "metric", x = 16, y = 1, width = 8, height = 3
        properties = {
          view   = "singleValue"
          region = var.aws_region
          title  = "Success Rate %"
          stat   = "Sum"
          period = 300
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.product,   { id = "ri1", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.inventory, { id = "ri2", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.cart,      { id = "ri3", visible = false }],
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.order,     { id = "ri4", visible = false }],
            ["AWS/Lambda", "Errors",      "FunctionName", local.fn.product,   { id = "re1", visible = false }],
            ["AWS/Lambda", "Errors",      "FunctionName", local.fn.inventory, { id = "re2", visible = false }],
            ["AWS/Lambda", "Errors",      "FunctionName", local.fn.cart,      { id = "re3", visible = false }],
            ["AWS/Lambda", "Errors",      "FunctionName", local.fn.order,     { id = "re4", visible = false }],
            [{ expression = "IF(SUM([ri1,ri2,ri3,ri4]) > 0, 100*(SUM([ri1,ri2,ri3,ri4])-SUM([re1,re2,re3,re4]))/SUM([ri1,ri2,ri3,ri4]), 100)", label = "Success %", id = "rate", color = "#2ca02c" }]
          ]
        }
      },

      # ── API PERFORMANCE header ────────────────────────────────
      {
        type = "text", x = 0, y = 4, width = 24, height = 1
        properties = { markdown = "## ⚡ API Performance  *(blue = requests · red = errors)*" }
      },

      # Products API — Invocations + Errors only (cleaner)
      {
        type = "metric", x = 0, y = 5, width = 6, height = 5
        properties = {
          view = "timeSeries", stacked = false, region = var.aws_region
          title  = "Products API"
          period = 60
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.product, { label = "Requests", color = "#1f77b4", stat = "Sum" }],
            ["AWS/Lambda", "Errors",      "FunctionName", local.fn.product, { label = "Errors",   color = "#d62728", stat = "Sum" }]
          ]
        }
      },

      # Inventory API
      {
        type = "metric", x = 6, y = 5, width = 6, height = 5
        properties = {
          view = "timeSeries", stacked = false, region = var.aws_region
          title  = "Inventory API"
          period = 60
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.inventory, { label = "Requests", color = "#1f77b4", stat = "Sum" }],
            ["AWS/Lambda", "Errors",      "FunctionName", local.fn.inventory, { label = "Errors",   color = "#d62728", stat = "Sum" }]
          ]
        }
      },

      # Cart API
      {
        type = "metric", x = 12, y = 5, width = 6, height = 5
        properties = {
          view = "timeSeries", stacked = false, region = var.aws_region
          title  = "Cart API"
          period = 60
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.cart, { label = "Requests", color = "#1f77b4", stat = "Sum" }],
            ["AWS/Lambda", "Errors",      "FunctionName", local.fn.cart, { label = "Errors",   color = "#d62728", stat = "Sum" }]
          ]
        }
      },

      # Order API
      {
        type = "metric", x = 18, y = 5, width = 6, height = 5
        properties = {
          view = "timeSeries", stacked = false, region = var.aws_region
          title  = "Order API"
          period = 60
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", local.fn.order, { label = "Requests", color = "#1f77b4", stat = "Sum" }],
            ["AWS/Lambda", "Errors",      "FunctionName", local.fn.order, { label = "Errors",   color = "#d62728", stat = "Sum" }]
          ]
        }
      },

      # ── MESSAGING header ──────────────────────────────────────
      {
        type = "text", x = 0, y = 10, width = 24, height = 1
        properties = { markdown = "## 📨 Messaging" }
      },

      # Queue Depth — single summed line per queue
      {
        type = "metric", x = 0, y = 11, width = 12, height = 5
        properties = {
          view = "timeSeries", stacked = false, region = var.aws_region
          title  = "Queue Depth (visible messages)"
          period = 60
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.order_queue.name,     { label = "Order",     color = "#9467bd", stat = "Sum" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.inventory_queue.name, { label = "Inventory", color = "#2ca02c", stat = "Sum" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.payment_queue.name,   { label = "Payment",   color = "#ff7f0e", stat = "Sum" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.analytics_queue.name, { label = "Analytics", color = "#17becf", stat = "Sum" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.user_queue.name,      { label = "User",      color = "#bcbd22", stat = "Sum" }]
          ]
        }
      },

      # Oldest Message Age — single most important queue (order)
      {
        type = "metric", x = 12, y = 11, width = 12, height = 5
        properties = {
          view = "timeSeries", stacked = false, region = var.aws_region
          title  = "Oldest Message Age (seconds) — workers stuck if rising"
          period = 60
          metrics = [
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", aws_sqs_queue.order_queue.name,     { label = "Order",     color = "#9467bd", stat = "Maximum" }],
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", aws_sqs_queue.inventory_queue.name, { label = "Inventory", color = "#2ca02c", stat = "Maximum" }],
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", aws_sqs_queue.payment_queue.name,   { label = "Payment",   color = "#ff7f0e", stat = "Maximum" }]
          ]
        }
      },

      # ── DATABASE header ───────────────────────────────────────
      {
        type = "text", x = 0, y = 16, width = 24, height = 1
        properties = { markdown = "## 🗄️ Database" }
      },

      # Read Capacity (stacked)
      {
        type = "metric", x = 0, y = 17, width = 8, height = 5
        properties = {
          view = "timeSeries", stacked = true, region = var.aws_region
          title  = "Read Capacity (all tables)"
          period = 60
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.products.name,  { label = "Products",  stat = "Sum" }],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.orders.name,    { label = "Orders",    stat = "Sum" }],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.inventory.name, { label = "Inventory", stat = "Sum" }],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.users.name,     { label = "Users",     stat = "Sum" }],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.payments.name,  { label = "Payments",  stat = "Sum" }],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.carts.name,     { label = "Carts",     stat = "Sum" }]
          ]
        }
      },

      # Write Capacity (stacked)
      {
        type = "metric", x = 8, y = 17, width = 8, height = 5
        properties = {
          view = "timeSeries", stacked = true, region = var.aws_region
          title  = "Write Capacity (all tables)"
          period = 60
          metrics = [
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.products.name,  { label = "Products",  stat = "Sum" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.orders.name,    { label = "Orders",    stat = "Sum" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.inventory.name, { label = "Inventory", stat = "Sum" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.users.name,     { label = "Users",     stat = "Sum" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.payments.name,  { label = "Payments",  stat = "Sum" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.carts.name,     { label = "Carts",     stat = "Sum" }]
          ]
        }
      },

      # Throttles — just orders + products (most critical)
      {
        type = "metric", x = 16, y = 17, width = 8, height = 5
        properties = {
          view = "timeSeries", stacked = false, region = var.aws_region
          title  = "DynamoDB Throttles ⚠️  (should be 0)"
          period = 60
          metrics = [
            ["AWS/DynamoDB", "ReadThrottleEvents",  "TableName", aws_dynamodb_table.orders.name,   { label = "Orders Read",    color = "#d62728", stat = "Maximum" }],
            ["AWS/DynamoDB", "WriteThrottleEvents", "TableName", aws_dynamodb_table.orders.name,   { label = "Orders Write",   color = "#ff7f0e", stat = "Maximum" }],
            ["AWS/DynamoDB", "ReadThrottleEvents",  "TableName", aws_dynamodb_table.products.name, { label = "Products Read",  color = "#9467bd", stat = "Maximum" }],
            ["AWS/DynamoDB", "WriteThrottleEvents", "TableName", aws_dynamodb_table.products.name, { label = "Products Write", color = "#2ca02c", stat = "Maximum" }]
          ]
        }
      },

      # ── LOGS & ALERTS header ──────────────────────────────────
      {
        type = "text", x = 0, y = 22, width = 24, height = 1
        properties = { markdown = "## 🚨 Logs & Alerts" }
      },

      # Top Erroring Lambdas — 5 key services only
      {
        type = "metric", x = 0, y = 23, width = 12, height = 6
        properties = {
          view = "timeSeries", stacked = false, region = var.aws_region
          title  = "Errors by Service (top 5)"
          period = 60
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", local.fn.order,     { label = "order",     color = "#d62728", stat = "Sum" }],
            ["AWS/Lambda", "Errors", "FunctionName", local.fn.payment,   { label = "payment",   color = "#ff7f0e", stat = "Sum" }],
            ["AWS/Lambda", "Errors", "FunctionName", local.fn.product,   { label = "product",   color = "#9467bd", stat = "Sum" }],
            ["AWS/Lambda", "Errors", "FunctionName", local.fn.inventory, { label = "inventory", color = "#2ca02c", stat = "Sum" }],
            ["AWS/Lambda", "Errors", "FunctionName", local.fn.auth,      { label = "auth",      color = "#17becf", stat = "Sum" }]
          ]
        }
      },

      # Lambda Error Logs
      {
        type = "log", x = 12, y = 23, width = 12, height = 6
        properties = {
          region = var.aws_region
          title  = "Latest ERROR Logs (all services)"
          view   = "table"
          query  = "SOURCE '/aws/lambda/lambda-${var.environment}-${var.project_name}-product' | SOURCE '/aws/lambda/lambda-${var.environment}-${var.project_name}-inventory' | SOURCE '/aws/lambda/lambda-${var.environment}-${var.project_name}-cart' | SOURCE '/aws/lambda/lambda-${var.environment}-${var.project_name}-order' | SOURCE '/aws/lambda/lambda-${var.environment}-${var.project_name}-payment' | SOURCE '/aws/lambda/lambda-${var.environment}-${var.project_name}-user' | SOURCE '/aws/lambda/lambda-${var.environment}-${var.project_name}-auth' | SOURCE '/aws/lambda/lambda-${var.environment}-${var.project_name}-analytics' | SOURCE '/aws/lambda/lambda-${var.environment}-${var.project_name}-notification' | fields @timestamp, @logStream, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20"
        }
      }

    ]
  })
}

# ── CloudWatch Alarms ─────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_errors_high" {
  alarm_name          = "${var.project_name}-${var.environment}-lambda-errors-high"
  alarm_description   = "Lambda errors > 5 in 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 5
  treat_missing_data  = "notBreaching"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  dimensions          = { FunctionName = aws_lambda_function.service_lambda["order"].function_name }
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration_high" {
  alarm_name          = "${var.project_name}-${var.environment}-lambda-duration-high"
  alarm_description   = "Lambda avg duration > 3 seconds"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 3000
  treat_missing_data  = "notBreaching"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  dimensions          = { FunctionName = aws_lambda_function.service_lambda["order"].function_name }
}

resource "aws_cloudwatch_metric_alarm" "sqs_backlog_high" {
  alarm_name          = "${var.project_name}-${var.environment}-sqs-backlog-high"
  alarm_description   = "Order queue backlog > 100 messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 100
  treat_missing_data  = "notBreaching"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  dimensions          = { QueueName = aws_sqs_queue.order_queue.name }
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  alarm_name          = "${var.project_name}-${var.environment}-dynamodb-throttles"
  alarm_description   = "DynamoDB throttle events detected"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  treat_missing_data  = "notBreaching"
  metric_name         = "WriteThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Maximum"
  dimensions          = { TableName = aws_dynamodb_table.orders.name }
}
