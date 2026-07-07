import { v4 as uuidv4 } from 'uuid';
import { PutCommand, GetCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from './src/dynamodb.js';
import { publishEvent } from './src/sns.js';
import { logger } from './src/logger.js';

const TABLE_NAME = process.env.PRODUCTS_TABLE || 'ProductsTable';
const TOPIC_ARN = process.env.PRODUCT_EVENTS_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:product-events';

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: { 
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
  },
  body: JSON.stringify(body)
});

export const handler = async (event, context) => {
  logger.info("Received event", { event });

  try {
    const path = event.path || event.rawPath || '';
    const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

    // Handle Preflight CORS
    if (method === 'OPTIONS') {
      return createResponse(200, { success: true });
    }

    // GET /products
    if (path.endsWith('/products') && method === 'GET') {
      const { Items } = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
      return createResponse(200, { success: true, data: Items });
    }

    // GET /products/:id
    if (path.includes('/products/') && method === 'GET') {
      const id = event.pathParameters ? event.pathParameters.id : path.split('/').pop();
      const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { productId: id } }));
      if (!Item) return createResponse(404, { error: 'Product not found' });
      return createResponse(200, { success: true, data: Item });
    }

    // POST /products
    if (path.endsWith('/products') && method === 'POST') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
      const product = {
        productId: uuidv4(),
        name: body.name,
        description: body.description,
        price: body.price,
        sku: body.sku,
        category: body.category,
        image_url: body.image_url,
        stock_status: 'IN_STOCK',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: product }));
      await publishEvent(TOPIC_ARN, 'ProductCreated', product);
      
      return createResponse(201, { success: true, data: product });
    }
    
    // DELETE /products/:id
    if (path.includes('/products/') && method === 'DELETE') {
      const id = event.pathParameters ? event.pathParameters.id : path.split('/').pop();
      await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { productId: id } }));
      await publishEvent(TOPIC_ARN, 'ProductDeleted', { productId: id });
      return createResponse(200, { success: true, message: 'Product deleted' });
    }

    return createResponse(404, { error: 'Not Found' });

  } catch (error) {
    logger.error('Lambda Error', { error: error.message });
    return createResponse(500, { error: 'Internal Server Error' });
  }
};
