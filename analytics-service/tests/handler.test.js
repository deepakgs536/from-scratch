import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../app.js';
import { docClient } from '../src/config/aws.js';

beforeEach(() => {
  mock.method(docClient, 'send', async () => ({}));
  // Mock fetch for generateDetailedReport
  global.fetch = mock.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }));
});
 
afterEach(() => {
  mock.reset();
  global.fetch = undefined;
});

const userEvent = (method, path, body = null, queryStringParameters = null) => ({
  httpMethod: method,
  path,
  body: body ? JSON.stringify(body) : null,
  queryStringParameters,
  requestContext: {}
});

// API Gateway Universal tests
test('Unknown event source returns 400', async (t) => {
  const res = await handler({}, {});
  assert.strictEqual(res.statusCode, 400);
});

// API Handler tests
test('OPTIONS request for CORS', async (t) => {
  const res = await handler(userEvent('OPTIONS', '/analytics'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/health should return 200', async (t) => {
  const res = await handler(userEvent('GET', '/analytics/health'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/dashboard should return 200', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { test: true } }));
  const res = await handler(userEvent('GET', '/analytics/dashboard'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/revenue should return 200', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ amount: 100 }] }));
  const res = await handler(userEvent('GET', '/analytics/revenue'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/orders should return 200', async (t) => {
  const res = await handler(userEvent('GET', '/analytics/orders'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/products should return 200', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ productId: 'p1', count: 5 }] }));
  const res = await handler(userEvent('GET', '/analytics/products'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/customers should return 200', async (t) => {
  const res = await handler(userEvent('GET', '/analytics/customers'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/inventory should return 200', async (t) => {
  const res = await handler(userEvent('GET', '/analytics/inventory'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/payments should return 200', async (t) => {
  const res = await handler(userEvent('GET', '/analytics/payments'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /generate/report should return 200', async (t) => {
  const res = await handler(userEvent('GET', '/generate/report'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('Unknown route should return 404', async (t) => {
  const res = await handler(userEvent('GET', '/unknown'), {});
  assert.strictEqual(res.statusCode, 404);
});

// SQS Event processing tests
const createSqsEvent = (eventType, payload) => ({
  Records: [{
    messageId: '123',
    eventSource: 'aws:sqs',
    body: JSON.stringify({ Message: JSON.stringify({ eventType, payload }) })
  }]
});

test('SQS ProductCreated success', async (t) => {
  const event = createSqsEvent('ProductCreated', { productId: 'p1' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('SQS ProductDeleted success', async (t) => {
  const event = createSqsEvent('ProductDeleted', { productId: 'p1' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('SQS OrderCreated success', async (t) => {
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', total_amount: 100, items: [{ productId: 'p1', quantity: 2 }] });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('SQS OrderCancelled success', async (t) => {
  const event = createSqsEvent('OrderCancelled', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('SQS OrderCompleted success', async (t) => {
  const event = createSqsEvent('OrderCompleted', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('SQS PaymentSucceeded success', async (t) => {
  const event = createSqsEvent('PaymentSucceeded', { orderId: 'o1', amount: 50 });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('SQS PaymentFailed success', async (t) => {
  const event = createSqsEvent('PaymentFailed', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('SQS UserRegistered success', async (t) => {
  const event = createSqsEvent('UserRegistered', { userId: 'u1' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('SQS InventoryUpdated success', async (t) => {
  const event = createSqsEvent('InventoryUpdated', { available_quantity: 0 });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
  
  const event2 = createSqsEvent('InventoryUpdated', { available_quantity: 5 });
  const res2 = await handler(event2, {});
  assert.strictEqual(res2.statusCode, 200);
});

test('SQS Unknown event type', async (t) => {
  const event = createSqsEvent('UnknownEvent', {});
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('SQS without eventType', async (t) => {
  const event = {
    Records: [{
      messageId: '123',
      eventSource: 'aws:sqs',
      body: JSON.stringify({ Message: JSON.stringify({}) })
    }]
  };
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200); 
});

test('SQS processing error', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DB Error'); });
  const event = createSqsEvent('ProductCreated', {});
  const res = await handler(event, {});
  assert.ok(res);
});

// generateDetailedReport Edge Cases
test('generateDetailedReport handles fetch failures', async (t) => {
  global.fetch = mock.fn(async () => { throw new Error('Network Error'); });
  const res = await handler(userEvent('GET', '/generate/report'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('generateDetailedReport handles non-ok responses', async (t) => {
  global.fetch = mock.fn(async () => ({ ok: false, status: 500 }));
  const res = await handler(userEvent('GET', '/generate/report'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('generateDetailedReport full data mapping', async (t) => {
  global.fetch = mock.fn(async (url) => {
    let data = [];
    if (url.includes('users')) data = [{ id: 'u1', created_at: '2023-01-01T00:00:00Z' }];
    if (url.includes('products')) data = [{ id: 'p1', category: 'cat1' }];
    if (url.includes('orders')) data = [{ id: 'o1', total_amount: 100, status: 'PAID', created_at: '2023-01-01T00:00:00Z', items: [{ productId: 'p1', price: 10, quantity: 2 }] }];
    if (url.includes('inventory')) data = [{ productId: 'p1', available_quantity: 0 }, { productId: 'p2', available_quantity: 5 }, { productId: 'p3', available_quantity: 20 }];
    if (url.includes('payments')) data = [{ id: 'pay1', status: 'SUCCESS', amount: 100 }, { id: 'pay2', status: 'FAILED' }];
    return { ok: true, json: async () => data }; 
  });
  
  const res = await handler(userEvent('GET', '/generate/report'), {});
  assert.strictEqual(res.statusCode, 200);
});
