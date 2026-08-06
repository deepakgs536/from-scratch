import { v4 as uuidv4 } from 'uuid';
import { PutCommand, GetCommand, ScanCommand, DeleteCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  },
  body: JSON.stringify(body)
});

const parseBody = (event) => {
  if (!event.body) return {};
  if (typeof event.body === 'object') return event.body;
  try {
    return JSON.parse(event.body);
  } catch (err) {
    throw new Error('Invalid JSON body');
  }
};

const getProductId = (event, path) => {
  if (event.pathParameters && event.pathParameters.id) return event.pathParameters.id;
  if (event.pathParameters && event.pathParameters.productId) return event.pathParameters.productId;
  const match = path.match(/\/products\/([^\/]+)/);
  return match ? match[1] : null;
};

// NEW: Smarter Helper function to extract roles from API Gateway Authorizer or raw JWT

const isAdmin = (event) => {
  // Check HTTP API v2 first, then REST API v1
  let groupsData = 
    event.requestContext?.authorizer?.jwt?.claims?.['cognito:groups'] || 
    event.requestContext?.authorizer?.claims?.['cognito:groups'];
    
  // Fallback: If API Gateway authorizer is missing, parse the raw JWT from headers
  if (!groupsData) {
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = Buffer.from(token.split('.')[1], 'base64').toString();
        groupsData = JSON.parse(payload)['cognito:groups'];
      } catch (e) {
        logger.warn("Failed to parse raw JWT", { error: e.message });
      }
    }
  }

  if (!groupsData) return false;

  // If it comes through as a real array (HTTP APIs)
  if (Array.isArray(groupsData)) {
    return groupsData.includes('admin');
  }
    
  // If it comes through as a string (REST APIs convert it to "[admin]")
  if (typeof groupsData === 'string') {
    return groupsData.includes('admin');
  }

  return false;
};

const handleGetProducts = async (event) => {
  const category = event.queryStringParameters?.category;
  if (category) {
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "CategoryIndex",
      KeyConditionExpression: "#category = :category",
      ExpressionAttributeNames: { "#category": "category" },
      ExpressionAttributeValues: { ":category": decodeURIComponent(category) },
    }));
    return createResponse(200, { success: true, data: Items });
  }

  const { Items } = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
  return createResponse(200, { success: true, data: Items });
};

const handleGetProduct = async (event, path) => {
  const id = getProductId(event, path);
  if (!id) return createResponse(400, { error: 'Product ID missing from path' });

  const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { productId: id } }));
  if (!Item) return createResponse(404, { error: 'Product not found' });
  return createResponse(200, { success: true, data: Item });
};

const handleCreateProduct = async (event) => {
  if (!isAdmin(event)) return createResponse(403, { error: 'Forbidden: Admin access required' });

  let body;
  try { body = parseBody(event); } catch (e) { return createResponse(400, { error: e.message }); }
  if (!body.name || !body.price) return createResponse(400, { error: 'Missing required fields: name, price' });

  const product = {
    productId: uuidv4(),
    name: body.name,
    description: body.description || '',
    price: Number(body.price),
    sku: body.sku || '',
    category: body.category || '',
    image_url: body.image_url || '',
    stock_status: 'IN_STOCK',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: product }));
  await publishEvent(TOPIC_ARN, 'ProductCreated', product);
  
  return createResponse(201, { success: true, data: product });
};

const handleUpdateProduct = async (event, path) => {
  if (!isAdmin(event)) return createResponse(403, { error: 'Forbidden: Admin access required' });

  let body;
  try { body = parseBody(event); } catch (err) { return createResponse(400, { success: false, error: err.message }); }

  const productId = getProductId(event, path);
  if (!productId) return createResponse(400, { success: false, error: "Product ID missing from path" });

  const updatableFields = ["name", "description", "price", "sku", "category", "image_url", "stock_status"];
  const hasUpdates = updatableFields.some((field) => body[field] !== undefined);
  if (!hasUpdates) return createResponse(400, { success: false, error: "No fields provided to update" });

  const { Item: existingProduct } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { productId } }));
  if (!existingProduct) return createResponse(404, { success: false, error: "Product not found" });

  const updatedProduct = {
    ...existingProduct,
    name: body.name ?? existingProduct.name,
    description: body.description ?? existingProduct.description,
    price: body.price !== undefined ? Number(body.price) : existingProduct.price,
    sku: body.sku ?? existingProduct.sku,
    category: body.category ?? existingProduct.category,
    image_url: body.image_url ?? existingProduct.image_url,
    stock_status: body.stock_status ?? existingProduct.stock_status,
    updated_at: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: updatedProduct }));
  await publishEvent(TOPIC_ARN, "ProductUpdated", updatedProduct);

  return createResponse(200, { success: true, message: "Product updated successfully", data: updatedProduct });
};

const handleDeleteProduct = async (event, path) => {
  if (!isAdmin(event)) return createResponse(403, { error: 'Forbidden: Admin access required' });

  const id = getProductId(event, path);
  if (!id) return createResponse(400, { error: 'Product ID missing from path' });

  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { productId: id } }));
  await publishEvent(TOPIC_ARN, 'ProductDeleted', { productId: id });
  return createResponse(200, { success: true, message: 'Product deleted' });
};

const handleApiGatewayEvent = async (event) => {
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || event.rawPath || '';
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

  if (method === 'OPTIONS') return createResponse(200, { success: true });

  if (path.endsWith('/products') && method === 'GET') return await handleGetProducts(event);
  if (path.includes('/products/') && method === 'GET') return await handleGetProduct(event, path);
  if (path.endsWith('/products') && method === 'POST') return await handleCreateProduct(event);
  if (path.includes("/products/") && method === "PUT") return await handleUpdateProduct(event, path);
  if (path.includes('/products/') && method === 'DELETE') return await handleDeleteProduct(event, path);

  return createResponse(404, { error: 'Not Found' });
};

export const handler = async (event, context) => {
  logger.info("Received event", { event });

  try {
    if (!event) return createResponse(400, { error: 'Empty event' });
    return await handleApiGatewayEvent(event);
  } catch (error) {
    logger.error('Lambda Error', { error: error.message, stack: error.stack });
    return createResponse(500, { error: 'Internal Server Error' });
  }
};
 