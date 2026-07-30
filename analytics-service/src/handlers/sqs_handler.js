import { handleSqsEvent } from "../controllers/analytics_controller.js";
import { logger } from "../utils/logger.js";

export const handler = async (event) => {
  logger.info("Received SQS event", { recordsCount: event.Records?.length });

  try {
    if (!event.Records || event.Records.length === 0) {
      return { statusCode: 200, body: "No records to process" };
    }

    await handleSqsEvent(event.Records);

    return { statusCode: 200, body: "Processed successfully" };
  } catch (error) {
    logger.error("SQS Handler Error", { error: error.message, stack: error.stack });
    throw error; // Throw so SQS retries or sends to DLQ
  }
};
