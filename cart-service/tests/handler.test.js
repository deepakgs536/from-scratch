import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../handler.js';
import { docClient } from '../src/dynamodb.js';

beforeEach(() => {
  mock.method(docClient, 'send', async () => ({}));
  
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
  delete process.env.PRODUCT_SERVICE_URL;
  delete process.env.INVENTORY_SERVICE_URL;
  delete process.env.ORDER_SERVICE_URL;
});

const userEvent = (method, path, body = null, pathParameters = null) => ({
  httpMethod: method,
  path,
  body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
  pathParameters,
  requestContext: {}
});

test('OPTIONS request for CORS', async (t) => {
  const res = await handler(userEvent('OPTIONS', '/cart'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('Empty event should return 400', async (t) => {
  const res = await handler(null, {});
  assert.strictEqual(res.statusCode, 400);
});

test('Invalid route should return 400 because userId is checked first', async (t) => {
  const res = await handler(userEvent('GET', '/unknown'), {});
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

test('GET /cart/:userId not found defaults to empty', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('GET', '/cart/u1', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('DELETE /cart/:userId should return 200', async (t) => {
  const res = await handler(userEvent('DELETE', '/cart/u1', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('POST /cart/:userId/items invalid JSON', async (t) => {
  const res = await handler(userEvent('POST', '/cart/u1/items', 'not-json', { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /cart/:userId/items missing/invalid fields', async (t) => {
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1' }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /cart/:userId/items product not found', async (t) => {
  process.env.PRODUCT_SERVICE_URL = 'http://mock-prod';
  global.fetch = mock.fn(async () => ({ status: 404, ok: false }));
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('POST /cart/:userId/items product service error', async (t) => {
  process.env.PRODUCT_SERVICE_URL = 'http://mock-prod';
  global.fetch = mock.fn(async () => ({ status: 500, ok: false }));
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 502);
});

test('POST /cart/:userId/items inventory not found', async (t) => {
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  global.fetch = mock.fn(async () => ({ status: 404, ok: false }));
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('POST /cart/:userId/items inventory service error', async (t) => {
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  global.fetch = mock.fn(async () => ({ status: 500, ok: false }));
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 502);
});

test('POST /cart/:userId/items insufficient stock initially', async (t) => {
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  global.fetch = mock.fn(async () => ({ ok: true, json: async () => ({ data: { available_quantity: 1 } }) }));
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /cart/:userId/items add new item success', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).data.items.length, 1);
});

test('POST /cart/:userId/items update existing item success', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 50 }] } }));
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).data.items[0].quantity, 3);
});

test('POST /cart/:userId/items update existing item insufficient stock for combined qty', async (t) => {
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  mock.method(docClient, 'send', async () => ({ Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 99, price_at_addition: 50 }] } }));
  global.fetch = mock.fn(async () => ({ ok: true, json: async () => ({ data: { available_quantity: 100 } }) }));
  
  const res = await handler(userEvent('POST', '/cart/u1/items', { productId: 'p1', quantity: 2, price: 50 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /cart/:userId/checkout empty cart', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { userId: 'u1', items: [] } }));
  const res = await handler(userEvent('POST', '/cart/u1/checkout', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /cart/:userId/checkout missing ORDER_SERVICE_URL', async (t) => {
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  const res = await handler(userEvent('POST', '/cart/u1/checkout', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 500);
});

test('POST /cart/:userId/checkout inventory error', async (t) => {
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  global.fetch = mock.fn(async () => ({ ok: false }));
  const res = await handler(userEvent('POST', '/cart/u1/checkout', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /cart/:userId/checkout insufficient stock', async (t) => {
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 2, price_at_addition: 10 }] }
  }));
  global.fetch = mock.fn(async () => ({ ok: true, json: async () => ({ data: { available_quantity: 1 } }) }));
  const res = await handler(userEvent('POST', '/cart/u1/checkout', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /cart/:userId/checkout order service failure', async (t) => {
  process.env.ORDER_SERVICE_URL = 'http://mock-order';
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  global.fetch = mock.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'Error' }) }));
  const res = await handler(userEvent('POST', '/cart/u1/checkout', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 500);
});

test('POST /cart/:userId/checkout network failure', async (t) => {
  process.env.ORDER_SERVICE_URL = 'http://mock-order';
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  global.fetch = mock.fn(async () => { throw new Error('Network error'); });
  const res = await handler(userEvent('POST', '/cart/u1/checkout', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 502);
});

test('POST /cart/:userId/checkout success', async (t) => {
  process.env.ORDER_SERVICE_URL = 'http://mock-order';
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  const res = await handler(userEvent('POST', '/cart/u1/checkout', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 201);
});

test('PUT /cart/:userId/items/:itemId missing id', async (t) => {
  const res = await handler(userEvent('PUT', '/cart/u1/items/', { quantity: 5 }, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /cart/:userId/items/:itemId invalid body', async (t) => {
  const res = await handler(userEvent('PUT', '/cart/u1/items/p1', 'invalid', { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /cart/:userId/items/:itemId invalid quantity', async (t) => {
  const res = await handler(userEvent('PUT', '/cart/u1/items/p1', { quantity: -1 }, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /cart/:userId/items/:itemId cart not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('PUT', '/cart/u1/items/p1', { quantity: 5 }, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('PUT /cart/:userId/items/:itemId item not found', async (t) => {
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p2', quantity: 1, price_at_addition: 10 }] }
  }));
  const res = await handler(userEvent('PUT', '/cart/u1/items/p1', { quantity: 5 }, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('PUT /cart/:userId/items/:itemId inventory error', async (t) => {
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  global.fetch = mock.fn(async () => ({ ok: false }));
  const res = await handler(userEvent('PUT', '/cart/u1/items/p1', { quantity: 5 }, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 502);
});

test('PUT /cart/:userId/items/:itemId inventory exception', async (t) => {
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  global.fetch = mock.fn(async () => { throw new Error('net err'); });
  const res = await handler(userEvent('PUT', '/cart/u1/items/p1', { quantity: 5 }, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 502);
});

test('PUT /cart/:userId/items/:itemId insufficient inventory', async (t) => {
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  global.fetch = mock.fn(async () => ({ ok: true, json: async () => ({ data: { available_quantity: 1 } }) }));
  const res = await handler(userEvent('PUT', '/cart/u1/items/p1', { quantity: 5 }, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /cart/:userId/items/:itemId success', async (t) => {
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  const res = await handler(userEvent('PUT', '/cart/u1/items/p1', { quantity: 5 }, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('DELETE /cart/:userId/items/:itemId missing id', async (t) => {
  const res = await handler(userEvent('DELETE', '/cart/u1/items/', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('DELETE /cart/:userId/items/:itemId cart not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('DELETE', '/cart/u1/items/p1', null, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('DELETE /cart/:userId/items/:itemId success', async (t) => {
  mock.method(docClient, 'send', async () => ({
    Item: { userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }
  }));
  const res = await handler(userEvent('DELETE', '/cart/u1/items/p1', null, { userId: 'u1', itemId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

const createSqsEvent = (eventType, payload) => ({
  Records: [{
    eventSource: 'aws:sqs',
    body: JSON.stringify({ Message: JSON.stringify({ eventType, payload }) })
  }]
});

test('SQS ProductDeleted missing productId', async (t) => {
  const event = createSqsEvent('ProductDeleted', {});
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS ProductDeleted success', async (t) => {
  let calls = 0;
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'ScanCommand') {
      calls++;
      return calls === 1 ? { 
        Items: [{ userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }] }],
        LastEvaluatedKey: { userId: 'u1' } 
      } : {};
    }
    return {};
  });
  const event = createSqsEvent('ProductDeleted', { productId: 'p1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS ProductUpdated same price does not update', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'ScanCommand') {
      return { Items: [{ userId: 'u1', items: [{ productId: 'p1', quantity: 1, price_at_addition: 20 }] }] };
    }
    return {};
  });
  const event = createSqsEvent('ProductUpdated', { productId: 'p1', price: 20 });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS ProductUpdated different price success', async (t) => {
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

test('SQS random event is ignored', async (t) => {
  const event = createSqsEvent('RandomEvent', { productId: 'p1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('Exception handling fallback', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DB Error'); });
  const res = await handler(userEvent('GET', '/cart/u1', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 500);
});

test('Exception handling fallback for SQS', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DB Error'); });
  const event = createSqsEvent('ProductUpdated', { productId: 'p1', price: 20 });
  await assert.rejects(async () => await handler(event, {}));
});

test('parseBody should return 400 on invalid JSON', async (t) => {
  const event = userEvent('POST', '/cart/u1/items', null, { userId: 'u1' });
  event.body = "{ invalid json }";
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(JSON.parse(res.body).error, 'Invalid JSON body');
});

test('getItemId should fallback to match path', async (t) => {
  const event = userEvent('PUT', '/cart/u1/items/p777', { quantity: 5 }, { userId: 'u1' });
  event.pathParameters.itemId = null; 
  process.env.INVENTORY_SERVICE_URL = 'http://mock-inv';
  global.fetch = mock.fn(async () => ({ ok: true, json: async () => ({ data: { available_quantity: 10 } }) }));
  mock.method(docClient, 'send', async () => ({ Item: { userId: 'u1', items: [] } }));
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});
