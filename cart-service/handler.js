import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from './src/dynamodb.js';
import { logger } from './src/logger.js';

const TABLE_NAME = process.env.CARTS_TABLE || 'CartsTable';

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

const handleApiGatewayEvent = async (event) => {
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || event.rawPath || '';
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

  if (method === 'OPTIONS') return createResponse(200, { success: true });

  const userId = getUserId(event, path);
  if (!userId) return createResponse(400, { error: 'userId missing from path' });

  // GET /cart/:userId
  if (method === 'GET' && !path.includes('/items')) {
    const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
    return createResponse(200, { success: true, data: Item || { userId, items: [], total_price: 0 } });
  }

  // DELETE /cart/:userId
  if (method === 'DELETE' && !path.includes('/items')) {
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { userId } }));
    return createResponse(200, { success: true, message: 'Cart cleared' });
  }

  // POST /cart/:userId/items
  if (method === 'POST' && path.includes('/items')) {
    let body;
    try { body = parseBody(event); } catch (e) { return createResponse(400, { error: e.message }); }
    
    // Strict validation to prevent negative quantities/prices
    if (!body.productId || typeof body.quantity !== 'number' || typeof body.price !== 'number' || body.quantity <= 0 || body.price < 0) {
      return createResponse(400, { error: 'Missing or invalid fields: productId, quantity (must be >0), price (must be >=0)' });
    }

    // Synchronous Verification Logic
    const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL;
    const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL;
    
    if (PRODUCT_SERVICE_URL) {
      try {
        const prodRes = await fetch(`${PRODUCT_SERVICE_URL}/products/${body.productId}`);
        if (prodRes.status === 404) return createResponse(404, { error: 'Product not found' });
        if (!prodRes.ok) throw new Error(`Product service returned ${prodRes.status}`);
      } catch (err) {
        logger.error('Failed to contact Product Service', { error: err.message });
        return createResponse(502, { error: 'Product verification failed' });
      }
    }

    if (INVENTORY_SERVICE_URL) {
      try {
        const invRes = await fetch(`${INVENTORY_SERVICE_URL}/inventory/${body.productId}`);
        if (invRes.status === 404) return createResponse(404, { error: 'Inventory record not found' });
        if (!invRes.ok) throw new Error(`Inventory service returned ${invRes.status}`);
        
        const invData = await invRes.json();
        const available = invData.data ? invData.data.available_quantity : 0;
        
        // Ensure requested quantity doesn't exceed currently available stock
        if (available < body.quantity) {
          return createResponse(400, { error: `Insufficient stock. Only ${available} available.` });
        }
      } catch (err) {
        logger.error('Failed to contact Inventory Service', { error: err.message });
        return createResponse(502, { error: 'Inventory verification failed' });
      }
    }

    const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
    let cart = Item || { userId, items: [], total_price: 0 };
    cart.items = Array.isArray(cart.items) ? cart.items : [];
    
    const existingItemIndex = cart.items.findIndex(i => i.productId === body.productId);
    if (existingItemIndex > -1) {
      // If we are adding more quantity to an existing item, verify the NEW total doesn't exceed stock
      if (INVENTORY_SERVICE_URL) {
         try {
           const invRes = await fetch(`${INVENTORY_SERVICE_URL}/inventory/${body.productId}`);
           if (invRes.ok) {
             const invData = await invRes.json();
             const available = invData.data ? invData.data.available_quantity : 0;
             const proposedTotal = cart.items[existingItemIndex].quantity + body.quantity;
             if (available < proposedTotal) {
               return createResponse(400, { error: `Insufficient stock for accumulated cart total. Only ${available} available.` });
             }
           }
         } catch (err) {
           // Ignore silent failures on the second redundant check
         }
      }

      cart.items[existingItemIndex].quantity += body.quantity;
      cart.items[existingItemIndex].price_at_addition = body.price; 
    } else {
      cart.items.push({ productId: body.productId, quantity: body.quantity, price_at_addition: body.price });
    }

    cart.total_price = cart.items.reduce((total, item) => total + (item.quantity * item.price_at_addition), 0);
    cart.updated_at = new Date().toISOString();

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: cart }));
    return createResponse(200, { success: true, data: cart });
  }

  // DELETE /cart/:userId/items/:itemId
  if (method === 'DELETE' && path.includes('/items/')) {
    const itemId = getItemId(event, path);
    if (!itemId) return createResponse(400, { error: 'itemId missing from path' });

    const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
    if (!Item) return createResponse(404, { error: 'Cart not found' });

    Item.items = Array.isArray(Item.items) ? Item.items : [];
    Item.items = Item.items.filter(i => i.productId !== itemId);
    Item.total_price = Item.items.reduce((total, item) => total + (item.quantity * item.price_at_addition), 0);
    Item.updated_at = new Date().toISOString();

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: Item }));
    return createResponse(200, { success: true, data: Item });
  }

  return createResponse(404, { error: 'Not Found' });
};

const handleSqsEvent = async (event) => {
  for (const record of event.Records) {
    const sqsMessage = typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
    const payloadWrapper = (sqsMessage.Message && typeof sqsMessage.Message === 'string') 
      ? JSON.parse(sqsMessage.Message) : sqsMessage;
    
    const { eventType, payload } = payloadWrapper;
    
    if (eventType === 'ProductUpdated' || eventType === 'ProductDeleted') {
      const targetProductId = payload.productId;
      if (!targetProductId) continue;
      
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
          if (!cart.items || !Array.isArray(cart.items)) continue; 

          const itemIndex = cart.items.findIndex(i => i.productId === targetProductId);
          if (itemIndex > -1) {
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
          }
        }
      } while (lastEvaluatedKey);
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
