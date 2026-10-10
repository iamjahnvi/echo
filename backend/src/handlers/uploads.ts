import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../lib/dynamo.js';
import {
  UPLOAD_URL_EXPIRY_SECONDS,
  buildPhotoKey,
  validateUploadInput,
} from '../lib/uploads.js';

export interface UploadDeps {
  bucket: string;
  sign: (bucket: string, key: string, contentType: string) => Promise<string>;
}

function deps(): UploadDeps {
  const bucket = process.env.PHOTOS_BUCKET ?? '';
  return {
    bucket,
    sign: (b, k, contentType) =>
      getSignedUrl(
        s3Client,
        new PutObjectCommand({ Bucket: b, Key: k, ContentType: contentType }),
        { expiresIn: UPLOAD_URL_EXPIRY_SECONDS },
      ),
  };
}

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * POST /uploads core: validate image server-side, then sign one short-lived
 * private PUT URL. No AWS credentials ever go to the browser.
 */
export async function createUploadCore(
  rawBody: unknown,
  d: UploadDeps = deps(),
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const v = validateUploadInput(rawBody);
  if (!v.ok) return { statusCode: 400, body: { message: v.error } };
  if (d.bucket.trim() === '')
    return { statusCode: 500, body: { message: 'Photo storage is not configured.' } };

  const photoKey = buildPhotoKey(v.value.userId, v.value.clientActionId, v.value.photoType);
  let uploadUrl: string;
  try {
    uploadUrl = await d.sign(d.bucket, photoKey, v.value.photoType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { statusCode: 500, body: { message: `Could not sign upload URL: ${msg}` } };
  }
  return {
    statusCode: 200,
    body: { uploadUrl, photoKey, expiresIn: UPLOAD_URL_EXPIRY_SECONDS },
  };
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  let parsed: unknown;
  try {
    parsed = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { message: 'Request body must be JSON.' });
  }
  const r = await createUploadCore(parsed);
  return json(r.statusCode, r.body);
};
