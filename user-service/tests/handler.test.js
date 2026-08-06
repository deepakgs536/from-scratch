import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../handler.js';
import { docClient } from '../src/dynamodb.js';

beforeEach(() => {
  mock.method(docClient, 'send', async () => ({}));
});

afterEach(() => {
  mock.reset();
}); 

const userEvent = (method, path, body = null, pathParameters = null, groups = null) => {
  const event = {
    httpMethod: method,
    path,
    body: body ? JSON.stringify(body) : null,
    pathParameters,
    requestContext: {}
  };
  if (groups) {
    event.requestContext.authorizer = { jwt: { claims: { 'cognito:groups': groups } } };
  }
  return event;
};

test('OPTIONS request for CORS', async (t) => {
  const res = await handler(userEvent('OPTIONS', '/users'), {});
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

test('GET /users should return 403 if not admin', async (t) => {
  const res = await handler(userEvent('GET', '/users'), {});
  assert.strictEqual(res.statusCode, 403);
});

test('GET /users should return 200 if admin', async (t) => {
  mock.method(docClient, 'send', async () => ({ Items: [{ userId: 'u1' }] }));
  const res = await handler(userEvent('GET', '/users', null, null, ['admin']), {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).data.length, 1);
});

test('GET /users/:id should auto-create and return 200 if not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('GET', '/users/u1', null, { id: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).data.userId, 'u1');
});

test('GET /users/:id should return 200 if found', async (t) => {
  mock.method(docClient, 'send', async () => ({ Item: { userId: 'u1' } }));
  const res = await handler(userEvent('GET', '/users/u1', null, { id: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('PUT /users/:id should return 400 on invalid body', async (t) => {
  const res = await handler(userEvent('PUT', '/users/u1', 'invalid', { id: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /users/:id should return 400 if no fields to update', async (t) => {
  const res = await handler(userEvent('PUT', '/users/u1', { unknown: 1 }, { id: 'u1' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('PUT /users/:id should return 404 if user not found', async (t) => {
  mock.method(docClient, 'send', async () => ({}));
  const res = await handler(userEvent('PUT', '/users/u1', { name: 'New Name' }, { id: 'u1' }), {});
  assert.strictEqual(res.statusCode, 404);
});

test('PUT /users/:id should return 200 on success', async (t) => {
  mock.method(docClient, 'send', async (command) => {
    if (command.constructor.name === 'GetCommand') return { Item: { userId: 'u1', name: 'Old' } };
    return {};
  });
  const res = await handler(userEvent('PUT', '/users/u1', { name: 'New Name' }, { id: 'u1' }), {});
  assert.strictEqual(res.statusCode, 200);
});

const createSqsEvent = (eventType, payload) => ({
  Records: [{
    eventSource: 'aws:sqs',
    body: JSON.stringify({ Message: JSON.stringify({ eventType, payload }) })
  }]
});

test('SQS UserRegistered success', async (t) => {
  const event = createSqsEvent('UserRegistered', { userId: 'u1', email: 'test@example.com', name: 'Test' });
  const res = await handler(event, {});
  assert.strictEqual(res.success, true);
});

test('Authorization header parsing with replaceAll', async (t) => {
  const event = {
    httpMethod: 'GET',
    path: '/users/u1',
    pathParameters: { id: 'u1' },
    headers: {
      authorization: 'Bearer header.eyJzdWIiOiAibXktc3ViXzEyMyJ9.signature'
    }
  };
  mock.method(docClient, 'send', async () => ({ Item: { userId: 'u1' } }));
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('parseBody should return 400 on invalid JSON', async (t) => {
  const event = userEvent('PUT', '/users/u1', null, { id: 'u1' });
  event.body = "{ invalid json }";
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(JSON.parse(res.body).error, 'Invalid JSON body');
});

test('isAdmin should support stringified cognito:groups for REST APIs', async (t) => {
  const event = userEvent('GET', '/users');
  event.requestContext.authorizer = { claims: { 'cognito:groups': '[admin]' } };
  mock.method(docClient, 'send', async () => ({ Items: [] }));
  
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('getUserId should fallback to match path', async (t) => {
  const event = userEvent('GET', '/users/777');
  event.pathParameters = null; 
  mock.method(docClient, 'send', async () => ({ Item: { userId: '777' } }));
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 200);
});

test('Unhandled error should return 500', async (t) => {
  mock.method(docClient, 'send', async () => { throw new Error('DynamoDB Error'); });
  const event = userEvent('GET', '/users/u1', null, { id: 'u1' });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 500);
});
