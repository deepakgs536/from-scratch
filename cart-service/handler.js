import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from './src/dynamodb.js';
import { logger } from './src/logger.js';

const TABLE_NAME = process.env.CARTS_TABLE || 'CartsTable';

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
  try { return JSON.parse(event.body); } 
  catch (err) { throw new Error('Invalid JSON body'); }
};

const getUserId = (event, path) => {
  if (event.pathParameters && event.pathParameters.userId) return event.pathParameters.userId;
  const match = path.match(/\/cart\/([^\/]+)/);
  return match ? match[1] : null;
};

const getItemId = (event, path) => {
  if (event.pathParameters && event.pathParameters.itemId) return event.pathParameters.itemId;
  const match = path.match(/\/cart\/[^\/]+\/items\/([^\/]+)/);
  return match ? match[1] : null;
};

// Route Handlers
const handleGetCart = async (userId) => {
  const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
  return createResponse(200, { success: true, data: Item || { userId, items: [], total_price: 0 } });
};

const handleClearCart = async (userId) => {
  await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { userId } }));
  return createResponse(200, { success: true, message: 'Cart cleared' });
};

const verifyProductAndInventory = async (productId, quantity, existingQuantity = 0) => {
  const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL;
  const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL;

  if (PRODUCT_SERVICE_URL) {
    try {
      const prodRes = await fetch(`${PRODUCT_SERVICE_URL}/products/${productId}`);
      if (prodRes.status === 404) return createResponse(404, { error: 'Product not found' });
      if (!prodRes.ok) throw new Error(`Product service returned ${prodRes.status}`);
    } catch (err) {
      logger.error('Failed to contact Product Service', { error: err.message });
      return createResponse(502, { error: 'Product verification failed' });
    }
  }

  if (INVENTORY_SERVICE_URL) {
    try {
      const invRes = await fetch(`${INVENTORY_SERVICE_URL}/inventory/${productId}`);
      if (invRes.status === 404) return createResponse(404, { error: 'Inventory record not found' });
      if (!invRes.ok) throw new Error(`Inventory service returned ${invRes.status}`);
      
      const invData = await invRes.json();
      const available = invData.data ? invData.data.available_quantity : 0;
      
      if (available < (quantity + existingQuantity)) {
        return createResponse(400, { error: `Insufficient stock. Only ${available} available.` });
      }
    } catch (err) {
      logger.error('Failed to contact Inventory Service', { error: err.message });
      return createResponse(502, { error: 'Inventory verification failed' });
    }
  }
  return null; // Success
};

const handleAddItem = async (event, userId) => {
  let body;
  try { body = parseBody(event); } catch (e) { return createResponse(400, { error: e.message }); }
  
  if (!body.productId || typeof body.quantity !== 'number' || typeof body.price !== 'number' || body.quantity <= 0 || body.price < 0) {
    return createResponse(400, { error: 'Missing or invalid fields' });
  }

  const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
  let cart = Item || { userId, items: [], total_price: 0 };
  cart.items = Array.isArray(cart.items) ? cart.items : [];
  
  const existingItemIndex = cart.items.findIndex(i => i.productId === body.productId);
  const existingQuantity = existingItemIndex > -1 ? cart.items[existingItemIndex].quantity : 0;

  const verificationError = await verifyProductAndInventory(body.productId, body.quantity, existingQuantity);
  if (verificationError) return verificationError;

  if (existingItemIndex > -1) {
    cart.items[existingItemIndex].quantity += body.quantity;
    cart.items[existingItemIndex].price_at_addition = body.price; 
  } else {
    cart.items.push({ productId: body.productId, quantity: body.quantity, price_at_addition: body.price });
  }

  cart.total_price = cart.items.reduce((total, item) => total + (item.quantity * item.price_at_addition), 0);
  cart.updated_at = new Date().toISOString();

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: cart }));
  return createResponse(200, { success: true, data: cart });
};

const handleUpdateItem = async (event, userId, itemId) => {
  let body;
  try { body = parseBody(event); } catch (err) { return createResponse(400, { error: err.message }); }
  if (typeof body.quantity !== "number" || body.quantity <= 0) return createResponse(400, { error: "quantity must be > 0" });

  const { Item: cart } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
  if (!cart) return createResponse(404, { error: "Cart not found" });

  const itemIndex = cart.items.findIndex(i => i.productId === itemId);
  if (itemIndex === -1) return createResponse(404, { error: "Item not found in cart" });

  const verificationError = await verifyProductAndInventory(itemId, body.quantity, 0);
  if (verificationError) return verificationError;

  cart.items[itemIndex].quantity = body.quantity;
  cart.total_price = cart.items.reduce((sum, item) => sum + item.quantity * item.price_at_addition, 0);
  cart.updated_at = new Date().toISOString();

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: cart }));
  return createResponse(200, { success: true, data: cart });
};

