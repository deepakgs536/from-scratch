import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from './src/dynamodb.js';
import { sendEmail } from './src/ses.js';
import { logger } from './src/logger.js';

const TABLE_NAME = process.env.NOTIFICATIONS_TABLE || 'NotificationsLogTable';
const TARGET_EMAIL = "deepakgs536@gmail.com"; // Hardcoded per user request

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
    await sendEmail(TARGET_EMAIL, subject, bodyHtml);
    await logNotification(userId, 'OrderCreatedEmail', 'SENT', payload);
  } catch (err) {
    await logNotification(userId, 'OrderCreatedEmail', 'FAILED', payload, err.message);
    throw err; // Let SQS retry if it's a transient SES failure
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
