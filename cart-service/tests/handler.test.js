import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../handler.js';
import { docClient } from '../src/dynamodb.js';

beforeEach(() => {
  mock.method(docClient, 'send', async () => ({}));
  
  // Default mock for fetches (Product and Inventory services)
  global.fetch = mock.fn(async (url) => {
    if (url.includes('/products/')) return { ok: true, json: async () => ({}) };
    if (url.includes('/inventory/')) return { ok: true, json: async () => ({ data: { available_quantity: 100 } }) };
    if (url.includes('/orders')) return { ok: true, json: async () => ({ data: { orderId: '123' } }) };
    return { ok: true, json: async () => ({}) };
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
  const res = await handler({ httpMethod: 'OPTIONS', path: '/cart' }, {});
  assert.strictEqual(res.statusCode, 200);
});

test('Empty event should return 400', async (t) => {
  const res = await handler(null, {});
  assert.strictEqual(res.statusCode, 400);
});

test('Missing userId should return 400', async (t) => {
  const res = await handler(userEvent('GET', '/cart/'), {});
  assert.strictEqual(res.statusCode, 400);
});

test('GET /cart/:userId should return 200', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { userId: 'u1', items: [], total_price: 0 } }));
  const res = await handler(userEvent('GET', '/cart/u1', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('DELETE /cart/:userId should return 200', async (t) => {
  const res = await handler(userEvent('DELETE', '/cart/u1', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('POST /cart/:userId/items should return 400 on invalid body', async (t) => {
  const res = await handler(userEvent('POST', '/cart/u1/items', 'not-json', { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /cart/:userId/items should return 400 on missing/invalid fields', async (t) => {
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1' }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /cart/:userId/items should return 404 if product not found', async (t) => {
  process.env.PRODUCT_SERVICE_URL = 'http://mock-prod';
  global.fetch = mock.fn(async () => ({ status: 404, ok: false }));
  
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 404);
  delete process.env.PRODUCT_SERVICE_URL;
});

test('POST /cart/:userId/items should return 400 if insufficient stock', async (t) => {
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  global.fetch = mock.fn(async () => ({ ok: true, json: async () => ({ data: { available_quantity: 1 } }) }));
  
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
  delete process.env.INVENTORY_SERVICE_URL;
});

test('POST /cart/:userId/items should return 200 on success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { userId: 'u1', items: [], total_price: 0 } };
    return {};
  });

  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('POST /cart/:userId/checkout should return 400 if cart empty', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { userId: 'u1', items: [] } }));
  const res = await handler(userEvent('POST', '/cart/u1/checkout', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /cart/:userId/checkout should return 500 if ORDER_SERVICE_URL missing', async (t) => {
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  const res = await handler(userEvent('POST', '/cart/u1/checkout', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 500);
  assert.strictEqual(JSON.parse(res.body).error, 'ORDER_SERVICE_URL not configured');
});

test('PUT /cart/:userId/items/:itemId should return 400 on missing itemId', async (t) => {
  const res = await handler(userEvent('PUT', '/cart/u1/items/', { quantity: 5 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /cart/:userId/items/:itemId should return 404 if cart not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('PUT', '/cart/u1/items/p1', { quantity: 5 }, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('PUT /cart/:userId/items/:itemId should return 200 on success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') {
      return { Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] } };
    }
    return {};
  });

  const res = await handler(userEvent('PUT', '/cart/u1/items/p1', { quantity: 5 }, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('DELETE /cart/:userId/items/:itemId should return 200 on success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') {
      return { Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] } };
    }
    return {};
  });

  const res = await handler(userEvent('DELETE', '/cart/u1/items/p1', null, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

// SQS Tests
const createSqsEvent = (eventType, payload) => ({
  Records: [{
    eventSource: 'aws:sqs',
    body: JSON.stringify({ Message: JSON.stringify({ eventType, payload }) })
  }]
});

test('SQS ProductDeleted success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'ScanCommand') {
      return { Items: [{ userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }] };
    }
    return {};
  });

  const event = createSqsEvent('ProductDeleted', { productId: 'p1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS ProductUpdated success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'ScanCommand') {
      return { Items: [{ userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }] };
    }
    return {};
  });

  const event = createSqsEvent('ProductUpdated', { productId: 'p1', price: 20 });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});
