/**
 * Server-side rules for photo uploads. Never trust browser validation alone:
 * every field is re-validated here before any URL is signed.
 * Pure functions: fully unit-testable without AWS.
 */

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedPhotoType = (typeof ALLOWED_PHOTO_TYPES)[number];

const EXT_BY_TYPE: Record<AllowedPhotoType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
export const UPLOAD_URL_EXPIRY_SECONDS = 300;

/** Keep S3 key segments safe: allow alphanumerics, dash, underscore; fold the rest. */
export function sanitizeSegment(v: string): string {
  const s = v
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s === '' ? 'user' : s;
}

export function isAllowedPhotoType(v: unknown): v is AllowedPhotoType {
  return (
    typeof v === 'string' &&
    (ALLOWED_PHOTO_TYPES as readonly string[]).includes(v)
  );
}

export interface UploadInput {
  userId: string;
  clientActionId: string;
  photoType: AllowedPhotoType;
  photoSize: number;
}

export function validateUploadInput(
  body: unknown,
): { ok: true; value: UploadInput } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null)
    return { ok: false, error: 'Request body must be JSON.' };
  const { userId, clientActionId, photoType, photoSize } = body as Record<string, unknown>;
  if (typeof userId !== 'string' || userId.trim() === '')
    return { ok: false, error: 'userId is required.' };
  if (userId.length > 128) return { ok: false, error: 'userId is too long.' };
  if (typeof clientActionId !== 'string' || clientActionId.trim() === '')
    return { ok: false, error: 'clientActionId is required.' };
  if (clientActionId.length > 128)
    return { ok: false, error: 'clientActionId is too long.' };
  if (!isAllowedPhotoType(photoType))
    return {
      ok: false,
      error: `photoType must be one of: ${ALLOWED_PHOTO_TYPES.join(', ')}.`,
    };
  if (!Number.isInteger(photoSize) || (photoSize as number) <= 0)
    return { ok: false, error: 'photoSize must be a positive integer (bytes).' };
  if ((photoSize as number) > MAX_PHOTO_SIZE_BYTES)
    return {
      ok: false,
      error: `photo must be at most ${MAX_PHOTO_SIZE_BYTES} bytes.`,
    };
  return {
    ok: true,
    value: {
      userId: (userId as string).trim(),
      clientActionId: (clientActionId as string).trim(),
      photoType,
      photoSize: photoSize as number,
    },
  };
}

/** Deterministic key binds the object to one user + one action attempt. */
export function buildPhotoKey(
  userId: string,
  clientActionId: string,
  photoType: AllowedPhotoType,
): string {
  return `uploads/${sanitizeSegment(userId)}/${sanitizeSegment(clientActionId)}.${EXT_BY_TYPE[photoType]}`;
}

/**
 * The photoKey stored on an action must belong to the submitting user,
 * otherwise callers could attach (or probe) other users' objects.
 */
export function photoKeyBelongsToUser(photoKey: unknown, userId: string): boolean {
  if (typeof photoKey !== 'string') return false;
  return photoKey.startsWith(`uploads/${sanitizeSegment(userId)}/`);
}
