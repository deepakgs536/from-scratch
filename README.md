# Essential E-Commerce Platform

A fully serverless, microservices-based e-commerce platform featuring a modern React frontend and a highly scalable, event-driven AWS backend.

## 🏗 Architecture Overview

The platform uses a microservices architecture hosted entirely on AWS. It decouples core business domains into 10 independent services that communicate via synchronous REST APIs (via API Gateway) and asynchronous event streams (via SNS and SQS).

### Technology Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Compute**: AWS Lambda (Node.js 20.x, ES Modules)
- **API Routing**: Amazon API Gateway (Shared HTTP APIs)
- **Database**: Amazon DynamoDB (Single-table per service)
- **Event Bus / Async Messaging**: Amazon SNS (Topics) & Amazon SQS (Queues)
- **Identity & Auth**: Amazon Cognito (JWT validation)
- **Storage**: Amazon S3 (for product media and frontend hosting)
- **CDN**: Amazon CloudFront
- **Infrastructure as Code**: Terraform

---

## 🧩 Microservices Topology

1. **`auth-service`**: Handles user authentication via Amazon Cognito (Login, Signup, JWT issuance).
2. **`user-service`**: Manages user profiles. Listens to SNS events to automatically provision DynamoDB user records upon Cognito registration.
3. **`product-service`**: Product catalog management. Emits `ProductCreated`, `ProductUpdated` events.
4. **`inventory-service`**: Tracks stock levels and reserves stock during checkout. Listens to order/payment events to finalize deductions.
5. **`cart-service`**: Manages ephemeral shopping cart state and initiates the checkout process.
6. **`order-service`**: Manages the order lifecycle (Pending, Processing, Shipped, Delivered). Emits `OrderCreated` events.
7. **`payment-service`**: Processes payments (stubs) and logs transactions. Emits `PaymentCompleted` events.
8. **`media-service`**: Generates S3 pre-signed URLs for secure, direct-to-S3 frontend image uploads (e.g., product images).
9. **`analytics-service`**: Aggregates platform trends (revenue, product growth, user growth). Processes events from SNS/SQS in real-time.
10. **`notification-service`**: A headless worker (triggered solely via SQS) that dispatches SES emails (e.g., order confirmations).

---

## 🔌 API Endpoints

All services are routed behind a single AWS API Gateway instance.

### Product Service
- `GET    /products` - List all products
- `GET    /products/{id}` - Get a specific product
- `POST   /products` - Create a new product (Admin)
- `PUT    /products/{id}` - Update a product (Admin)
- `DELETE /products/{id}` - Delete a product (Admin)

### Inventory Service
- `GET    /inventory` - List inventory items
- `GET    /inventory/{productId}` - Get inventory for a product
- `PUT    /inventory/{productId}` - Update stock level manually
- `POST   /inventory/adjust` - Adjust stock (increment/decrement)

### Cart Service
- `GET    /cart/{userId}` - Get user's cart
- `POST   /cart/{userId}/items` - Add item to cart
- `PUT    /cart/{userId}/items/{itemId}` - Update item quantity
- `DELETE /cart/{userId}/items/{itemId}` - Remove item from cart
- `DELETE /cart/{userId}` - Clear cart
- `POST   /cart/{userId}/checkout` - Proceed to checkout

### Order Service
- `GET    /orders` - List all orders (Admin)
- `POST   /orders` - Create a new order
- `GET    /orders/{orderId}` - Get order details
- `PUT    /orders/{orderId}` - Update order details
- `DELETE /orders/{orderId}` - Delete/Cancel order
- `GET    /orders/user/{userId}` - List user's orders
- `PUT    /orders/{orderId}/status` - Update order status (Admin)

### Payment Service
- `GET    /payments` - List all payments (Admin)
- `POST   /payments/initiate` - Initiate a payment flow
- `POST   /payments/webhook` - Handle external payment gateway webhooks
- `GET    /payments/{paymentId}` - Get payment details
- `PUT    /payments/{paymentId}` - Update payment details
- `GET    /payments/order/{orderId}` - Get payment for a specific order

### User & Auth Services
- `GET    /users` - List all users (Admin)
- `GET    /users/{userId}` - Get user profile
- `PUT    /users/{userId}` - Update user profile
- Auth routes (Login/Signup) are handled directly via Cognito SDK on the frontend.

### Analytics Service
- `GET    /analytics/dashboard` - Get overall metrics overview
- `GET    /analytics/orders` - Get order trends
- `GET    /analytics/revenue` - Get revenue charts
- `GET    /analytics/customers` - Get user acquisition trends
- `GET    /analytics/products` - Get top products
- `GET    /analytics/inventory` - Get stock alerts
- `GET    /analytics/payments` - Get payment volume charts
- `GET    /generate/report` - Trigger report generation
- `GET    /analytics/health` - Analytics service health check

### Media Service
- `GET    /media/health` - Media service health check
- `POST   /media/upload-url` - Generate a pre-signed URL to upload an object to S3
- `GET    /media/download-url` - Generate a pre-signed URL to read an object from S3
- `DELETE /media` - Delete an object from S3

---

## 🚀 CI/CD Pipeline

The project uses **GitHub Actions** for continuous integration and deployment (`.github/workflows/ci.yml`).

- **Frontend Deployment**:
  Pushing changes to the `ecommerce-frontend/` directory triggers the `deploy-frontend` job. It builds the Vite app, syncs the `dist/` folder to the S3 bucket (`deepak-ecommerce-frontend`), and runs a CloudFront cache invalidation.
  
- **Backend Deployment**:
  The pipeline uses a **matrix strategy** utilizing `dorny/paths-filter`. It detects which specific microservice directories have changed and only deploys those modified services by bundling them and executing `aws lambda update-function-code`.

- **Infrastructure Validation**:
  Any changes inside the `infrastructure/` directory trigger a `terraform validate` step to catch syntax errors before they reach production.

---

## 🛠 Infrastructure Management

Infrastructure is managed using **Terraform** in the `/infrastructure` directory.

- `main.tf`: Core networking, Cognito User Pool, and API Gateway definitions.
- `databases.tf`: DynamoDB tables for all services.
- `services.tf`: Definitions for the 10 Lambda functions, IAM roles, and environment variable bindings.
- `messaging.tf`: SQS queues, SNS topics, and Event Source Mappings connecting them to Lambdas.
- `monitoring.tf`: CloudWatch dashboards mapping system health based on business importance.
- `frontend.tf`: S3 website bucket and CloudFront distribution configuration for the frontend.

### Manual Provisioning
Currently, new infrastructure (like a new DynamoDB table) must be provisioned manually before the CI/CD pipeline can deploy code to it:
```bash
cd infrastructure
terraform apply -auto-approve -var="lab_role_arn=arn:aws:iam::726101441380:role/aws_services_deepak"
```

*(Note: Automating `terraform apply` inside GitHub Actions is documented in `Future Plan.txt` and requires setting up an S3 Remote State Backend).*

---

## 💻 Local Development

### Running the Frontend
```bash
cd ecommerce-frontend
npm install
npm run dev
```
*Ensure you have a `.env` file configured with your backend API Gateway URL and Cognito Pool settings.*

### Running Backend Tests
```bash
cd <service-name>
npm install
npm test
```
All backend services use the native Node.js test runner (`node --test`) with mocked AWS SDK calls for lightning-fast testing.
