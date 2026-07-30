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

const userEvent = (method, path, body = null, pathParameters = null) => ({
  httpMethod: method,
  path,
  body: body ? JSON.stringify(body) : null,
  pathParameters,
  requestContext: {}
});

test('OPTIONS request for CORS', async (t) => {
  const res = await handler(userEvent('OPTIONS', '/payments'), {});
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

test('POST /payments/initiate should return 400 on missing fields', async (t) => {
  const res = await handler(userEvent('POST', '/payments/initiate', {}), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /payments/initiate should return 201 on success', async (t) => {
  const res = await handler(userEvent('POST', '/payments/initiate', {
    orderId: 'o1', userId: 'u1', amount: 100, currency: 'USD'
  }), {});
  assert.strictEqual(res.statusCode, 201);
});

test('POST /payments/webhook should return 400 on invalid payload', async (t) => {
  const res = await handler(userEvent('POST', '/payments/webhook', { status: 'INVALID' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /payments/webhook should return 200 on success (SUCCESS)', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { paymentId: 'p1', status: 'PENDING' } };
    if (command.constructor.name === 'UpdateCommand') return { Attributes: { paymentId: 'p1', status: 'SUCCESS' } };
    return {};
  });
  const res = await handler(userEvent('POST', '/payments/webhook', { paymentId: 'p1', status: 'SUCCESS' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /payments should return 200', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ paymentId: 'p1' }] }));
  const res = await handler(userEvent('GET', '/payments'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /payments/:paymentId should return 200 if found', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { paymentId: 'p1' } }));
  const res = await handler(userEvent('GET', '/payments/p1', null, { paymentId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /payments/order/:orderId should return 200 if found', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ paymentId: 'p1' }] }));
  const res = await handler(userEvent('GET', '/payments/order/o1', null, { orderId: 'o1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('PUT /payments/:paymentId should return 400 if payment not PENDING', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { paymentId: 'p1', status: 'SUCCESS' } }));
  const res = await handler(userEvent('PUT', '/payments/p1', {}, { paymentId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /payments/:paymentId should return 200 on success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { paymentId: 'p1', status: 'PENDING' } };
    return {};
  });
  const res = await handler(userEvent('PUT', '/payments/p1', { status: 'PAID' }, { paymentId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

const createSqsEvent = (eventType, payload) => ({
  Records: [{
    eventSource: 'aws:sqs',
    body: JSON.stringify({ Message: JSON.stringify({ eventType, payload }) })
  }]
});

test('SQS OrderCreated success', async (t) => {
  const event = createSqsEvent('OrderCreated', { orderId: 'o1', userId: 'u1', total_amount: 100 });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCancelled success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { paymentId: 'p1', status: 'PENDING' } };
    if (command.constructor.name === 'UpdateCommand') return { Attributes: { paymentId: 'p1', status: 'CANCELLED' } };
    return {};
  });
  const event = createSqsEvent('OrderCancelled', { orderId: 'o1' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});
