import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

const handleApiGatewayEvent = async (event) => {
  const path = event.path || event.rawPath || '';
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

  if (method === 'OPTIONS') return createResponse(200, { success: true });

  // GET /inventory/:productId
  if (path.includes('/inventory/') && !path.endsWith('/adjust') && method === 'GET') {
    const productId = event.pathParameters ? event.pathParameters.productId : path.split('/').pop();
    const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { productId } }));
    if (!Item) return createResponse(404, { error: 'Inventory record not found' });
    return createResponse(200, { success: true, data: Item });
  }

  // POST /inventory/adjust
  if (path.endsWith('/inventory/adjust') && method === 'POST') {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
    const { productId, quantityChange } = body;
    
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
    
    if (eventType === 'OrderCreated') {
      const { orderId, items } = payload;
      logger.info(`Processing OrderCreated for orderId: ${orderId}`);
      
      for (const item of items) {
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
          await publishEvent(TOPIC_ARN, 'InventoryReserved', { orderId, productId: item.productId });
          
        } catch (error) {
          if (error.name === 'ConditionalCheckFailedException') {
            logger.warn(`Insufficient stock for productId: ${item.productId}`);
            await publishEvent(TOPIC_ARN, 'InventoryReservationFailed', { orderId, productId: item.productId, reason: 'Insufficient Stock' });
          } else {
            logger.error(`Error reserving stock for productId: ${item.productId}`, { error: error.message });
            throw error;
          }
        }
      }
    }
  }
};

export const handler = async (event, context) => {
  logger.info("Received event", { event });

  try {
    if (event.Records && event.Records.length > 0 && event.Records[0].eventSource === 'aws:sqs') {
      await handleSqsEvent(event);
      return { success: true };
    } else {
      return await handleApiGatewayEvent(event);
    }
  } catch (error) {
    logger.error('Lambda Error', { error: error.message });
    if (event.Records) throw error; 
    return createResponse(500, { error: 'Internal Server Error' });
  }
};
