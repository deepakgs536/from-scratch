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

test('should publish UserRegistered to SNS if topic ARN is defined', async (t) => {
  process.env.USER_EVENTS_TOPIC_ARN = 'arn:aws:sns:REGION:ACCOUNT:Topic';
  const event = {
    triggerSource: 'PostConfirmation_ConfirmSignUp',
    userPoolId: 'pool1',
    userName: 'user2',
    request: {
      userAttributes: { email: 'sns@example.com', name: 'SNS User' }
    }
  };
  const res = await handler(event);
  assert.deepStrictEqual(res, event);
  delete process.env.USER_EVENTS_TOPIC_ARN;
});

test('should handle Cognito error gracefully', async (t) => {
  mock.method(CognitoIdentityProviderClient.prototype, 'send', async () => { throw new Error('Cognito Error'); });
  const event = {
    triggerSource: 'PostConfirmation_ConfirmSignUp',
    userPoolId: 'pool1',
    userName: 'user3',
    request: {}
  };
  const res = await handler(event);
  assert.deepStrictEqual(res, event);
});

test('should handle global error gracefully', async (t) => {
  const event = {
    get triggerSource() { throw new Error('Global Error'); }
  };
  const res = await handler(event);
  assert.deepStrictEqual(res, event);
});

