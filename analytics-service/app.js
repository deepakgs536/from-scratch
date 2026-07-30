import { handler as apiHandler } from "./src/handlers/api_handler.js";
import { handler as sqsHandler } from "./src/handlers/sqs_handler.js";
import { logger } from "./src/utils/logger.js";

export const handler = async (event, context) => {
  // Detect if the event is from SQS
  if (event.Records && event.Records.length > 0 && event.Records[0].eventSource === 'aws:sqs') {
    logger.info("Universal Handler: Routing to SQS Handler");
    return await sqsHandler(event, context);
  } 
  
  // Detect if the event is an HTTP request from API Gateway
  if (event.requestContext || event.httpMethod || event.rawPath) {
    logger.info("Universal Handler: Routing to API Handler");
    return await apiHandler(event, context);
  }

  // Fallback for unknown events
  logger.warn("Universal Handler: Unknown event source", { event });
  return { statusCode: 400, body: JSON.stringify({ error: "Unknown event source" }) };
};
