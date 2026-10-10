/**
 * Idempotent seed script for DynamoDB (LocalStack or real AWS).
 * Usage:
 *   npm run seed:dry-run  -> prints planned actions, touches nothing
 *   npm run seed          -> creates table if absent, puts sample items (idempotent via PutItem overwrite)
 */
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const region = process.env.AWS_REGION ?? 'us-east-1';
const endpoint =
  process.env.DYNAMODB_ENDPOINT ?? process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
const tableName = process.env.TABLE_NAME ?? 'sustain-the-globe-dev';

const client = new DynamoDBClient({
  region,
  endpoint,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});
const doc = DynamoDBDocumentClient.from(client);

const sampleItems = [
  { pk: 'HEALTH#ping', sk: 'meta', message: 'seed item 1' },
  { pk: 'HEALTH#version', sk: 'meta', message: 'v1' },
];

async function tableExists(name: string): Promise<boolean> {
  try {
    const out = await client.send(new ListTablesCommand({}));
    if ((out.TableNames ?? []).includes(name)) return true;
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log(`[seed] table=${tableName} endpoint=${endpoint} dryRun=${dryRun}`);
  if (dryRun) {
    console.log('[seed:dry-run] would ensure table exists + put items:');
    for (const item of sampleItems) console.log(JSON.stringify(item));
    return;
  }
  const exists = await tableExists(tableName);
  if (!exists) {
    console.log(`[seed] creating table ${tableName}...`);
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
      }),
    );
    console.log('[seed] table created');
  } else {
    console.log('[seed] table already exists, skipping create (idempotent)');
  }
  for (const item of sampleItems) {
    await doc.send(new PutCommand({ TableName: tableName, Item: item }));
    console.log(`[seed] put ${item.pk}`);
  }
  console.log('[seed] done');
}

main().catch((err) => {
  console.error('[seed] FAILED:', (err as Error).message ?? err);
  process.exit(1);
});
