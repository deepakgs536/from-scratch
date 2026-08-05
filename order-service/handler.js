import { v4 as uuidv4 } from 'uuid';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
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
  if (path.endsWith("/orders") && method === "POST") {

    let body;

    try {
      body = parseBody(event);
    } catch (e) {
      return createResponse(400, { error: e.message });
    }

    if (!body.userId) {
      return createResponse(400, {
        error: "Missing userId"
      });
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return createResponse(400, {
        error: "Items are required"
      });
    }

    // Validate items
    for (const item of body.items) {

      if (
        !item.productId ||
        typeof item.quantity !== "number" ||
        item.quantity <= 0 ||
        typeof item.price_at_addition !== "number"
      ) {
        return createResponse(400, {
          error:
            "Each item must contain productId, quantity and price_at_addition"
        });
      }
    }

    const total_amount = body.items.reduce(
      (sum, item) =>
        sum + item.price_at_addition * item.quantity,
      0
    );

    const order = {
      orderId: uuidv4(),
      userId: body.userId,
      items: body.items,
      total_amount: total_amount * 1.08 + 15, // Adding 8% tax and $15 shipping,
      status: "PENDING",
      shipping_address: body.shipping_address || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: order
      })
    );

    // Clear cart synchronously
    const CART_SERVICE_URL = process.env.CART_SERVICE_URL;

    if (CART_SERVICE_URL) {

      const clearCartRes = await fetch(
        `${CART_SERVICE_URL}/cart/${body.userId}`,
        {
          method: "DELETE"
        }
      );

      if (!clearCartRes.ok) {

        logger.error("Failed to clear cart", {
          status: clearCartRes.status
        });

        return createResponse(502, {
          error: "Order created but failed to clear cart"
        });
      }
    }

    // Publish event for downstream services
    if (TOPIC_ARN) {
      await publishEvent(
        TOPIC_ARN,
        "OrderCreated",
        order
      );
    }

    return createResponse(201, {
      success: true,
      data: order
    });
  }

  // GET /orders
  if (path === '/orders' && method === 'GET') {
    const { Items } = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME
      })
    );

    return createResponse(200, {
      success: true,
      count: Items?.length || 0,
      data: Items || []
    });
  }

  // GET /orders/user/:userId
  if (path.includes('/orders/user/') && method === 'GET') {
    const userId = getUserId(event, path);
    if (!userId) return createResponse(400, { error: 'userId missing from path' });

    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'UserOrdersIndex',
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

  // PUT /orders/:orderId
  if (path.includes("/orders/") &&
      !path.endsWith("/status") &&
      method === "PUT") {

    const orderId = getOrderId(event, path);

    if (!orderId) {
      return createResponse(400, {
        error: "orderId missing from path"
      });
    }

    let body;

    try {
      body = parseBody(event);
    } catch (err) {
      return createResponse(400, {
        error: err.message
      });
    }

    const { Item: existingOrder } = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { orderId }
      })
    );

    if (!existingOrder) {
      return createResponse(404, {
        error: "Order not found"
      });
    }

    // Don't allow updating completed/cancelled orders
    if (
      existingOrder.status === "PAID" ||
      existingOrder.status === "CANCELLED" ||
      existingOrder.status === "DELIVERED"
    ) {
      return createResponse(400, {
        error: `Cannot update ${existingOrder.status} order`
      });
    }

    const updatedOrder = {
      ...existingOrder,
      shipping_address:
        body.shipping_address ??
        existingOrder.shipping_address,

      delivery_instructions:
        body.delivery_instructions ??
        existingOrder.delivery_instructions,

      contact_number:
        body.contact_number ??
        existingOrder.contact_number,

      updated_at: new Date().toISOString()
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: updatedOrder
      })
    );

    await publishEvent(
      TOPIC_ARN,
      "OrderUpdated",
      updatedOrder
    );

    return createResponse(200, {
      success: true,
      data: updatedOrder
    });
  }

  // DELETE /orders/:orderId
  if (path.includes("/orders/") && method === "DELETE") {

    const orderId = getOrderId(event, path);

    if (!orderId) {
      return createResponse(400, {
        error: "orderId missing from path"
      });
    }

    const { Item: order } = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { orderId }
      })
    );

    if (!order) {
      return createResponse(404, {
        error: "Order not found"
      });
    }

    if (
      order.status === "PAID" ||
      order.status === "SHIPPED" ||
      order.status === "DELIVERED"
    ) {
      return createResponse(400, {
        error: `Cannot cancel ${order.status} order`
      });
    }

    const cancelledOrder = {
      ...order,
      status: "CANCELLED",
      updated_at: new Date().toISOString()
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: cancelledOrder
      })
    );

    await publishEvent(
      TOPIC_ARN,
      "OrderCancelled",
      {
        orderId,
        userId: order.userId,
        items: order.items,
        cancelledAt: cancelledOrder.updated_at
      }
    );

    return createResponse(200, {
      success: true,
      message: "Order cancelled successfully",
      data: cancelledOrder
    });
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
    
    if (eventType === "InventoryReservationFailed") {
    await publishEvent(
      TOPIC_ARN,
      "OrderCancelled",
      {
        orderId,
        userId: payload.userId,
        items: payload.items,
        reason: payload.reason || "Inventory reservation failed",
        cancelledAt: new Date().toISOString()
      }
    );

    logger.info(`Published OrderCancelled for orderId: ${orderId}`);
  }
    if (eventType === "PaymentSucceeded") {
      newStatus = 'PAID';
      
      let orderItems = [];
      let totalAmount = 0;
      try {
        const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { orderId } }));
        if (Item) {
          orderItems = Item.items || [];
          totalAmount = Item.total_amount || 0;
        }
      } catch (err) {
        logger.error(`Failed to fetch order ${orderId} for PaymentSucceeded event`, { error: err.message });
      }

      await publishEvent(
        TOPIC_ARN,
        "OrderConfirmed",
        {
          orderId,
          userId: payload.userId,
          items: orderItems,
          total_amount: totalAmount,
          confirmedAt: new Date().toISOString()
        }
      );

      logger.info(`Published OrderConfirmed for orderId: ${orderId}`);
    }
    if (eventType === 'PaymentFailed') newStatus = 'FAILED';

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