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

const userEvent = (method, path, body = null, pathParameters = null, queryStringParameters = null) => ({
  httpMethod: method,
  path,
  body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
  pathParameters,
  queryStringParameters,
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

test('POST /payments/initiate invalid JSON', async (t) => {
  const res = await handler(userEvent('POST', '/payments/initiate', 'invalid'), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /payments/initiate missing fields', async (t) => {
  const res = await handler(userEvent('POST', '/payments/initiate', {}), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /payments/initiate success', async (t) => {
  const res = await handler(userEvent('POST', '/payments/initiate', {
    orderId: 'o1', userId: 'u1', amount: 100, currency: 'USD'
  }), {});
  assert.strictEqual(res.statusCode, 201);
});

test('POST /payments/webhook invalid json', async (t) => {
  const res = await handler(userEvent('POST', '/payments/webhook', 'invalid'), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /payments/webhook invalid payload', async (t) => {
  const res = await handler(userEvent('POST', '/payments/webhook', { status: 'INVALID' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /payments/webhook payment not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('POST', '/payments/webhook', { paymentId: 'p1', status: 'SUCCESS' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('POST /payments/webhook already processed', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { paymentId: 'p1', status: 'SUCCESS' } }));
  const res = await handler(userEvent('POST', '/payments/webhook', { paymentId: 'p1', status: 'SUCCESS' }), {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).message, 'Webhook already processed for this status');
});

test('POST /payments/webhook ConditionalCheckFailedException', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { paymentId: 'p1', status: 'PENDING' } };
    const err = new Error('Condition Failed');
    err.name = 'ConditionalCheckFailedException';
    throw err;
  });
  const res = await handler(userEvent('POST', '/payments/webhook', { paymentId: 'p1', status: 'SUCCESS' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('POST /payments/webhook success (SUCCESS)', async (t) => {
  process.env.PAYMENT_EVENTS_TOPIC_ARN = 'arn:aws:sns:test';
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { paymentId: 'p1', status: 'PENDING' } };
    if (command.constructor.name === 'UpdateCommand') return { Attributes: { paymentId: 'p1', status: 'SUCCESS' } };
    return {};
  });
  const res = await handler(userEvent('POST', '/payments/webhook', { paymentId: 'p1', status: 'SUCCESS' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('POST /payments/webhook success (FAILED)', async (t) => {
  process.env.PAYMENT_EVENTS_TOPIC_ARN = 'arn:aws:sns:test';
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { paymentId: 'p1', status: 'PENDING' } };
    if (command.constructor.name === 'UpdateCommand') return { Attributes: { paymentId: 'p1', status: 'FAILED' } };
    return {};
  });
  const res = await handler(userEvent('POST', '/payments/webhook', { paymentId: 'p1', status: 'FAILED' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('POST /payments/webhook success (REFUNDED)', async (t) => {
  process.env.PAYMENT_EVENTS_TOPIC_ARN = 'arn:aws:sns:test';
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { paymentId: 'p1', status: 'PENDING' } };
    if (command.constructor.name === 'UpdateCommand') return { Attributes: { paymentId: 'p1', status: 'REFUNDED' } };
    return {};
  });
  const res = await handler(userEvent('POST', '/payments/webhook', { paymentId: 'p1', status: 'REFUNDED' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /payments should return 200', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ paymentId: 'p1' }] }));
  const res = await handler(userEvent('GET', '/payments'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /payments with valid lastKey', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ paymentId: 'p1' }], LastEvaluatedKey: { paymentId: 'p1' } }));
  const res = await handler(userEvent('GET', '/payments', null, null, { lastKey: Buffer.from(JSON.stringify({ paymentId: 'last' })).toString('base64') }), {});
  assert.strictEqual(res.statusCode, 200);
  assert.ok(JSON.parse(res.body).nextKey);
});

test('GET /payments with invalid lastKey', async (t) => {
  const res = await handler(userEvent('GET', '/payments', null, null, { lastKey: 'invalid-base64' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('GET /payments/:paymentId missing id', async (t) => {
  const res = await handler(userEvent('GET', '/payments/'), {});
  assert.strictEqual(res.statusCode, 400);
});

test('GET /payments/:paymentId should return 200 if found', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { paymentId: 'p1' } }));
  const res = await handler(userEvent('GET', '/payments/p1', null, { paymentId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /payments/:paymentId should return 404 if not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('GET', '/payments/p1', null, { paymentId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('GET /payments/order/:orderId missing id', async (t) => {
  const res = await handler(userEvent('GET', '/payments/order/'), {});
  assert.strictEqual(res.statusCode, 400);
});

test('GET /payments/order/:orderId should return 200 if found', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ paymentId: 'p1' }] }));
  const res = await handler(userEvent('GET', '/payments/order/o1', null, { orderId: 'o1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('GET /payments/order/:orderId should return 404 if not found', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [] }));
  const res = await handler(userEvent('GET', '/payments/order/o1', null, { orderId: 'o1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('PUT /payments/:paymentId missing id', async (t) => {
  const res = await handler(userEvent('PUT', '/payments/', {}), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /payments/:paymentId invalid JSON', async (t) => {
  const res = await handler(userEvent('PUT', '/payments/p1', 'invalid', { paymentId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /payments/:paymentId not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('PUT', '/payments/p1', { status: 'PAID' }, { paymentId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('PUT /payments/:paymentId should return 400 if payment not PENDING', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { paymentId: 'p1', status: 'SUCCESS' } }));
  const res = await handler(userEvent('PUT', '/payments/p1', {}, { paymentId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /payments/:paymentId should return 200 on success (PAID)', async (t) => {
  process.env.PAYMENT_EVENTS_TOPIC_ARN = 'arn:aws:sns:test';
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { paymentId: 'p1', status: 'PENDING' } };
    return {};
  });
  const res = await handler(userEvent('PUT', '/payments/p1', { status: 'PAID' }, { paymentId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('PUT /payments/:paymentId should return 200 on success (FAILED)', async (t) => {
  process.env.PAYMENT_EVENTS_TOPIC_ARN = 'arn:aws:sns:test';
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { paymentId: 'p1', status: 'PENDING' } };
    return {};
  });
  const res = await handler(userEvent('PUT', '/payments/p1', { status: 'FAILED' }, { paymentId: 'p1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

const createSqsEvent = (eventType, payload) => ({
  Records: [{
    eventSource: 'aws:sqs',
    body: JSON.stringify({ Message: JSON.stringify({ eventType, payload }) })
  }]
});

test('SQS OrderCreated success', async (t) => {
  const event = createSqsEvent('OrderCreated', { orderId: 'o-1-2-3', userId: 'u1', total_amount: 100 });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCreated idempotency', async (t) => {
  mock.method(docClient, 'send', async () => {
    const err = new Error('Condition Failed');
    err.name = 'ConditionalCheckFailedException';
    throw err;
  });
  const event = createSqsEvent('OrderCreated', { orderId: 'o-1-2-3', userId: 'u1', total_amount: 100 });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCreated DB error', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DB Error'); });
  const event = createSqsEvent('OrderCreated', { orderId: 'o-1-2-3', userId: 'u1', total_amount: 100 });
  await assert.rejects(async () => await handler(event, {}));
});

test('SQS OrderCreated missing fields', async (t) => {
  const event = createSqsEvent('OrderCreated', {});
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCancelled success', async (t) => {
  process.env.PAYMENT_EVENTS_TOPIC_ARN = 'arn:aws:sns:test';
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { paymentId: 'p1', status: 'PENDING' } };
    if (command.constructor.name === 'UpdateCommand') return { Attributes: { paymentId: 'p1', status: 'CANCELLED' } };
    return {};
  });
  const event = createSqsEvent('OrderCancelled', { orderId: 'o-1-2-3' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCancelled missing orderId', async (t) => {
  const event = createSqsEvent('OrderCancelled', {});
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCancelled payment not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const event = createSqsEvent('OrderCancelled', { orderId: 'o-1-2-3' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('SQS OrderCancelled payment already SUCCESS', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { paymentId: 'p1', status: 'SUCCESS' } }));
  const event = createSqsEvent('OrderCancelled', { orderId: 'o-1-2-3' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

import { publishEvent } from '../src/sns.js';

test('publishEvent success', async (t) => {
  const res = await publishEvent('arn:test', 'TestEvent', { data: 1 });
  assert.strictEqual(res, undefined); // Returns nothing on success
});

test('publishEvent failure', async (t) => {
  mock.method(SNSClient.prototype, 'send', async () => { throw new Error('SNS Error'); });
  await assert.rejects(async () => await publishEvent('arn:test', 'TestEvent', { data: 1 }));
});

test('parseBody should return 400 on invalid JSON', async (t) => {
  const event = userEvent('POST', '/payments/initiate');
  event.body = "{ invalid json }";
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(JSON.parse(res.body).error, 'Invalid JSON body');
});

test('getPaymentId should fallback to match path', async (t) => {
  const event = userEvent('GET', '/payments/p777', null, { paymentId: null });
  mock.method(docClient, 'send', async () => ({ Item: { paymentId: 'p777' } }));
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('Unhandled error should return 500', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DynamoDB Error'); });
  const event = userEvent('GET', '/payments/p1');
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 500);
});
