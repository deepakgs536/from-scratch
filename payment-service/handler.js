import { v4 as uuidv4 } from 'uuid';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from './src/dynamodb.js';
import { publishEvent } from './src/sns.js';
import { logger } from './src/logger.js';

const TABLE_NAME = process.env.PAYMENTS_TABLE || 'PaymentsTable';
const TOPIC_ARN = process.env.PAYMENT_EVENTS_TOPIC_ARN || 'arn:aws:sns:us-east-1:123456789012:payment-events';

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

const getPaymentId = (event, path) => {
  if (event.pathParameters && event.pathParameters.paymentId) return event.pathParameters.paymentId;
  const match = path.match(/\/payments\/([^\/]+)/);
  return match && match[1] !== 'initiate' && match[1] !== 'webhook' ? match[1] : null;
};

const handleApiGatewayEvent = async (event) => {
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || event.rawPath || '';
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

  if (method === 'OPTIONS') return createResponse(200, { success: true });

  // POST /payments/initiate (Manual fallback/override/retry)
  if (path.endsWith('/initiate') && method === 'POST') {
    let body;
    try { body = parseBody(event); } catch (e) { return createResponse(400, { error: e.message }); }
    
    if (!body.orderId || !body.userId || typeof body.amount !== 'number' || body.amount <= 0 || !body.currency) {
      return createResponse(400, { error: 'Missing or invalid fields: orderId, userId, amount (>0), currency' });
    }

    const payment = {
      paymentId: `pay_${uuidv4().replace(/-/g, '')}`, // Using a distinct prefix for manual intents
      orderId: body.orderId,
      userId: body.userId,
      amount: body.amount,
      currency: body.currency,
      status: 'PENDING',
      transaction_id: `mock_txn_${uuidv4().substring(0,8)}`,
      payment_method: body.payment_method || 'CARD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: payment }));
    
    return createResponse(201, { success: true, data: payment });
  }

  // POST /payments/webhook
  // Mock external webhook (e.g. Stripe) that pushes transaction results
  if (path.endsWith('/webhook') && method === 'POST') {
    let body;
    try { body = parseBody(event); } catch (e) { return createResponse(400, { error: e.message }); }
    
    // In a real app, you would verify Stripe signature headers here.
    if (!body.paymentId || !['SUCCESS', 'FAILED', 'REFUNDED'].includes(body.status)) {
       return createResponse(400, { error: 'Invalid webhook payload: Requires paymentId and valid status' });
    }

    try {
      // Idempotency check: Don't broadcast SUCCESS if it's already SUCCESS
      const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { paymentId: body.paymentId } }));
      if (!Item) return createResponse(404, { error: 'Payment not found' });
      
      if (Item.status === body.status) {
         return createResponse(200, { success: true, message: 'Webhook already processed for this status' });
      }

      const { Attributes } = await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { paymentId: body.paymentId },
        UpdateExpression: "SET #status = :status, updated_at = :updatedAt",
        ConditionExpression: "attribute_exists(paymentId)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": body.status, ":updatedAt": new Date().toISOString() },
        ReturnValues: "ALL_NEW"
      }));

      // Broadcast the outcome so Order Service can mark as PAID / FAILED
      if (body.status === 'SUCCESS') {
        await publishEvent(TOPIC_ARN, 'PaymentSucceeded', Attributes);
      } else if (body.status === 'FAILED') {
        await publishEvent(TOPIC_ARN, 'PaymentFailed', Attributes);
      } else if (body.status === 'REFUNDED') {
        await publishEvent(TOPIC_ARN, 'PaymentRefunded', Attributes);
      }

      return createResponse(200, { success: true, data: Attributes });
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        return createResponse(404, { error: 'Payment not found' });
      }
      throw error;
    }
  }

  // GET /payments/:paymentId
  if (path.includes('/payments/') && !path.endsWith('/initiate') && !path.endsWith('/webhook') && method === 'GET') {
    const paymentId = getPaymentId(event, path);
    if (!paymentId) return createResponse(400, { error: 'paymentId missing from path' });

    const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { paymentId } }));
    if (!Item) return createResponse(404, { error: 'Payment not found' });
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
    
    // Automatically generate a PENDING payment intent when an Order is Created
    if (eventType === 'OrderCreated') {
      const { orderId, userId, total_amount } = payload || {};
      if (!orderId || !userId || typeof total_amount !== 'number') continue;
      
      // Deterministic paymentId to guarantee idempotency against SQS duplicates
      const deterministicPaymentId = `pay_auto_${orderId.replace(/-/g, '')}`;

      const payment = {
        paymentId: deterministicPaymentId,
        orderId: orderId,
        userId: userId,
        amount: total_amount,
        currency: 'USD',
        status: 'PENDING',
        transaction_id: `mock_txn_${uuidv4().substring(0,8)}`,
        payment_method: 'CARD',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      try {
        logger.info(`Saga initiation: Creating PENDING payment ${payment.paymentId} for Order ${orderId}`);
        await docClient.send(new PutCommand({ 
          TableName: TABLE_NAME, 
          Item: payment,
          ConditionExpression: "attribute_not_exists(paymentId)" // Prevent duplicates if SQS retries
        }));
      } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') {
          logger.warn(`Idempotency caught: Payment ${deterministicPaymentId} already exists for Order ${orderId}`);
        } else {
          throw err;
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
