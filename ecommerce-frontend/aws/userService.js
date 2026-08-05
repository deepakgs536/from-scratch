import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.USERS_TABLE || 'UsersTable';

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

const getUserIdFromAuth = (event) => {
  // Extract user ID (sub) from Cognito token via API Gateway Authorizer
  return event.requestContext?.authorizer?.jwt?.claims?.sub || 
         event.requestContext?.authorizer?.claims?.sub || 
         null;
};

export const handler = async (event) => {
  try {
    const path = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || event.rawPath || '';
    const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';

    // Handle Preflight CORS
    if (method === 'OPTIONS') {
      return createResponse(200, { success: true });
    }

    const authenticatedUserId = getUserIdFromAuth(event);
    if (!authenticatedUserId) {
      return createResponse(401, { error: 'Unauthorized: Missing valid token' });
    }

    // Extract target user ID from path (e.g. /users/12345)
    const match = path.match(/\/users\/([^\/]+)/);
    const targetUserId = match ? match[1] : null;

    if (!targetUserId) {
      return createResponse(400, { error: 'User ID missing from path' });
    }

    // RBAC: Users can only access/modify their own profiles
    // (An admin override could be added here later if needed)
    if (authenticatedUserId !== targetUserId) {
      return createResponse(403, { error: 'Forbidden: You can only access your own profile' });
    }

    // GET /users/:id
    if (method === 'GET') {
      const { Item } = await docClient.send(new GetCommand({ 
        TableName: USERS_TABLE, 
        Key: { userId: targetUserId } 
      }));
      
      if (!Item) return createResponse(404, { error: 'User not found' });
      return createResponse(200, { success: true, data: Item });
    }

    // PUT /users/:id
    if (method === 'PUT') {
      let body;
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        return createResponse(400, { error: 'Invalid JSON body' });
      }

      // Fetch existing user to perform a partial update
      const { Item: existingUser } = await docClient.send(new GetCommand({ 
        TableName: USERS_TABLE, 
        Key: { userId: targetUserId } 
      }));
      
      if (!existingUser) return createResponse(404, { error: 'User not found' });

      // Build updated user, ignoring restricted fields like email, role, or userId
      const updatedUser = {
        ...existingUser,
        name: body.name ?? existingUser.name,
        profile_image_url: body.profile_image_url ?? existingUser.profile_image_url,
        updated_at: new Date().toISOString(),
      };

      await docClient.send(new PutCommand({ 
        TableName: USERS_TABLE, 
        Item: updatedUser 
      }));
      
      return createResponse(200, { success: true, message: 'Profile updated successfully', data: updatedUser });
    }

    return createResponse(404, { error: 'Route Not Found' });

  } catch (error) {
    console.error('Lambda Error:', error);
    return createResponse(500, { error: 'Internal Server Error' });
  }
};
