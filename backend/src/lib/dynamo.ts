import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION ?? 'us-east-1';
const endpoint = process.env.DYNAMODB_ENDPOINT ?? process.env.AWS_ENDPOINT_URL;

export const ddbClient = new DynamoDBClient({
  region,
  ...(endpoint ? { endpoint } : {}),
  credentials:
    process.env.AWS_ACCESS_KEY_ID !== undefined
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
          ...(process.env.AWS_SESSION_TOKEN !== undefined
            ? { sessionToken: process.env.AWS_SESSION_TOKEN }
            : {}),
        }
      : undefined,
});

export const docClient = DynamoDBDocumentClient.from(ddbClient);

export const s3Client = new S3Client({
  region,
  ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  credentials:
    process.env.AWS_ACCESS_KEY_ID !== undefined
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
          ...(process.env.AWS_SESSION_TOKEN !== undefined
            ? { sessionToken: process.env.AWS_SESSION_TOKEN }
            : {}),
        }
      : undefined,
});

export const TABLE_NAME = process.env.TABLE_NAME ?? 'sustain-the-globe-dev';
