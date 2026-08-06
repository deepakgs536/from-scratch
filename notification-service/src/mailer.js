import nodemailer from 'nodemailer';
import { logger } from './logger.js';

export const sendEmail = async (toAddress, subject, bodyHtml, bodyText) => {
  if (!toAddress) {
    logger.error('No toAddress provided for email dispatch');
    throw new Error('Missing toAddress');
  }

  // Verify credentials exist
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.error('Missing SMTP credentials in environment variables');
    throw new Error('Missing SMTP_USER or SMTP_PASS');
  }

  // Expecting SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to be set in Lambda env vars.
  // Defaults assume Gmail for ease of use.
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_USER, // Send from the authenticated user to avoid spam blocks
    to: toAddress,
    subject: subject,
    text: bodyText || bodyHtml.replace(/<[^>]*>/g, ''), // Fallback text strip
    html: bodyHtml,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${toAddress}`, { messageId: info.messageId });
    return info;
  } catch (err) {
    logger.error(`Failed to send email to ${toAddress}`, { error: err.message });
    throw err;
  }
};
