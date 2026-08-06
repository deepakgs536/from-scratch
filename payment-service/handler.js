import { v4 as uuidv4 } from 'uuid';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from './src/dynamodb.js';
import { publishEvent } from './src/sns.js';
import { logger } from './src/logger.js';

const TABLE_NAME = process.env.PAYMENTS_TABLE || 'PaymentsTable';
const TOPIC_ARN = process.env.PAYMENT_EVENTS_TOPIC_ARN;

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

const getPaymentId = (event, path) => {
  if (event.pathParameters && event.pathParameters.paymentId) return event.pathParameters.paymentId;
  const match = path.match(/\/payments\/([^\/]+)/);
  return match && match[1] !== 'initiate' && match[1] !== 'webhook' ? match[1] : null;
};

const getOrderIdFromPayment = (event, path) => {
  if (event.pathParameters && event.pathParameters.orderId) {
    return event.pathParameters.orderId;
  }

  const match = path.match(/\/payments\/order\/([^\/]+)/);
  return match ? match[1] : null;
};

const handleInitiatePayment = async (event) => {
  let body;
  try { body = parseBody(event); } catch (e) { return createResponse(400, { error: e.message }); }
  
  if (!body.orderId || !body.userId || typeof body.amount !== 'number' || body.amount <= 0 || !body.currency) {
    return createResponse(400, { error: 'Missing or invalid fields: orderId, userId, amount (>0), currency' });
  }

  const payment = {
    paymentId: `pay_${uuidv4().replaceAll('-', '')}`,
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
};

const handleWebhook = async (event) => {
  let body;
  try { body = parseBody(event); } catch (e) { return createResponse(400, { error: e.message }); }
  
  if (!body.paymentId || !['SUCCESS', 'FAILED', 'REFUNDED'].includes(body.status)) {
    return createResponse(400, { error: 'Invalid webhook payload: Requires paymentId and valid status' });
  }

  try {
    const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { paymentId: body.paymentId } }));
    if (!Item) return createResponse(404, { error: 'Payment not found' });
    
    if (Item.status === body.status) return createResponse(200, { success: true, message: 'Webhook already processed for this status' });

    const { Attributes } = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { paymentId: body.paymentId },
      UpdateExpression: "SET #status = :status, updated_at = :updatedAt",
      ConditionExpression: "attribute_exists(paymentId)",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": body.status, ":updatedAt": new Date().toISOString() },
      ReturnValues: "ALL_NEW"
    }));

    if (body.status === 'SUCCESS' && TOPIC_ARN) await publishEvent(TOPIC_ARN, 'PaymentSucceeded', Attributes);
    else if (body.status === 'FAILED' && TOPIC_ARN) await publishEvent(TOPIC_ARN, 'PaymentFailed', Attributes);
    else if (body.status === 'REFUNDED' && TOPIC_ARN) await publishEvent(TOPIC_ARN, 'PaymentRefunded', Attributes);

    return createResponse(200, { success: true, data: Attributes });
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') return createResponse(404, { error: 'Payment not found' });
    throw error;
  }
};

const handleGetPayments = async (event) => {
  const query = event.queryStringParameters || {};
  const pageSize = Number(query.pageSize) || 10;
  let exclusiveStartKey;

  if (query.lastKey) {
    try { exclusiveStartKey = JSON.parse(Buffer.from(query.lastKey, "base64").toString("utf8")); } 
    catch { return createResponse(400, { success: false, error: "Invalid lastKey" }); }
  }

  const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME, Limit: pageSize, ExclusiveStartKey: exclusiveStartKey }));
  return createResponse(200, {
    success: true,
    count: result.Items?.length || 0,
    data: result.Items || [],
    nextKey: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64") : null
  });
};

const handleGetPayment = async (event, path) => {
  const paymentId = getPaymentId(event, path);
  if (!paymentId) return createResponse(400, { error: 'paymentId missing from path' });

  const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { paymentId } }));
  if (!Item) return createResponse(404, { error: 'Payment not found' });
  return createResponse(200, { success: true, data: Item });
};

const handleGetPaymentByOrder = async (event, path) => {
  const orderId = getOrderIdFromPayment(event, path);
  if (!orderId) return createResponse(400, { error: "orderId missing from path" });

  const { Items } = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI1",
    KeyConditionExpression: "orderId = :orderId",
    ExpressionAttributeValues: { ":orderId": orderId }
  }));

  if (!Items || Items.length === 0) return createResponse(404, { error: "Payment not found" });
  return createResponse(200, { success: true, data: Items[0] });
};

