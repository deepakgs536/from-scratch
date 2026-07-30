import {
  getDashboard, getRevenue, getOrders, getProducts, 
  getCustomers, getInventory, getPayments, processEvent
} from "../services/analytics_service.js";
import { logger } from "../utils/logger.js";

export const handleApiRequest = async (path, method) => {
  if (method !== "GET") return null;

  if (path.endsWith("/analytics/dashboard")) return await getDashboard();
  if (path.endsWith("/analytics/revenue")) return await getRevenue();
  if (path.endsWith("/analytics/orders")) return await getOrders();
  if (path.endsWith("/analytics/products")) return await getProducts();
  if (path.endsWith("/analytics/customers")) return await getCustomers();
  if (path.endsWith("/analytics/inventory")) return await getInventory();
  if (path.endsWith("/analytics/payments")) return await getPayments();

  return null;
};

export const handleSqsEvent = async (records) => {
  for (const record of records) {
    try {
      const snsMessage = JSON.parse(record.body);
      
      // SNS wraps the actual message in `Message` property
      const payloadString = snsMessage.Message || "{}";
      const payload = JSON.parse(payloadString);
      
      // Extract eventType from MessageAttributes or the payload itself
      // Assuming standard SNS message attributes mapping
      const eventType = 
        snsMessage.MessageAttributes?.eventType?.Value || 
        payload.eventType || 
        null;
        
      if (eventType) {
        await processEvent(eventType, payload);
      } else {
        logger.warn("Received event without eventType", { recordId: record.messageId });
      }
    } catch (err) {
      logger.error("Error processing SQS record", { error: err.message, recordId: record.messageId });
    }
  }
};
