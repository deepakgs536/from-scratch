import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../handler.js';
import { docClient } from '../src/dynamodb.js';
import { SESClient } from '@aws-sdk/client-ses';

beforeEach(() => {
  mock.method(docClient, 'send', async () => ({ Items: [] }));
  mock.method(SESClient.prototype, 'send', async () => ({ MessageId: 'mocked' }));
});

afterEach(() => {
  mock.reset();
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
