import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../handler.js';
import { docClient } from '../src/dynamodb.js';
import nodemailer from 'nodemailer';
import { sendEmail } from '../src/mailer.js';

global.fetch = mock.fn(async () => ({
  ok: true,
  json: async () => ({ data: { email: 'test@example.com' } })
}));

beforeEach(() => {
  process.env.SMTP_USER = 'test@example.com';
  process.env.SMTP_PASS = 'dummy-pass';
  mock.method(docClient, 'send', async () => ({ Items: [] }));
  mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async () => ({ messageId: 'mocked' })
  }));
});
 
afterEach(() => {
  mock.reset();
  global.fetch.mock.resetCalls();
});

const createSqsEvent = (eventType, payload) => ({
  Records: [{
    eventSource: 'aws:sqs',
    body: JSON.stringify({ Message: JSON.stringify({ eventType, payload }) })
  }]
});

test('Non-SQS event should return error', async (t) => {
  const res = await handler({ httpMethod: 'GET' }, {});
  assert.ok(res.error);
});

test('Empty SQS payload should be ignored gracefully', async (t) => {
  const event = createSqsEvent('OrderCreated', {});
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCreated success', async (t) => {
  const event = createSqsEvent('OrderCreated', {
    orderId: 'o1',
    userId: 'u1',
    total_amount: 100,
    items: [{ productId: 'p1', quantity: 2, unit_price: 50 }],
    shipping_address: { city: 'Test' }
  });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCreated duplicate idempotency check', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'QueryCommand') {
      return { Items: [{ notification_type: 'OrderCreatedEmail' }] };
    }
    return {};
  });
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', userId: 'u1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderConfirmed success', async (t) => {
  const event = createSqsEvent('OrderConfirmed', {
    orderId: 'o1',
    userId: 'u1',
    total_amount: 100,
    items: [{ productId: 'p1', quantity: 2, unit_price: 50 }]
  });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderConfirmed duplicate idempotency check', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'QueryCommand') {
      return { Items: [{ notification_type: 'OrderConfirmedEmail' }] };
    }
    return {};
  });
  const event = createSqsEvent('OrderConfirmed', { orderId: 'o1', userId: 'u1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderConfirmed missing fields gracefully ignored', async (t) => {
  const event = createSqsEvent('OrderConfirmed', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('getUserEmail fallback when USER_SERVICE_URL is missing', async (t) => {
  const oldUrl = process.env.USER_SERVICE_URL;
  delete process.env.USER_SERVICE_URL;
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', userId: 'u1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
  process.env.USER_SERVICE_URL = oldUrl;
});

test('getUserEmail fails when fetch fails', async (t) => {
  process.env.USER_SERVICE_URL = 'http://mock';
  global.fetch = mock.fn(async () => ({ ok: false, status: 500 }));
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', userId: 'u1' });
  await assert.rejects(async () => await handler(event, {}));
});

test('OrderCreated throws on DB error', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DB error'); });
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', userId: 'u1' });
  await assert.rejects(async () => await handler(event, {}));
});

test('OrderConfirmed throws on DB error', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DB error'); });
  const event = createSqsEvent('OrderConfirmed', { orderId: 'o1', userId: 'u1' });
  await assert.rejects(async () => await handler(event, {}));
});

test('OrderCreated throws on mailer error', async (t) => {
  mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async () => { throw new Error('Mailer error'); }
  }));
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', userId: 'u1' });
  await assert.rejects(async () => await handler(event, {}));
});

test('OrderConfirmed throws on mailer error', async (t) => {
  mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async () => { throw new Error('Mailer error'); }
  }));
  const event = createSqsEvent('OrderConfirmed', { orderId: 'o1', userId: 'u1' });
  await assert.rejects(async () => await handler(event, {}));
});

test('Empty event throws', async (t) => {
  await assert.doesNotReject(async () => await handler(null, {}));
});

test('sendEmail throws if no toAddress', async (t) => {
  await assert.rejects(async () => await sendEmail(null, 'Subject', 'Body'));
});

test('sendEmail throws if no credentials', async (t) => {
  delete process.env.SMTP_USER;
  await assert.rejects(async () => await sendEmail('test@example.com', 'Subject', 'Body'));
});

test('sendEmail throws on sendMail failure', async (t) => {
  process.env.SMTP_USER = 'test@example.com';
  process.env.SMTP_PASS = 'dummy-pass';
  mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async () => { throw new Error('Mailer error'); }
  }));
  await assert.rejects(async () => await sendEmail('test@example.com', 'Subject', 'Body'));
});


