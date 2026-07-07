import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { logger } from './logger.js';

const sesClient = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });
const SOURCE_EMAIL = process.env.SES_SOURCE_EMAIL || "deepakgs536@gmail.com";

export const sendEmail = async (toAddress, subject, bodyHtml, bodyText) => {
  if (!toAddress) {
    logger.error('No toAddress provided for email dispatch');
    throw new Error('Missing toAddress');
  }

  const params = {
    Destination: {
      ToAddresses: [toAddress],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: bodyHtml,
        },
        Text: {
          Charset: "UTF-8",
          Data: bodyText || bodyHtml.replace(/<[^>]+>/g, ''), // Fallback text strip
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: subject,
      },
    },
    Source: SOURCE_EMAIL,
  };

  try {
    const data = await sesClient.send(new SendEmailCommand(params));
    logger.info(`Email sent to ${toAddress}`, { messageId: data.MessageId });
    return data;
  } catch (err) {
    logger.error(`Failed to send email to ${toAddress}`, { error: err.message });
    throw err;
  }
};
