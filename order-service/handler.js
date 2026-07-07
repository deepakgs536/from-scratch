import { v4 as uuidv4 } from 'uuid';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from './src/dynamodb.js';
import { publishEvent } from './src/sns.js';
import { logger } from './src/logger.js';

const TABLE_NAME = process.env.ORDERS_TABLE || 'OrdersTable';
const TOPIC_ARN = process.env.ORDER_EVENTS_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:order-events';

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: { 
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
  },
  body: JSON.stringify(body)
});

const parseBody = (event) => {
  if (!event.body) return {};
  if (typeof event.body === 'object') return event.body;
  try { return JSON.parse(event.body); } 
  catch (err) { throw new Error('Invalid JSON body'); }
};

const getOrderId = (event, path) => {
  if (event.pathParameters && event.pathParameters.orderId) return event.pathParameters.orderId;
  const match = path.match(/\/orders\/([^\/]+)/);
  return match && match[1] !== 'user' && match[1] !== 'status' ? match[1] : null;
};

const getUserId = (event, path) => {
  if (event.pathParameters && event.pathParameters.userId) return event.pathParameters.userId;
  const match = path.match(/\/orders\/user\/([^\/]+)/);
  return match ? match[1] : null;
};

const handleApiGatewayEvent = async (event) => {
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || event.rawPath || '';
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

  if (method === 'OPTIONS') return createResponse(200, { success: true });

  // POST /orders
  if (path.endsWith('/orders') && method === 'POST') {
    let body;
    try { body = parseBody(event); } catch (e) { return createResponse(400, { error: e.message }); }
    
    if (!body.userId) {
      return createResponse(400, { error: 'Missing userId' });
    }

    const CART_SERVICE_URL = process.env.CART_SERVICE_URL;
    let items = body.items; // Fallback to provided array if cart service is bypassed
    let total_amount = 0;

    if (CART_SERVICE_URL) {
      try {
        const cartRes = await fetch(`${CART_SERVICE_URL}/cart/${body.userId}`);
        if (!cartRes.ok) throw new Error(`Cart service returned ${cartRes.status}`);
        const cartData = await cartRes.json();
        
        if (!cartData.data || !cartData.data.items || cartData.data.items.length === 0) {
           return createResponse(400, { error: 'Cannot create order: Cart is empty' });
        }
        
        items = cartData.data.items.map(i => ({
           productId: i.productId,
           quantity: i.quantity,
           unit_price: i.price_at_addition
        }));
        
        // Fire-and-forget: clear the cart after pulling items for checkout
        fetch(`${CART_SERVICE_URL}/cart/${body.userId}`, { method: 'DELETE' }).catch(() => logger.warn('Failed to clear cart after checkout'));
        
      } catch (err) {
        logger.error('Failed to contact Cart Service', { error: err.message });
        return createResponse(502, { error: 'Failed to retrieve cart for checkout' });
      }
    } else {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return createResponse(400, { error: 'Missing items array (Cart service URL not configured)' });
      }
      
      for (const item of items) {
        if (!item.productId || typeof item.quantity !== 'number' || item.quantity <= 0 || typeof item.unit_price !== 'number' || item.unit_price < 0) {
           return createResponse(400, { error: 'Invalid items array: items must have productId, quantity (>0), and unit_price (>=0)' });
        }
      }
    }

    total_amount = items.reduce((total, item) => total + ((item.unit_price || 0) * (item.quantity || 1)), 0);

    const order = {
      orderId: uuidv4(),
      userId: body.userId,
      total_amount,
      status: 'PENDING',
      shipping_address: body.shipping_address || {},
      items: items,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: order }));
    await publishEvent(TOPIC_ARN, 'OrderCreated', order);
    
    return createResponse(201, { success: true, data: order });
  }

  // GET /orders/user/:userId
  if (path.includes('/orders/user/') && method === 'GET') {
    const userId = getUserId(event, path);
    if (!userId) return createResponse(400, { error: 'userId missing from path' });

    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId }
    }));
    return createResponse(200, { success: true, data: Items || [] });
  }

  // GET /orders/:orderId
  if (path.includes('/orders/') && !path.includes('/user/') && method === 'GET') {
    const orderId = getOrderId(event, path);
    if (!orderId) return createResponse(400, { error: 'orderId missing from path' });

    const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { orderId } }));
    if (!Item) return createResponse(404, { error: 'Order not found' });
    return createResponse(200, { success: true, data: Item });
  }

  // PUT /orders/:orderId/status
  if (path.includes('/orders/') && path.endsWith('/status') && method === 'PUT') {
    const orderId = getOrderId(event, path);
    if (!orderId) return createResponse(400, { error: 'orderId missing from path' });
    
    let body;
    try { body = parseBody(event); } catch (e) { return createResponse(400, { error: e.message }); }
    
    if (!body.status) return createResponse(400, { error: 'status is required' });

    try {
      const response = await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { orderId },
        UpdateExpression: "SET #status = :status, updated_at = :updatedAt",
        ConditionExpression: "attribute_exists(orderId)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": body.status, ":updatedAt": new Date().toISOString() },
        ReturnValues: "ALL_NEW"
      }));
      return createResponse(200, { success: true, data: response.Attributes });
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        return createResponse(404, { error: 'Order not found' });
      }
      throw error;
    }
  }

  return createResponse(404, { error: 'Not Found' });
};

const handleSqsEvent = async (event) => {
  for (const record of event.Records) {
    const sqsMessage = typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
    const payloadWrapper = (sqsMessage.Message && typeof sqsMessage.Message === 'string') 
      ? JSON.parse(sqsMessage.Message) : sqsMessage;
    
    const { eventType, payload } = payloadWrapper;
    const { orderId } = payload || {};
    if (!orderId) continue;
    
    let newStatus = null;
    
    if (eventType === 'InventoryReserved') newStatus = 'RESERVED';
    else if (eventType === 'InventoryReservationFailed') newStatus = 'CANCELLED';
    else if (eventType === 'PaymentSucceeded') newStatus = 'PAID';
    else if (eventType === 'PaymentFailed') newStatus = 'FAILED';

    if (newStatus) {
      logger.info(`Saga update: Setting orderId ${orderId} to ${newStatus} due to ${eventType}`);
      try {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { orderId },
          UpdateExpression: "SET #status = :status, updated_at = :updatedAt",
          ConditionExpression: "attribute_exists(orderId)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": newStatus, ":updatedAt": new Date().toISOString() }
        }));
      } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
          logger.warn(`Saga update failed: Order ${orderId} does not exist (likely deleted)`);
        } else {
          throw error;
        }
      }
    }
  }
};

export const handler = async (event, context) => {
  logger.info("Received event", { event });
  try {
    if (!event) return createResponse(400, { error: 'Empty event' });
    if (event.Records && event.Records.length > 0 && event.Records[0].eventSource === 'aws:sqs') {
      await handleSqsEvent(event);
      return { success: true };
    } else {
      return await handleApiGatewayEvent(event);
    }
  } catch (error) {
    logger.error('Lambda Error', { error: error.message, stack: error.stack });
    if (event.Records) throw error; 
    return createResponse(500, { error: 'Internal Server Error' });
  }
};
