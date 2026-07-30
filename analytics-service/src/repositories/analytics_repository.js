import { GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/aws.js";

const TABLE_NAME = process.env.ANALYTICS_TABLE || "AnalyticsTable";

export const getItem = async (pk, sk) => {
  const { Item } = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk }
  }));
  return Item;
};

export const putItem = async (item) => {
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));
};

export const updateItem = async (pk, sk, updateExpression, expressionAttributeValues, expressionAttributeNames = undefined) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "UPDATED_NEW"
  };
  if (expressionAttributeNames) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }
  const { Attributes } = await docClient.send(new UpdateCommand(params));
  return Attributes;
};

export const incrementCounter = async (pk, sk, counters) => {
  const keys = Object.keys(counters);
  if (keys.length === 0) return;

  const updateParts = [];
  const expressionAttributeValues = { ":zero": 0 };
  const expressionAttributeNames = {};

  keys.forEach((key, index) => {
    updateParts.push(`#k${index} = if_not_exists(#k${index}, :zero) + :val${index}`);
    expressionAttributeValues[`:val${index}`] = counters[key];
    expressionAttributeNames[`#k${index}`] = key;
  });

  const updateExpression = "SET " + updateParts.join(", ");

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames
  }));
};

export const query = async (pk, skPrefix) => {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: {
      ":pk": pk
    }
  };

  if (skPrefix) {
    params.KeyConditionExpression += " AND begins_with(SK, :sk)";
    params.ExpressionAttributeValues[":sk"] = skPrefix;
  }

  const { Items } = await docClient.send(new QueryCommand(params));
  return Items || [];
};

export const scan = async () => {
  const { Items } = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME
  }));
  return Items || [];
};
