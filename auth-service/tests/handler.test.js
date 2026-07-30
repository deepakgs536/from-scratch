import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../handler.js';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { SNSClient } from '@aws-sdk/client-sns';

beforeEach(() => {
  mock.method(CognitoIdentityProviderClient.prototype, 'send', async () => ({}));
  mock.method(SNSClient.prototype, 'send', async () => ({ MessageId: 'mocked' }));
});

afterEach(() => {
  mock.reset();
});

test('should ignore non-ConfirmSignUp events', async (t) => {
  const event = { triggerSource: 'PreSignUp_SignUp' };
  const res = await handler(event);
  assert.deepStrictEqual(res, event);
});

test('should process ConfirmSignUp for customer', async (t) => {
  const event = {
    triggerSource: 'PostConfirmation_ConfirmSignUp',
    userPoolId: 'pool1',
    userName: 'user1',
    request: {
      userAttributes: { email: 'customer@example.com' }
    }
  };
  const res = await handler(event);
  assert.deepStrictEqual(res, event);
});

test('should process ConfirmSignUp for admin', async (t) => {
  const event = {
    triggerSource: 'PostConfirmation_ConfirmSignUp',
    userPoolId: 'pool1',
    userName: 'user1',
    request: {
      userAttributes: { email: 'admin@example.com', 'custom:role': 'admin' }
    }
  };
  const res = await handler(event);
  assert.deepStrictEqual(res, event);
});
