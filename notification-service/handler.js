// Trigger deployment for missing DynamoDB table fix
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from './src/dynamodb.js';
import { sendEmail } from './src/ses.js';
import { logger } from './src/logger.js';

const TABLE_NAME = process.env.NOTIFICATIONS_TABLE || 'NotificationsLogTable';

const getUserEmail = async (userId) => {
  if (!process.env.USER_SERVICE_URL) {
    logger.warn('USER_SERVICE_URL not set, falling back to deepakgs536@gmail.com');
    return 'deepakgs536@gmail.com'; // Fallback if env missing
  }
  const url = `${process.env.USER_SERVICE_URL}/users/${userId}`;
  try {
    const response = await fetch(url, {
      headers: {
        'x-internal-key': process.env.INTERNAL_API_KEY || ''
      }
    });
    if (!response.ok) {
      throw new Error(`User service returned ${response.status}`);
    }
    const result = await response.json();
    return result.data?.email;
  } catch (err) {
    logger.error('Failed to fetch user email', { error: err.message, userId });
    return null;
  }
};

const logNotification = async (userId, type, status, payload, errorDetails = null) => {
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        userId: userId || 'unknown_user',
        timestamp: new Date().toISOString(),
        notification_type: type,
        status: status,
        payload: payload,
        error_details: errorDetails
      }
    }));
  } catch (err) {
    logger.error('Failed to log notification to DynamoDB', { error: err.message });
  }
};

const handleOrderCreated = async (payload) => {
  const { orderId, userId, total_amount, items, shipping_address } = payload;
  
  if (!orderId || !userId) {
    logger.warn('Skipping OrderCreated notification: missing orderId or userId');
    return;
  }

  // Idempotency check: Have we already sent an email for this exact order?
  // SQS at-least-once delivery could trigger multiple duplicate emails to the customer.
  try {
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "userId = :uid",
      FilterExpression: "payload.orderId = :oid AND notification_type = :type AND #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { 
        ":uid": userId, 
        ":oid": orderId, 
        ":type": 'OrderCreatedEmail',
        ":status": 'SENT'
      }
    }));
    
    if (Items && Items.length > 0) {
      logger.warn(`Idempotency caught: OrderCreated email already sent for order ${orderId}. Skipping.`);
      return; 
    }
  } catch (err) {
    logger.error('Failed to perform idempotency query', { error: err.message });
    throw err; // Throw to trigger SQS retry rather than risking a duplicate send if the DB is temporarily down
  }
  
  const subject = `Order Confirmation: ${orderId}`;
  const itemsListHtml = (items || []).map(i => `<li>Product ${i.productId}: ${i.quantity} x $${i.unit_price}</li>`).join('');
  
  let shippingHtml = '';
  if (shipping_address && Object.keys(shipping_address).length > 0) {
     shippingHtml = `
      <h3>Shipping Address:</h3>
      <p>
        ${shipping_address.street || ''}<br>
        ${shipping_address.city || ''}, ${shipping_address.state || ''} ${shipping_address.zip_code || ''}<br>
        ${shipping_address.country || ''}
      </p>
     `;
  }

  const bodyHtml = `
    <h1>Thank you for your order!</h1>
    <p>Your order <strong>${orderId}</strong> has been successfully placed and is pending inventory reservation.</p>
    <p>Total Amount: <strong>$${total_amount}</strong></p>
    <h3>Items Ordered:</h3>
    <ul>${itemsListHtml}</ul>
    ${shippingHtml}
    <p>We will notify you once your payment succeeds and the order ships!</p>
  `;

  try {
    const targetEmail = await getUserEmail(userId);
    if (!targetEmail) throw new Error(`Could not resolve email for userId ${userId}`);
    await sendEmail(targetEmail, subject, bodyHtml);
    await logNotification(userId, 'OrderCreatedEmail', 'SENT', payload);
  } catch (err) {
    await logNotification(userId, 'OrderCreatedEmail', 'FAILED', payload, err.message);
    throw err; // Let SQS retry if it's a transient SES failure
  }
};

const handleOrderConfirmed = async (payload) => {
  const { orderId, userId, total_amount, items } = payload;
  
  if (!orderId || !userId) {
    logger.warn('Skipping OrderConfirmed notification: missing orderId or userId');
    return;
  }

  // Idempotency check
  try {
    const { Items } = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "userId = :uid",
      FilterExpression: "payload.orderId = :oid AND notification_type = :type AND #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { 
        ":uid": userId, 
        ":oid": orderId, 
        ":type": 'OrderConfirmedEmail',
        ":status": 'SENT'
      }
    }));
    
    if (Items && Items.length > 0) {
      logger.warn(`Idempotency caught: OrderConfirmed email already sent for order ${orderId}. Skipping.`);
      return; 
    }
  } catch (err) {
    logger.error('Failed to perform idempotency query', { error: err.message });
    throw err;
  }
  
  const subject = `Payment Received - Order Confirmed: ${orderId}`;
  const itemsListHtml = (items || []).map(i => `<li>Product ${i.productId}: ${i.quantity} x $${i.unit_price}</li>`).join('');
  
  const bodyHtml = `
    <h1>Payment Successful!</h1>
    <p>Your payment for order <strong>${orderId}</strong> has been successfully processed.</p>
    <p>Total Amount Paid: <strong>$${total_amount}</strong></p>
    <h3>Items Confirmed:</h3>
    <ul>${itemsListHtml}</ul>
    <p>We are now preparing your items for shipment. We will notify you once it ships!</p>
  `;

  try {
    const targetEmail = await getUserEmail(userId);
    if (!targetEmail) throw new Error(`Could not resolve email for userId ${userId}`);
    await sendEmail(targetEmail, subject, bodyHtml);
    await logNotification(userId, 'OrderConfirmedEmail', 'SENT', payload);
  } catch (err) {
    await logNotification(userId, 'OrderConfirmedEmail', 'FAILED', payload, err.message);
    throw err;
  }
};

const handleSqsEvent = async (event) => {
  for (const record of event.Records) {
    const sqsMessage = typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
    const payloadWrapper = (sqsMessage.Message && typeof sqsMessage.Message === 'string') 
      ? JSON.parse(sqsMessage.Message) : sqsMessage;
    
    const { eventType, payload } = payloadWrapper;
    
    if (eventType === 'OrderCreated') {
      logger.info(`Processing OrderCreated notification for Order ${payload?.orderId}`);
      await handleOrderCreated(payload);
    } else if (eventType === 'OrderConfirmed') {
      logger.info(`Processing OrderConfirmed notification for Order ${payload?.orderId}`);
      await handleOrderConfirmed(payload);
    }
  }
};

// Headless Worker: No API Gateway routes required
export const handler = async (event, context) => {
  logger.info("Received event", { event });
  try {
    if (!event) throw new Error('Empty event');
    
    if (event.Records && event.Records.length > 0 && event.Records[0].eventSource === 'aws:sqs') {
      await handleSqsEvent(event);
      return { success: true };
    } else {
      logger.warn('Received non-SQS event in a headless worker component', { event });
      return { error: 'Unsupported event type. Notification Service is headless.' };
    }
  } catch (error) {
    logger.error('Lambda Error', { error: error.message, stack: error.stack });
    // Crucial: throw the error back to Lambda runtime so the SQS message isn't deleted and goes to DLQ
    if (event.Records) throw error; 
  }
};
