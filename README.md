# E-Commerce Platform

A fully serverless, microservices-based e-commerce platform with a React frontend and an event-driven AWS backend.

## 🏗 Architecture

The platform is designed around 10 distinct microservices using AWS Lambda and API Gateway, integrated with an event-driven architecture via SNS/SQS. Data is stored in DynamoDB.

### Frontend
- **Framework**: React, TypeScript, Vite
- **Location**: `/ecommerce-frontend`
- **Styling**: Tailwind CSS
- **Deployment**: AWS S3 (`deepak-ecommerce-frontend`) behind CloudFront (`d3nm7ykdets3rh.cloudfront.net`).
- **Running Locally**:
  ```bash
  cd ecommerce-frontend
  npm install
  npm run dev
  ```
  Ensure you have a `.env` file configured with your backend API Gateway URL and Cognito settings.

### Backend Microservices
All microservices are written in Node.js and located in their respective folders at the root.

1. **`auth-service`**: Handles user authentication via Amazon Cognito (Login, Signup, JWT issuance).
2. **`user-service`**: Manages user profiles. Also acts as an event subscriber to auto-create user records in DynamoDB upon Cognito registration.
3. **`product-service`**: Product catalog management.
4. **`inventory-service`**: Stock tracking and stock reservation logic.
5. **`cart-service`**: Shopping cart state management.
6. **`order-service`**: Order placement and lifecycle tracking.
7. **`payment-service`**: Payment processing stubs and transaction logging.
8. **`media-service`**: S3 pre-signed URL generator for secure frontend image uploads (e.g., product images).
9. **`analytics-service`**: Computes trends (revenue, product growth, user growth) via the `/generate/report` endpoint.
10. **`notification-service`**: Dispatches emails/SMS alerts (e.g., order confirmations) by listening to SQS.

## 🚀 CI/CD Pipeline

The project uses GitHub Actions for continuous integration and continuous deployment (`.github/workflows/ci.yml`).

- **Frontend Deployment**:
  Pushing changes inside `ecommerce-frontend/` triggers a build and syncs the `dist/` folder to the frontend S3 bucket, followed by a CloudFront invalidation for the distribution `E18RN7YW6NF1CA`.
- **Backend Deployment**:
  The pipeline uses a matrix strategy. It detects which service directories have changed (using `dorny/paths-filter`) and deploys only those modified services using Terraform and the AWS CLI.

## 🛠 Infrastructure Management

Infrastructure is managed using Terraform in the `/infrastructure` directory.
- `main.tf`: Core networking, Cognito, API Gateway definitions.
- `services.tf`: Definitions for the 10 Lambda functions, IAM roles, and environment variables.
- `messaging.tf`: SQS queues and SNS topics for async service-to-service communication.
- `monitoring.tf`: CloudWatch dashboards mapping system health based on business importance (API Performance, Messaging, Database, Logs).

To deploy infrastructure changes:
```bash
cd infrastructure
terraform plan -var="lab_role_arn=arn:aws:iam::726101441380:role/aws_services_deepak"
terraform apply -auto-approve -var="lab_role_arn=arn:aws:iam::726101441380:role/aws_services_deepak"
```
