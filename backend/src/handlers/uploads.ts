import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CORS_HEADERS } from '../lib/cors.js';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../lib/dynamo.js';
import {
  UPLOAD_URL_EXPIRY_SECONDS,
  buildPhotoKey,
  photoKeyBelongsToUser,
  validateUploadInput,
} from '../lib/uploads.js';
import {
  getAuthIdentity,
  unauthorizedBody,
  type AuthIdentity,
} from '../lib/auth.js';

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
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * POST /uploads core: authenticate, validate image server-side, then sign one
 * short-lived private PUT URL bound to the CALLER's identity. A caller-supplied
 * userId is ignored — uploads can never be issued under another user's identity.
 * No AWS credentials ever go to the browser.
 */
export async function createUploadCore(
  rawBody: unknown,
  auth: AuthIdentity | null,
  d: UploadDeps = deps(),
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  if (auth === null) return { statusCode: 401, body: unauthorizedBody() };
  const merged =
    typeof rawBody === 'object' && rawBody !== null
      ? { ...(rawBody as Record<string, unknown>), userId: auth.userId }
      : { userId: auth.userId };
  const v = validateUploadInput(merged);
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
  const r = await createUploadCore(parsed, getAuthIdentity(event));
  return json(r.statusCode, r.body);
};

export interface DeleteDeps {
  bucket: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  s3: { send: (cmd: any) => Promise<any> };
}

function deleteDeps(): DeleteDeps {
  return {
    bucket: process.env.PHOTOS_BUCKET ?? '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s3: s3Client as unknown as { send: (cmd: any) => Promise<any> },
  };
}

/**
 * DELETE /uploads?photoKey= core: best-effort orphan cleanup. Only the caller's
 * own keys can be deleted; DeleteObject is idempotent (missing key → 200).
 */
export async function deleteUploadCore(
  rawKey: unknown,
  auth: AuthIdentity | null,
  d: DeleteDeps = deleteDeps(),
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  if (auth === null) return { statusCode: 401, body: unauthorizedBody() };
  if (typeof rawKey !== 'string' || rawKey.trim() === '')
    return { statusCode: 400, body: { message: 'photoKey query parameter is required.' } };
  if (!photoKeyBelongsToUser(rawKey.trim(), auth.userId))
    return { statusCode: 403, body: { message: 'Not your photo.' } };
  if (d.bucket.trim() === '')
    return { statusCode: 500, body: { message: 'Photo storage is not configured.' } };
  try {
    await d.s3.send(
      new DeleteObjectCommand({ Bucket: d.bucket, Key: rawKey.trim() }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { statusCode: 500, body: { message: `Could not delete photo: ${msg}` } };
  }
  return { statusCode: 200, body: { deleted: true } };
}

export const deleteHandler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const r = await deleteUploadCore(
    event.queryStringParameters?.photoKey,
    getAuthIdentity(event),
  );
  return json(r.statusCode, r.body);
};
