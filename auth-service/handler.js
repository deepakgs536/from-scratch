import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const cognitoClient = new CognitoIdentityProviderClient({});
const snsClient = new SNSClient({ region: process.env.AWS_REGION || "ap-southeast-1" });
export const handler = async (event) => {
  try {
    console.log("Post Confirmation Triggered:", JSON.stringify(event));
    // We only want to assign the group if they just signed up / confirmed
    if (event.triggerSource === "PostConfirmation_ConfirmSignUp") {
      
      const userAttributes = event.request?.userAttributes || {};
      const requestedRole = userAttributes['custom:role'] || "customer";
      const groupName = requestedRole === "admin" ? "admin" : "customer";
      
      const params = {
        GroupName: groupName,
        UserPoolId: event.userPoolId,
        Username: event.userName,
      };
      
      try {
        const command = new AdminAddUserToGroupCommand(params);
        await cognitoClient.send(command);
        console.log(`Successfully added user ${event.userName} to group ${groupName}`);
        
        // Publish the UserRegistered event to SNS for the user-service to consume
        const SNS_TOPIC_ARN = process.env.USER_EVENTS_TOPIC_ARN;
        if (SNS_TOPIC_ARN) {
          const email = userAttributes.email;
          const name = userAttributes.name || "Unknown";
          
          const messageBody = JSON.stringify({
            eventType: "UserRegistered",
            payload: {
              userId: event.userName,
              email: email,
              name: name,
              role: groupName 
            }
          });
          
          await snsClient.send(new PublishCommand({
            TopicArn: SNS_TOPIC_ARN,
            Message: messageBody
          }));
          console.log(`Published UserRegistered event for ${event.userName}`);
        } else {
          console.warn("USER_EVENTS_TOPIC_ARN is not defined. Skipping SNS publish.");
        }
        
      } catch (err) {
        console.error("Error executing Cognito or SNS commands:", err);
      }
    }
  } catch (globalError) {
    console.error("Critical error in PostConfirmation trigger:", globalError);
  }
  
  // MUST always return the event back to Cognito, no matter what happens!
  return event;
};
 