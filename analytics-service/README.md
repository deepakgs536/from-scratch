# Analytics Service

Serverless analytics service that aggregates events from the e-commerce platform via SQS and provides a REST API for dashboards.

## Architecture

- **Language:** JavaScript (Node.js ES Modules)
- **Compute:** AWS Lambda
- **Database:** DynamoDB
- **Messaging:** SNS + SQS
- **API:** API Gateway (HTTP Proxy)

## Folder Structure

```
analytics-service/
├── src/
│   ├── config/          # AWS configuration
│   ├── controllers/     # Controller layer (routes & event routing)
│   ├── handlers/        # AWS Lambda handlers (API, SQS)
│   ├── models/          # Data structure models
│   ├── repositories/    # DynamoDB data access
│   ├── services/        # Core business logic
│   └── utils/           # Logger, constants, HTTP responses
├── app.js               # Lambda exports
├── package.json         # Node dependencies
└── README.md            # Documentation
```

## Deployment

1. Install dependencies:
   ```bash
   npm install
   ```
2. Zip the project:
   ```bash
   zip -r function.zip .
   ```
3. Deploy to AWS Lambda.

When configuring the AWS Lambda function in the console, use the following Handler name for both API and SQS triggers:
- `app.handler`

The `app.js` router will automatically detect the event payload and route it to either the API Controller or the SQS Worker.

## IAM Permissions Required

- `dynamodb:GetItem`
- `dynamodb:PutItem`
- `dynamodb:UpdateItem`
- `dynamodb:Query`
- `dynamodb:Scan`
- `sqs:ReceiveMessage`
- `sqs:DeleteMessage`
- `sqs:GetQueueAttributes`

## API Examples

### GET /dashboard
```bash
curl -X GET https://api-id.execute-api.us-east-1.amazonaws.com/dashboard
```

### GET /analytics/revenue
```bash
curl -X GET https://api-id.execute-api.us-east-1.amazonaws.com/analytics/revenue
```

## Environment Variables

- `AWS_REGION` - AWS region for services
- `ANALYTICS_TABLE` - DynamoDB table name (default: `AnalyticsTable`)
- `LOG_LEVEL` - Set to `DEBUG` for verbose logging

