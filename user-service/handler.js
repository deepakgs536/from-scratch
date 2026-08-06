import { PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from './src/dynamodb.js';
import { logger } from './src/logger.js';

const TABLE_NAME = process.env.USERS_TABLE || 'UsersTable';

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: { 
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  },
  body: JSON.stringify(body)
});

const parseBody = (event) => {
  if (!event.body) return {};
  if (typeof event.body === 'object') return event.body;
  try {
    return JSON.parse(event.body);
  } catch (err) {
    throw new Error('Invalid JSON body');
  }
};

const getUserId = (event, path) => {
  if (event.pathParameters && event.pathParameters.id) return event.pathParameters.id;
  if (event.pathParameters && event.pathParameters.userId) return event.pathParameters.userId;
  const match = path.match(/\/users\/([^\/]+)/);
  return match ? match[1] : null;
};

const isAdmin = (event) => {
  // Allow internal service-to-service calls
  const internalKey = event.headers?.['x-internal-key'] || event.headers?.['X-Internal-Key'];
  if (internalKey && internalKey === process.env.INTERNAL_API_KEY) return true;

  const groupsData = 
    event.requestContext?.authorizer?.jwt?.claims?.['cognito:groups'] || 
    event.requestContext?.authorizer?.claims?.['cognito:groups'];
    
  if (!groupsData) return false;

  if (Array.isArray(groupsData)) {
    return groupsData.includes('admin');
  }
    
  if (typeof groupsData === 'string') {
    return groupsData.includes('admin');
  }

  return false;
};

const handleGetUsers = async (event) => {
  if (!isAdmin(event)) return createResponse(403, { error: 'Forbidden: Admin access required to list all users' });
  const { Items } = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
  return createResponse(200, { success: true, data: Items });
};

const handleGetUser = async (event, path) => {
  const id = getUserId(event, path);
  try {
    const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId: id } }));
    if (!result.Item) {
      let claims = event.requestContext?.authorizer?.jwt?.claims || event.requestContext?.authorizer?.claims || {};
      if (Object.keys(claims).length === 0) {
        const authHeader = event.headers?.authorization || event.headers?.Authorization;
        if (authHeader) {
          try {
            const token = authHeader.replace(/^Bearer /i, '');
            const payloadBase64Url = token.split('.')[1];
            if (payloadBase64Url) {
              const payloadBase64 = payloadBase64Url.replaceAll('-', '+').replaceAll('_', '/');
              claims = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
            }
          } catch (e) { console.error("Failed to decode JWT from header:", e); }
        }
      }

      const email = claims.email || claims['cognito:email'] || '';
      const name = claims.name || claims['cognito:username'] || claims.preferred_username || claims.given_name || email.split('@')[0] || 'Unknown';
      
      let role = 'customer';
      const groupsData = claims['cognito:groups'];
      if (groupsData) {
        if (Array.isArray(groupsData) && groupsData.includes('admin')) role = 'admin';
        else if (typeof groupsData === 'string' && groupsData.includes('admin')) role = 'admin';
      }

      const newUser = {
        userId: id, name, email, role,
        profile_image_url: null, profile_background_url: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      };

      try {
        await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: newUser }));
        return createResponse(200, { success: true, data: newUser });
      } catch (putErr) {
        return createResponse(404, { error: "User not found" });
      }
    }
    return createResponse(200, { success: true, data: result.Item });
  } catch (err) {
    return createResponse(500, { error: err.message });
  }
};

const handleUpdateUser = async (event, path) => {
  let body;
  try { body = parseBody(event); } catch (err) { return createResponse(400, { success: false, error: err.message }); }

  const userId = getUserId(event, path);
  if (!userId) return createResponse(400, { success: false, error: "User ID missing from path" });

  const updatableFields = ["name", "profile_image_url", "profile_background_url"];
  const hasUpdates = updatableFields.some((field) => body[field] !== undefined);
  if (!hasUpdates) return createResponse(400, { success: false, error: "No fields provided to update" });

  const { Item: existingUser } = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { userId } }));
  if (!existingUser) return createResponse(404, { success: false, error: "User not found" });

  const updatedUser = {
    ...existingUser,
    name: body.name ?? existingUser.name,
    profile_image_url: body.profile_image_url ?? existingUser.profile_image_url,
    profile_background_url: body.profile_background_url ?? existingUser.profile_background_url,
    updated_at: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: updatedUser }));
  return createResponse(200, { success: true, message: "Profile updated successfully", data: updatedUser });
};

const handleApiGatewayEvent = async (event) => {
  const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || event.rawPath || '';
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

  if (method === 'OPTIONS') return createResponse(200, { success: true });
  if (path.endsWith('/users') && method === 'GET') return await handleGetUsers(event);
  if (path.includes('/users/') && method === 'GET') return await handleGetUser(event, path);
  if (path.includes("/users/") && method === "PUT") return await handleUpdateUser(event, path);

  return createResponse(404, { error: 'Not Found' });
};

const handleSqsEvent = async (event) => {
  for (const record of event.Records) {
    let sqsMessage;
    try {
      sqsMessage = typeof record.body === 'string' ? JSON.parse(record.body) : record.body;
    } catch (e) {
      logger.error('Failed to parse SQS record body', { error: e.message, body: record.body });
      continue;
    }
    
    const payloadWrapper = (sqsMessage.Message && typeof sqsMessage.Message === 'string') 
      ? JSON.parse(sqsMessage.Message) : sqsMessage;
    
    const { eventType, payload } = payloadWrapper;
    
    if (eventType === 'UserRegistered') {
      const { userId, name, email, role } = payload;
      
      if (!userId || !email) {
        logger.error('Invalid UserRegistered payload missing required fields', { payload });
        continue;
      }
      
      logger.info(`Processing UserRegistered for userId: ${userId}`);
      
      const user = {
        userId,
        name: name || 'Unknown',
        email,
        role,
        profile_image_url: null,
        profile_background_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      try {
        await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: user }));
        logger.info(`Successfully created user profile in DynamoDB for userId: ${userId}`);

        const verify = await docClient.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: {
              userId
            }
          })
        );
        
        console.log("Verification:", JSON.stringify(verify, null, 2));
        
      } catch (err) {
        logger.error(`Failed to save user ${userId} to DynamoDB`, { error: err.message });
        throw err; // Allow SQS to retry
      }
    }
  }
};

export const handler = async (event, context) => {
  logger.info("Received event", { event });

  try {
    if (!event) return createResponse(400, { error: 'Empty event' });

    // Route based on Event Source
    if (event.Records && event.Records.length > 0 && event.Records[0].eventSource === 'aws:sqs') {
      await handleSqsEvent(event);
      return { success: true };
    } else {
      return await handleApiGatewayEvent(event);
    }
  } catch (error) {
    logger.error('Lambda Error', { error: error.message, stack: error.stack });
    return createResponse(500, { error: 'Internal Server Error' });
  }
};
 