import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../handler.js';
import { docClient } from '../src/dynamodb.js';
import { SNSClient } from '@aws-sdk/client-sns';
import { publishEvent } from '../src/sns.js';

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

// Basic API Tests
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

test('GET /inventory/:productId missing id should return 400', async (t) => {
  const res = await handler(userEvent('GET', '/inventory/', null, null), {});
  assert.strictEqual(res.statusCode, 400);
});

test('GET /inventory/:productId should return 404 if not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('GET', '/inventory/1', null, { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('POST /inventory/adjust invalid json', async (t) => {
  const res = await handler(userEvent('POST', '/inventory/adjust', 'not-json'), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /inventory/adjust missing fields', async (t) => {
  const res = await handler(userEvent('POST', '/inventory/adjust', { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /inventory/adjust success', async (t) => {
  mock.method(docClient, 'send', async () => ({ Attributes: { available_quantity: 15 } }));
  const res = await handler(userEvent('POST', '/inventory/adjust', { productId: '1', quantityChange: 5 }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('PUT /inventory/:productId missing id', async (t) => {
  const res = await handler(userEvent('PUT', '/inventory/', { available_quantity: 10 }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /inventory/:productId invalid JSON', async (t) => {
  const res = await handler(userEvent('PUT', '/inventory/1', 'not-json', { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /inventory/:productId no fields', async (t) => {
  const res = await handler(userEvent('PUT', '/inventory/1', { unknown: 10 }, { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /inventory/:productId not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('PUT', '/inventory/1', { available_quantity: 10 }, { productId: '1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('PUT /inventory/:productId success', async (t) => {
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
  process.env.INVENTORY_EVENTS_TOPIC_ARN = 'arn:aws:sns:test';
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', items: [{ productId: '1', quantity: 2 }] });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCreated invalid items array', async (t) => {
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', items: "not-an-array" });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCreated invalid item', async (t) => {
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', items: [{ unknown: 1 }] });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCreated generic error', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DB Error'); });
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', items: [{ productId: '1', quantity: 2 }] });
  await assert.rejects(async () => await handler(event, {}));
});

test('SQS OrderCreated insufficient stock (ConditionalCheckFailed)', async (t) => {
  mock.method(docClient, 'send', async () => {
    const err = new Error('Condition Failed');
    err.name = 'ConditionalCheckFailedException';
    throw err;
  });
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', items: [{ productId: '1', quantity: 999 }] });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true); 
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

test('SQS ProductDeleted missing productId', async (t) => {
  const event = createSqsEvent('ProductDeleted', {});
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS ProductDeleted not found in DB', async (t) => {
  mock.method(docClient, 'send', async () => ({})); // returns null Item
  const event = createSqsEvent('ProductDeleted', { productId: 'p1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS ProductDeleted DB error', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DB Error'); });
  const event = createSqsEvent('ProductDeleted', { productId: 'p1' });
  await assert.rejects(async () => await handler(event, {}));
});

test('SQS PaymentSucceeded success', async (t) => {
  const event = createSqsEvent('PaymentSucceeded', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS PaymentSucceeded missing orderId', async (t) => {
  const event = createSqsEvent('PaymentSucceeded', {});
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS PaymentSucceeded fetch not ok', async (t) => {
  global.fetch = mock.fn(async () => ({ ok: false }));
  const event = createSqsEvent('PaymentSucceeded', { orderId: 'o1' });
  await assert.rejects(async () => await handler(event, {}));
});

test('SQS PaymentSucceeded no items', async (t) => {
  global.fetch = mock.fn(async () => ({ ok: true, json: async () => ({ data: {} }) })); // items is missing
  const event = createSqsEvent('PaymentSucceeded', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

// sns.js coverage
test('publishEvent success', async (t) => {
  const res = await publishEvent('arn:test', 'TestEvent', { data: 1 });
  assert.strictEqual(res.MessageId, 'mocked');
});

test('publishEvent failure', async (t) => {
  mock.method(SNSClient.prototype, 'send', async () => { throw new Error('SNS Error'); });
  await publishEvent('arn', 'TestEvent', {});
  assert.ok(true);
});

test('parseBody should return 400 on invalid JSON', async (t) => {
  const event = { httpMethod: 'POST', path: '/inventory/adjust', body: "{ invalid json }" };
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(JSON.parse(res.body).error, 'Invalid JSON body');
});

test('getProductId should fallback to match path', async (t) => {
  const event = { httpMethod: 'GET', path: '/inventory/777' };
  mock.method(docClient, 'send', async () => ({ Item: { productId: '777' } }));
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('Unhandled error should return 500', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DynamoDB Error'); });
  const event = { httpMethod: 'GET', path: '/inventory/u1' };
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 500);
});
