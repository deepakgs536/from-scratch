import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../handler.js';
import { docClient } from '../src/dynamodb.js';
import { SNSClient } from '@aws-sdk/client-sns';

beforeEach(() => {
  mock.method(docClient, 'send', async () => ({}));
  mock.method(SNSClient.prototype, 'send', async () => ({ MessageId: 'mocked' }));
  global.fetch = mock.fn(async () => ({ ok: true }));
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
  const res = await handler(userEvent('OPTIONS', '/orders'), {});
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

test('POST /orders should return 400 on missing userId', async (t) => {
  const res = await handler(userEvent('POST', '/orders', {}), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /orders should return 400 on missing/invalid items', async (t) => {
  const res = await handler(userEvent('POST', '/orders', { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /orders should return 201 on success', async (t) => {
  const res = await handler(userEvent('POST', '/orders', {
    userId: 'u1',
    items: [{ productId: 'p1', quantity: 1, price_at_addition: 10 }]
  }), {});
  assert.strictEqual(res.statusCode, 201);
});

test('GET /orders should return 200', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ orderId: 'o1' }] }));
  const res = await handler(userEvent('GET', '/orders'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /orders/user/:userId should return 200', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ orderId: 'o1' }] }));
  const res = await handler(userEvent('GET', '/orders/user/u1', null, { userId: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /orders/:orderId should return 200 if found', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { orderId: 'o1' } }));
  const res = await handler(userEvent('GET', '/orders/o1', null, { orderId: 'o1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('PUT /orders/:orderId should return 400 if order is PAID', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { orderId: 'o1', status: 'PAID' } }));
  const res = await handler(userEvent('PUT', '/orders/o1', {}, { orderId: 'o1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /orders/:orderId should return 200 on success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { orderId: 'o1', status: 'PENDING' } };
    return {};
  });
  const res = await handler(userEvent('PUT', '/orders/o1', { contact_number: '123' }, { orderId: 'o1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('DELETE /orders/:orderId should return 400 if order is PAID', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { orderId: 'o1', status: 'PAID' } }));
  const res = await handler(userEvent('DELETE', '/orders/o1', null, { orderId: 'o1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('DELETE /orders/:orderId should return 200 on success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { orderId: 'o1', status: 'PENDING' } };
    return {};
  });
  const res = await handler(userEvent('DELETE', '/orders/o1', null, { orderId: 'o1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('PUT /orders/:orderId/status should return 200 on success', async (t) => {
  mock.method(docClient, 'send', async () => ({ Attributes: { orderId: 'o1', status: 'SHIPPED' } }));
  const res = await handler(userEvent('PUT', '/orders/o1/status', { status: 'SHIPPED' }, { orderId: 'o1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

const createSqsEvent = (eventType, payload) => ({
  Records: [{
    eventSource: 'aws:sqs',
    body: JSON.stringify({ Message: JSON.stringify({ eventType, payload }) })
  }]
});

test('SQS InventoryReserved success', async (t) => {
  const event = createSqsEvent('InventoryReserved', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS InventoryReservationFailed success', async (t) => {
  const event = createSqsEvent('InventoryReservationFailed', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS PaymentSucceeded success', async (t) => {
  const event = createSqsEvent('PaymentSucceeded', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS PaymentFailed success', async (t) => {
  const event = createSqsEvent('PaymentFailed', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('parseBody should return 400 on invalid JSON', async (t) => {
  const event = userEvent('POST', '/orders', null, { userId: 'u1' });
  event.body = "{ invalid json }";
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(JSON.parse(res.body).error, 'Invalid JSON body');
});

test('getOrderId should fallback to match path', async (t) => {
  const event = userEvent('GET', '/orders/u1/o777', null, { userId: 'u1' });
  event.pathParameters.orderId = null;
  mock.method(docClient, 'send', async () => ({ Item: { orderId: 'o777' } }));
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('Unhandled error should return 500', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DynamoDB Error'); });
  const event = userEvent('GET', '/orders/u1', null, { userId: 'u1' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 500);
});
