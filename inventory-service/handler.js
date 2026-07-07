import { GetCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from './src/dynamodb.js';
import { publishEvent } from './src/sns.js';
import { logger } from './src/logger.js';

const TABLE_NAME = process.env.INVENTORY_TABLE || 'InventoryTable';
const TOPIC_ARN = process.env.INVENTORY_EVENTS_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:inventory-events';

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
  try {
    return JSON.parse(event.body);
  } catch (err) {
    throw new Error('Invalid JSON body');
  }
};

const getProductId = (event, path) => {
  if (event.pathParameters && event.pathParameters.productId) return event.pathParameters.productId;
  if (event.pathParameters && event.pathParameters.id) return event.pathParameters.id;
  const match = path.match(/\/inventory\/([^\/]+)/);
  return match ? match[1] : null;
};

const handleApiGatewayEvent = async (event) => {
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || event.rawPath || '';
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

  if (method === 'OPTIONS') return createResponse(200, { success: true });

  // GET /inventory/:productId
  if (path.includes('/inventory/') && !path.endsWith('/adjust') && method === 'GET') {
    const productId = getProductId(event, path);
    if (!productId) return createResponse(400, { error: 'Product ID missing from path' });

    const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { productId } }));
    if (!Item) return createResponse(404, { error: 'Inventory record not found' });
    return createResponse(200, { success: true, data: Item });
  }

  // POST /inventory/adjust
  if (path.endsWith('/inventory/adjust') && method === 'POST') {
    let body;
    try {
      body = parseBody(event);
    } catch (e) {
      return createResponse(400, { error: e.message });
    }

    const { productId, quantityChange } = body;
    
    if (!productId || typeof quantityChange !== 'number') {
      return createResponse(400, { error: 'Missing or invalid productId or quantityChange (must be a number)' });
    }
    
    const response = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { productId },
      UpdateExpression: "SET available_quantity = if_not_exists(available_quantity, :start) + :change, reserved_quantity = if_not_exists(reserved_quantity, :start), updated_at = :updatedAt",
      ExpressionAttributeValues: {
        ":start": 0,
        ":change": quantityChange,
        ":updatedAt": new Date().toISOString()
      },
      ReturnValues: "ALL_NEW"
    }));
    
    return createResponse(200, { success: true, data: response.Attributes });
  }

  return createResponse(404, { error: 'Not Found' });
};

const handleSqsEvent = async (event) => {
  for (const record of event.Records) {
    const sqsMessage = typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
    // SQS messages sent via SNS contain a "Message" string property which is the actual JSON payload
    const payloadWrapper = (sqsMessage.Message && typeof sqsMessage.Message === 'string') 
      ? JSON.parse(sqsMessage.Message) 
      : sqsMessage;
    
    const { eventType, payload } = payloadWrapper;

    logger.info("Parsed event", {
      eventType,
      payload
    });
    
    if (eventType === 'OrderCreated') {
      const { orderId, items } = payload;
      logger.info(`Processing OrderCreated for orderId: ${orderId}`);
      
      if (!items || !Array.isArray(items)) {
        logger.warn(`OrderCreated event missing valid items array for orderId: ${orderId}`);
        continue; // Skip invalid events rather than crashing the batch
      }

      for (const item of items) {
        if (!item.productId || typeof item.quantity !== 'number') {
          logger.warn(`Invalid item in OrderCreated payload`, { item });
          continue;
        }

        try {
          await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { productId: item.productId },
            UpdateExpression: "SET reserved_quantity = if_not_exists(reserved_quantity, :zero) + :qty, available_quantity = available_quantity - :qty, updated_at = :now",
            ConditionExpression: "available_quantity >= :qty",
            ExpressionAttributeValues: {
              ":zero": 0,
              ":qty": item.quantity,
              ":now": new Date().toISOString()
            }
          }));
          
          logger.info(`Reserved inventory for productId: ${item.productId}`);
          // need to update
          // await publishEvent(TOPIC_ARN, 'InventoryReserved', { orderId, productId: item.productId });
          
        } catch (error) {
          if (error.name === 'ConditionalCheckFailedException') {
            logger.warn(`Insufficient stock for productId: ${item.productId}`);
            // await publishEvent(TOPIC_ARN, 'InventoryReservationFailed', { orderId, productId: item.productId, reason: 'Insufficient Stock' });
          } else {
            logger.error(`Error reserving stock for productId: ${item.productId}`, { error: error.message });
            throw error; // Let the Lambda fail so SQS retries or DLQs this batch
          }
        }
      }
    }

    if (eventType === 'ProductCreated') {
      logger.info(`Creating inventory for ${payload.productId}`);
    
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          productId: payload.productId,
          available_quantity: 10,
          reserved_quantity: 0,
          updated_at: new Date().toISOString()
        }
      }));
    
      logger.info(`Inventory created for ${payload.productId}`);
    }
  }
};

export const handler = async (event, context) => {
  logger.info("Received event", { event });

  try {
    if (!event) return createResponse(400, { error: 'Empty event' });

    logger.info("Checking event type", {
      hasRecords: !!event.Records,
      recordsLength: event.Records?.length,
      eventSource: event.Records?.[0]?.eventSource
    });

    // Detect if event is from SQS
    if (event.Records && event.Records.length > 0 && event.Records[0].eventSource === 'aws:sqs') {
      await handleSqsEvent(event);
      return { success: true };
    } 
    // Otherwise treat as API Gateway HTTP event
    else {
      return await handleApiGatewayEvent(event);
    }
  } catch (error) {
    logger.error('Lambda Error', { error: error.message, stack: error.stack });
    // Throw error so SQS knows the batch failed
    if (event.Records) throw error; 
    return createResponse(500, { error: 'Internal Server Error' });
  }
};
