import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../handler.js';
import { docClient } from '../src/dynamodb.js';
import { SNSClient } from '@aws-sdk/client-sns';

beforeEach(() => {
  mock.method(docClient, 'send', async () => ({}));
  mock.method(SNSClient.prototype, 'send', async () => ({ MessageId: 'mocked' }));
});

afterEach(() => {
  mock.reset();
});

const adminEvent = (method, path, body = null, pathParameters = null, queryStringParameters = null) => ({
  httpMethod: method,
  path,
  body: body ? JSON.stringify(body) : null,
  pathParameters,
  queryStringParameters,
  requestContext: {
    authorizer: {
      jwt: {
        claims: {
          'cognito:groups': ['admin']
        }
      }
    }
  }
});

const userEvent = (method, path, body = null, pathParameters = null, queryStringParameters = null) => ({
  httpMethod: method,
  path,
  body: body ? JSON.stringify(body) : null,
  pathParameters,
  queryStringParameters,
  requestContext: {}
});

test('OPTIONS request for CORS', async (t) => {
  const event = { httpMethod: 'OPTIONS', path: '/products' };
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /products should return 200 and a list of products', async (t) => {
  mock.method(docClient, 'send', async () => {
    return { Items: [{ productId: '1', name: 'Product A' }, { productId: '2', name: 'Product B' }] };
  });

  const event = userEvent('GET', '/products');
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.deepStrictEqual(body.data.length, 2);
});

test('GET /products with category filter', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    assert.strictEqual(command.input.IndexName, 'CategoryIndex');
    return { Items: [{ productId: '3', category: 'Electronics' }] };
  });

  const event = userEvent('GET', '/products', null, null, { category: 'Electronics' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.data[0].category, 'Electronics');
});

test('GET /products/:id should return 200 if found', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    assert.strictEqual(command.input.Key.productId, '123');
    return { Item: { productId: '123', name: 'Product 123' } };
  });

  const event = userEvent('GET', '/products/123', null, { id: '123' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.data.productId, '123');
});

test('GET /products/:id should return 404 if not found', async (t) => {
  mock.method(docClient, 'send', async () => {
    return {}; // No Item
  });

  const event = userEvent('GET', '/products/999', null, { id: '999' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 404);
});

test('POST /products should return 403 without admin access', async (t) => {
  const event = userEvent('POST', '/products', { name: 'P1', price: 10 });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 403);
});

test('POST /products should return 400 with missing fields', async (t) => {
  const event = adminEvent('POST', '/products', { name: 'P1' }); // missing price
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /products should return 201 on success (admin)', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  let eventPublished = false;
  mock.method(SNSClient.prototype, 'send', async (command) => {
    const msg = JSON.parse(command.input.Message);
    assert.strictEqual(msg.eventType, 'ProductCreated');
    eventPublished = true;
    return { MessageId: 'mocked' };
  });

  const event = adminEvent('POST', '/products', { name: 'P1', price: 10 });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 201);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.data.name, 'P1');
  assert.strictEqual(eventPublished, true);
});

test('PUT /products/:id should return 403 without admin access', async (t) => {
  const event = userEvent('PUT', '/products/123', { price: 20 }, { id: '123' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 403);
});

test('PUT /products/:id should return 400 with no updates', async (t) => {
  const event = adminEvent('PUT', '/products/123', { unknownField: 20 }, { id: '123' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /products/:id should return 404 if product not found', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return {};
  });

  const event = adminEvent('PUT', '/products/123', { price: 20 }, { id: '123' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 404);
});

test('PUT /products/:id should return 200 on success (admin)', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') {
      return { Item: { productId: '123', name: 'Old', price: 10 } };
    }
    return {};
  });
  
  let eventPublished = false;
  mock.method(SNSClient.prototype, 'send', async (command) => {
    const msg = JSON.parse(command.input.Message);
    assert.strictEqual(msg.eventType, 'ProductUpdated');
    assert.strictEqual(msg.payload.price, 20);
    eventPublished = true;
    return { MessageId: 'mocked' };
  });

  const event = adminEvent('PUT', '/products/123', { price: 20 }, { id: '123' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(eventPublished, true);
});

test('DELETE /products/:id should return 403 without admin access', async (t) => {
  const event = userEvent('DELETE', '/products/123', null, { id: '123' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 403);
});

test('DELETE /products/:id should return 200 on success (admin)', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  let eventPublished = false;
  mock.method(SNSClient.prototype, 'send', async (command) => {
    const msg = JSON.parse(command.input.Message);
    assert.strictEqual(msg.eventType, 'ProductDeleted');
    assert.strictEqual(msg.payload.productId, '123');
    eventPublished = true;
    return { MessageId: 'mocked' };
  });

  const event = adminEvent('DELETE', '/products/123', null, { id: '123' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(eventPublished, true);
});

test('Invalid route should return 404', async (t) => {
  const event = userEvent('GET', '/unknown');
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 404);
});

test('Empty event should return 400', async (t) => {
  const res = await handler(null, {});
  assert.strictEqual(res.statusCode, 400);
});

test('Unhandled error should return 500', async (t) => {
  mock.method(docClient, 'send', async () => {
    throw new Error('DynamoDB Error');
  });

  const event = userEvent('GET', '/products');
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 500);
});
