import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../app.js';
import { docClient } from '../src/config/aws.js';

beforeEach(() => {
  mock.method(docClient, 'send', async () => ({}));
});

afterEach(() => {
  mock.reset();
});

const userEvent = (method, path, body = null, queryStringParameters = null) => ({
  httpMethod: method,
  path,
  body: body ? JSON.stringify(body) : null,
  queryStringParameters,
  requestContext: {}
});

test('OPTIONS request for CORS', async (t) => {
  const res = await handler(userEvent('OPTIONS', '/analytics'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/health should return 200', async (t) => {
  const res = await handler(userEvent('GET', '/analytics/health'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/revenue should return 200', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ amount: 100 }] }));
  const res = await handler(userEvent('GET', '/analytics/revenue'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /analytics/products should return 200', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ productId: 'p1', count: 5 }] }));
  const res = await handler(userEvent('GET', '/analytics/products'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('Unknown route should return 404', async (t) => {
  const res = await handler(userEvent('GET', '/unknown'), {});
  assert.strictEqual(res.statusCode, 404);
});

const createSqsEvent = (eventType, payload) => ({
  Records: [{
    eventSource: 'aws:sqs',
    body: JSON.stringify({ Message: JSON.stringify({ eventType, payload }) })
  }]
});

test('SQS OrderCreated success', async (t) => {
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', total_amount: 100, items: [{ productId: 'p1', quantity: 2 }] });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('SQS PaymentSucceeded success', async (t) => {
  const event = createSqsEvent('PaymentSucceeded', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});
