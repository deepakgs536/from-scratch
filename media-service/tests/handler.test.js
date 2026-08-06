import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.MEDIA_BUCKET = 'test-bucket';

import { S3Client } from '@aws-sdk/client-s3';
 
let handler;
beforeEach(async () => {
  if (!handler) {
    const mod = await import('../handler.js');
    handler = mod.handler;
  }
  mock.method(S3Client.prototype, 'send', async () => ({}));
});

afterEach(() => {
  mock.reset();
});

const userEvent = (method, path, body = null, queryStringParameters = null) => ({
  requestContext: { http: { method } },
  rawPath: path,
  body: body ? JSON.stringify(body) : null,
  queryStringParameters
});

test('OPTIONS request for CORS', async (t) => {
  const res = await handler(userEvent('OPTIONS', '/media'), {});
  assert.strictEqual(res.statusCode, 204);
});

test('GET /media/health should return 200', async (t) => {
  const res = await handler(userEvent('GET', '/media/health'), {});
  assert.strictEqual(res.statusCode, 200);
});

test('POST /media/upload-url should return 400 on missing body', async (t) => {
  const res = await handler(userEvent('POST', '/media/upload-url'), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /media/upload-url should return 400 on missing folder', async (t) => {
  const res = await handler(userEvent('POST', '/media/upload-url', { fileName: 'test.jpg', contentType: 'image/jpeg' }), {});
  assert.strictEqual(res.statusCode, 400);
});

test('POST /media/upload-url should return 200 on success', async (t) => {
  const res = await handler(userEvent('POST', '/media/upload-url', { folder: 'products', fileName: 'test.jpg', contentType: 'image/jpeg' }), {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).success, true);
  assert.ok(JSON.parse(res.body).uploadUrl);
});

test('GET /media/download-url should return 400 on missing key', async (t) => {
  const res = await handler(userEvent('GET', '/media/download-url'), {});
  assert.strictEqual(res.statusCode, 400);
});

test('GET /media/download-url should return 200 on success', async (t) => {
  const res = await handler(userEvent('GET', '/media/download-url', null, { key: 'products/test.jpg' }), {});
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).success, true);
  assert.ok(JSON.parse(res.body).url);
});

test('DELETE /media should return 400 on missing key', async (t) => {
  const res = await handler(userEvent('DELETE', '/media', {}), {});
  assert.strictEqual(res.statusCode, 400);
});

test('DELETE /media should return 200 on success', async (t) => {
  const res = await handler(userEvent('DELETE', '/media', { key: 'products/test.jpg' }), {});
  assert.strictEqual(res.statusCode, 200);
});

test('Unknown route should return 404', async (t) => {
  const res = await handler(userEvent('GET', '/unknown'), {});
  assert.strictEqual(res.statusCode, 404);
});

test('parseBody should return 400 on invalid JSON', async (t) => {
  const event = userEvent('DELETE', '/media', null);
  event.body = "{ invalid json }";
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(JSON.parse(res.body).message, 'Invalid JSON body'); // note message instead of error in media service
});

test('Unhandled error should return 500', async (t) => {
  const event = userEvent('DELETE', '/media', { key: 'products/test.jpg' });
  // force an error by breaking the mock or simulating an exception if possible
  // since S3Client isn't throwing here easily without remocking, we can just pass a corrupted event that throws
  // but wait, S3Client is mocked, let's mock it to throw
  mock.method(S3Client.prototype, 'send', async () => { throw new Error('S3 Error'); });
  const res = await handler(event, {});
  assert.strictEqual(res.statusCode, 500);
});
