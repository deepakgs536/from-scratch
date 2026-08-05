import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const cognitoClient = new CognitoIdentityProviderClient({});

// Initialize DynamoDB Client
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const USERS_TABLE = process.env.USERS_TABLE || 'UsersTable';

export const handler = async (event) => {
  console.log("Post Confirmation Triggered:", JSON.stringify(event));

  if (event.triggerSource === "PostConfirmation_ConfirmSignUp") {
    const requestedRole = event.request.userAttributes['custom:role'] || "customer";
    const groupName = requestedRole === "admin" ? "admin" : "customer";
    const email = event.request.userAttributes.email || "";
    const name = event.request.userAttributes.name || "User";
    const userId = event.request.userAttributes.sub; // Cognito User ID
    
    // 1. Add User to Cognito Group
    const cognitoParams = {
      GroupName: groupName,
      UserPoolId: event.userPoolId,
      Username: event.userName,
    };
    
    try {
      await cognitoClient.send(new AdminAddUserToGroupCommand(cognitoParams));
      console.log(`Successfully added user ${event.userName} to group ${groupName}`);
    } catch (err) {
      console.error("Error adding user to group:", err);
    }

    // 2. Add User to DynamoDB UsersTable
    try {
      await docClient.send(new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          userId: userId,
          email: email,
          name: name,
          role: groupName,
          profile_image_url: "", // Initialized empty for profile upload later
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }));
      console.log(`Successfully created user record in DynamoDB for ${userId}`);
    } catch (err) {
      console.error("Error creating user in DynamoDB:", err);
    }
  }

  return event;
};


