import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { logger } from "./logger.js";

const snsClient = new SNSClient({ region: process.env.AWS_REGION || "us-east-1" });

export const publishEvent = async (topicArn, eventType, payload) => {
  try {
    const params = {
      TopicArn: topicArn,
      Message: JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() }),
      MessageAttributes: {
        eventType: { DataType: "String", StringValue: eventType }
      }
    };
    const response = await snsClient.send(new PublishCommand(params));
    logger.info(`Event published: ${eventType}`, { messageId: response.MessageId });
    return response;
  } catch (error) {
    logger.error(`Failed to publish event: ${eventType}`, { error: error.message });
    throw error;
  }
};