const handleUpdatePayment = async (event, path) => {
  const paymentId = getPaymentId(event, path);
  if (!paymentId) return createResponse(400, { error: "paymentId missing from path" });

  let body;
  try { body = parseBody(event); } catch (err) { return createResponse(400, { error: err.message }); }

  const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { paymentId } }));
  if (!Item) return createResponse(404, { error: "Payment not found" });
  if (Item.status !== "PENDING") return createResponse(400, { error: "Only PENDING payments can be updated" });

  const updatedPayment = {
    ...Item,
    payment_method: body.payment_method ?? Item.payment_method,
    currency: body.currency ?? Item.currency,
    status: body.status ?? Item.status,
    updated_at: new Date().toISOString()
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: updatedPayment }));

  if (updatedPayment.status === "PAID" && body.status == "PAID") {
    await publishEvent(TOPIC_ARN, "PaymentSucceeded", { paymentId: updatedPayment.paymentId, orderId: updatedPayment.orderId, userId: updatedPayment.userId });
  }
  if (updatedPayment.status === "FAILED") {
    await publishEvent(TOPIC_ARN, "PaymentFailed", { paymentId: updatedPayment.paymentId, orderId: updatedPayment.orderId, userId: updatedPayment.userId, reason: updatedPayment.failure_reason || "Payment failed" });
  }
  
  return createResponse(200, { success: true, data: updatedPayment });
};

const handleApiGatewayEvent = async (event) => {
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || event.rawPath || '';
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

  if (method === 'OPTIONS') return createResponse(200, { success: true });

  if (path.endsWith('/initiate') && method === 'POST') return await handleInitiatePayment(event);
  if (path.endsWith('/webhook') && method === 'POST') return await handleWebhook(event);
  if (path === "/payments" && method === "GET") return await handleGetPayments(event);
  if (path.includes('/payments/') && !path.includes('/order/') && !path.endsWith('/initiate') && !path.endsWith('/webhook') && method === 'GET') return await handleGetPayment(event, path);
  if (path.includes("/payments/order/") && method === "GET") return await handleGetPaymentByOrder(event, path);
  if (path.includes("/payments/") && !path.endsWith("/initiate") && !path.endsWith("/webhook") && method === "PUT") return await handleUpdatePayment(event, path);

  return createResponse(404, { error: 'Not Found' });
};

const processOrderCreated = async (payload) => {
  const { orderId, userId, total_amount } = payload || {};
  if (!orderId || !userId || typeof total_amount !== 'number') return;
  
  const deterministicPaymentId = `pay_auto_${orderId.replaceAll('-', '')}`;
  const payment = {
    paymentId: deterministicPaymentId,
    orderId, userId,
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
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: payment, ConditionExpression: "attribute_not_exists(paymentId)" }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') logger.warn(`Idempotency caught: Payment ${deterministicPaymentId} already exists for Order ${orderId}`);
    else throw err;
  }
};

const processOrderCancelled = async (payload) => {
  const { orderId } = payload;
  if (!orderId) return;

  const paymentId = `pay_auto_${orderId.replaceAll('-', '')}`;
  const { Item } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { paymentId } }));
  if (!Item) {
    logger.warn(`Payment not found for order ${orderId}`);
    return;
  }

  if (Item.status === "SUCCESS" || Item.status === "REFUNDED") return;

  const { Attributes } = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME, Key: { paymentId },
    UpdateExpression: "SET #status=:status, updated_at=:updatedAt",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":status": "CANCELLED", ":updatedAt": new Date().toISOString() },
    ReturnValues: "ALL_NEW"
  }));

  if(TOPIC_ARN) await publishEvent(TOPIC_ARN, "PaymentCancelled", Attributes);
  logger.info(`Published PaymentCancelled for ${paymentId}`);
};

const handleSqsEvent = async (event) => {
  for (const record of event.Records) {
    const sqsMessage = typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
    const payloadWrapper = (sqsMessage.Message && typeof sqsMessage.Message === 'string') ? JSON.parse(sqsMessage.Message) : sqsMessage;
    
    const { eventType, payload } = payloadWrapper;
    if (eventType === 'OrderCreated') await processOrderCreated(payload);
    if (eventType === "OrderCancelled") await processOrderCancelled(payload);
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
