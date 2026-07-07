import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { logger } from './logger.js';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || "us-east-1" });

export const publishEvent = async (topicArn, eventType, payload) => {
  if (!topicArn) {
    logger.warn(`No SNS Topic ARN provided for event: ${eventType}`);
    return;
  }
  
  const message = JSON.stringify({ eventType, payload });
  
  try {
    await snsClient.send(new PublishCommand({
      TopicArn: topicArn,
      Message: message,
      MessageAttributes: {
        eventType: {
          DataType: "String",
          StringValue: eventType
        }
      }
    }));
    logger.info(`Published ${eventType} event successfully`);
  } catch (error) {
    logger.error(`Failed to publish ${eventType} event`, { error: error.message });
    throw error;
  }
};