const handleCheckout = async (userId) => {
  const { Item: cart } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
  if (!cart || !cart.items || cart.items.length === 0) return createResponse(400, { error: "Cart is empty" });

  for (const item of cart.items) {
    const errorRes = await verifyProductAndInventory(item.productId, item.quantity, 0);
    if (errorRes) return errorRes;
  }

  const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL;
  if (!ORDER_SERVICE_URL) return createResponse(500, { error: "ORDER_SERVICE_URL not configured" });

  try {
    const orderRes = await fetch(`${ORDER_SERVICE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, shipping_address: cart.shipping_address || {}, items: cart.items })
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) return createResponse(orderRes.status, orderData);
    return createResponse(201, { success: true, message: "Checkout completed", data: orderData.data });
  } catch (err) {
    logger.error("Failed to contact Order Service", { error: err.message });
    return createResponse(502, { error: "Unable to create order" });
  }
};

const handleRemoveItem = async (userId, itemId) => {
  const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
  if (!Item) return createResponse(404, { error: 'Cart not found' });

  Item.items = Array.isArray(Item.items) ? Item.items : [];
  Item.items = Item.items.filter(i => i.productId !== itemId);
  Item.total_price = Item.items.reduce((total, item) => total + (item.quantity * item.price_at_addition), 0);
  Item.updated_at = new Date().toISOString();

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: Item }));
  return createResponse(200, { success: true, data: Item });
};

const handleApiGatewayEvent = async (event) => {
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || event.rawPath || '';
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

  if (method === 'OPTIONS') return createResponse(200, { success: true });

  const userId = getUserId(event, path);
  if (!userId) return createResponse(400, { error: 'userId missing from path' });

  if (method === 'GET' && !path.includes('/items')) return await handleGetCart(userId);
  if (method === 'DELETE' && !path.includes('/items')) return await handleClearCart(userId);
  if (method === 'POST' && path.endsWith('/checkout')) return await handleCheckout(userId);
  if (method === 'POST' && path.includes('/items')) return await handleAddItem(event, userId);
  
  const itemId = getItemId(event, path);
  if (method === "PUT" && path.includes("/items/") && itemId) return await handleUpdateItem(event, userId, itemId);
  if (method === 'DELETE' && path.includes('/items/') && itemId) return await handleRemoveItem(userId, itemId);

  return createResponse(404, { error: 'Not Found' });
};

const processCartUpdate = async (cart, targetProductId, eventType, payload) => {
  if (!cart.items || !Array.isArray(cart.items)) return false; 
  const itemIndex = cart.items.findIndex(i => i.productId === targetProductId);
  if (itemIndex === -1) return false;
  
  let modified = false;
  if (eventType === 'ProductDeleted') {
    cart.items.splice(itemIndex, 1);
    modified = true;
  } else if (eventType === 'ProductUpdated' && payload.price !== undefined) {
    if (cart.items[itemIndex].price_at_addition !== payload.price) {
      cart.items[itemIndex].price_at_addition = payload.price;
      modified = true;
    }
  }
  
  if (modified) {
    cart.total_price = cart.items.reduce((total, item) => total + (item.quantity * item.price_at_addition), 0);
    cart.updated_at = new Date().toISOString();
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: cart }));
    logger.info(`Updated cart ${cart.userId} due to ${eventType}`);
  }
  return modified;
};

const handleProductEvent = async (eventType, payload) => {
  const targetProductId = payload.productId;
  if (!targetProductId) return;
  
  logger.info(`Processing ${eventType} for productId: ${targetProductId}`);
  
  let lastEvaluatedKey = undefined;
  do {
    const scanRes = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      ExclusiveStartKey: lastEvaluatedKey
    }));
    
    lastEvaluatedKey = scanRes.LastEvaluatedKey;
    const carts = scanRes.Items || [];
    
    for (const cart of carts) {
      await processCartUpdate(cart, targetProductId, eventType, payload);
    }
  } while (lastEvaluatedKey);
};

const handleSqsEvent = async (event) => {
  for (const record of event.Records) {
    const sqsMessage = typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
    const payloadWrapper = (sqsMessage.Message && typeof sqsMessage.Message === 'string') 
      ? JSON.parse(sqsMessage.Message) : sqsMessage;
    
    const { eventType, payload } = payloadWrapper;
    
    if (eventType === 'ProductUpdated' || eventType === 'ProductDeleted') {
      await handleProductEvent(eventType, payload);
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
    logger.error("Lambda Error", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  
    if (event.Records) throw error;
    return createResponse(500, {
      error: error.message
    });
  }
};
