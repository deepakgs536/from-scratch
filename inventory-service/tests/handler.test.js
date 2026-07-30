import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../handler.js';
import { docClient } from '../src/dynamodb.js';
import { SNSClient } from '@aws-sdk/client-sns';

beforeEach(() => {
  mock.method(docClient, 'send', async () => ({}));
  mock.method(SNSClient.prototype, 'send', async () => ({ MessageId: 'mocked' }));
  
  // Mock fetch for PaymentSucceeded
  global.fetch = mock.fn(async () => {
    return {
      ok: true,
      json: async () => ({ data: { items: [{ productId: 'p1', quantity: 2 }] } })
    };
  });
});

afterEach(() => {
  mock.reset();
  global.fetch = undefined;
});

const userEvent = (method, path, body = null, pathParameters = null) => ({
  httpMethod: method,
  path,
  body: body ? JSON.stringify(body) : null,
  pathParameters,
  requestContext: {}
});

test('OPTIONS request for CORS', async (t) => {
  const res = await handler({ httpMethod: 'OPTIONS', path: '/inventory' }, {});
  assert.strictEqual(res.statusCode, 200);
});

test('Empty event should return 400', async (t) => {
  const res = await handler(null, {});
  assert.strictEqual(res.statusCode, 400);
});

test('Invalid route should return 404', async (t) => {
  const res = await handler(userEvent('GET', '/unknown'), {});
  assert.strictEqual(res.statusCode, 404);
});

test('GET /inventory should return 200 and list', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ productId: '1' }] }));
  const res = await handler(userEvent('GET', '/inventory'), {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).count, 1);
});

test('GET /inventory should handle DB error and return 500', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DB Error'); });
  const res = await handler(userEvent('GET', '/inventory'), {});
  assert.strictEqual(res.statusCode, 500);
});

test('GET /inventory/:productId should return 200 if found', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { productId: '1' } }));
  const res = await handler(userEvent('GET', '/inventory/1', null, { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /inventory/:productId should return 404 if not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('GET', '/inventory/1', null, { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('POST /inventory/adjust should return 400 on invalid body', async (t) => {
  const res = await handler(userEvent('POST', '/inventory/adjust', 'not-json'), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /inventory/adjust should return 400 on missing fields', async (t) => {
  const res = await handler(userEvent('POST', '/inventory/adjust', { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /inventory/adjust should return 200 on success', async (t) => {
  mock.method(docClient, 'send', async () => ({ Attributes: { available_quantity: 15 } }));
  const res = await handler(userEvent('POST', '/inventory/adjust', { productId: '1', quantityChange: 5 }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('PUT /inventory/:productId should return 400 if no fields passed', async (t) => {
  const res = await handler(userEvent('PUT', '/inventory/1', { unknown: 10 }, { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /inventory/:productId should return 404 if item not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('PUT', '/inventory/1', { available_quantity: 10 }, { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('PUT /inventory/:productId should return 200 on success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { productId: '1', available_quantity: 5 } };
    return {};
  });
  const res = await handler(userEvent('PUT', '/inventory/1', { available_quantity: 10 }, { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

// SQS Tests
const createSqsEvent = (eventType, payload) => ({
  Records: [{
    eventSource: 'aws:sqs',
    body: JSON.stringify({ Message: JSON.stringify({ eventType, payload }) })
  }]
});

test('SQS OrderCreated success', async (t) => {
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', items: [{ productId: '1', quantity: 2 }] });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCreated insufficient stock (ConditionalCheckFailed)', async (t) => {
  mock.method(docClient, 'send', async () => {
    const err = new Error('Condition Failed');
    err.name = 'ConditionalCheckFailedException';
    throw err;
  });
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', items: [{ productId: '1', quantity: 999 }] });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true); // Should handle gracefully
});

test('SQS ProductCreated success', async (t) => {
  const event = createSqsEvent('ProductCreated', { productId: 'p1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS ProductDeleted success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { productId: 'p1' } };
    return {};
  });
  const event = createSqsEvent('ProductDeleted', { productId: 'p1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS PaymentSucceeded success', async (t) => {
  const event = createSqsEvent('PaymentSucceeded', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});
