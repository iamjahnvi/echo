import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION ?? 'us-east-1';
const endpoint = process.env.DYNAMODB_ENDPOINT ?? process.env.AWS_ENDPOINT_URL;

/**
 * Shared AWS SDK client configuration.
 * Regression guard: Lambda temporary credentials REQUIRE the session token.
 * A previous deploy shipped a bundle that signed requests with only the
 * access key + secret (no session token), so every DynamoDB call failed with
 * UnrecognizedClientException ("security token invalid" → API Gateway 502)
 * and every presigned S3 URL failed PUT with 403. This builder keeps the
 * session token wired through and is unit-tested directly.
 */
export function buildAwsSdkConfig(): {
  region: string;
  endpoint?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
} {
  const base: {
    region: string;
    endpoint?: string;
    credentials?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
  } = { region };
  if (endpoint) base.endpoint = endpoint;
  if (process.env.AWS_ACCESS_KEY_ID !== undefined) {
    base.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
      ...(process.env.AWS_SESSION_TOKEN !== undefined
        ? { sessionToken: process.env.AWS_SESSION_TOKEN }
        : {}),
    };
  }
  return base;
}

export const ddbClient = new DynamoDBClient(buildAwsSdkConfig());

export const docClient = DynamoDBDocumentClient.from(ddbClient);

export const s3Client = new S3Client({
  ...buildAwsSdkConfig(),
  ...(endpoint ? { forcePathStyle: true } : {}),
});

export const TABLE_NAME = process.env.TABLE_NAME ?? 'sustain-the-globe-dev';
