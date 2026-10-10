/**
 * Legitimate application rules for environmental actions and points.
 * Points are computed server-side only — the client never sends a point value.
 * Pure functions: fully unit-testable without AWS.
 */

export const ACTION_TYPES = [
  'recycle',
  'cleanup',
  'plant',
  'transit',
  'energy',
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** Points awarded per verified action type. */
export const ACTION_POINTS: Record<ActionType, number> = {
  recycle: 10,
  transit: 15,
  energy: 20,
  cleanup: 25,
  plant: 30,
};

export const MAX_NOTE_LENGTH = 500;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_NAME_LENGTH = 255;
export const MAX_USER_ID_LENGTH = 128;
export const MAX_CLIENT_ACTION_ID_LENGTH = 128;

export interface PhotoMeta {
  photoName?: string;
  photoSize?: number;
  photoType?: string;
}

export interface ActionInput extends PhotoMeta {
  userId: string;
  clientActionId: string;
  actionType: ActionType;
  note?: string;
  /** S3 key from POST /uploads. Must belong to userId (checked below). */
  photoKey?: string;
}

export interface ValidationSuccess {
  ok: true;
  value: ActionInput;
}

export interface ValidationFailure {
  ok: false;
  error: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function isActionType(v: unknown): v is ActionType {
  return (
    typeof v === 'string' &&
    (ACTION_TYPES as readonly string[]).includes(v)
  );
}

export function calculatePoints(actionType: ActionType): number {
  return ACTION_POINTS[actionType];
}

export function actionKeys(userId: string, clientActionId: string): {
  pk: string;
  sk: string;
} {
  return { pk: `USER#${userId}`, sk: `ACTION#${clientActionId}` };
}

export function validateActionInput(
  body: unknown,
): ValidationSuccess | ValidationFailure {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be JSON.' };
  const { userId, clientActionId, actionType, note, photoName, photoSize, photoType, photoKey } = body;

  if (typeof userId !== 'string' || userId.trim() === '')
    return { ok: false, error: 'userId is required.' };
  if (userId.length > MAX_USER_ID_LENGTH)
    return { ok: false, error: 'userId is too long.' };
  if (typeof clientActionId !== 'string' || clientActionId.trim() === '')
    return { ok: false, error: 'clientActionId is required (idempotency key).' };
  if (clientActionId.length > MAX_CLIENT_ACTION_ID_LENGTH)
    return { ok: false, error: 'clientActionId is too long.' };
  if (!isActionType(actionType))
    return {
      ok: false,
      error: `actionType must be one of: ${ACTION_TYPES.join(', ')}.`,
    };
  if (note !== undefined) {
    if (typeof note !== 'string') return { ok: false, error: 'note must be a string.' };
    if (note.length > MAX_NOTE_LENGTH)
      return { ok: false, error: `note must be at most ${MAX_NOTE_LENGTH} characters.` };
  }
  if (photoName !== undefined) {
    if (typeof photoName !== 'string' || photoName.trim() === '')
      return { ok: false, error: 'photoName must be a non-empty string.' };
    if (photoName.length > MAX_PHOTO_NAME_LENGTH)
      return { ok: false, error: 'photoName is too long.' };
  }
  if (photoSize !== undefined) {
    if (!Number.isInteger(photoSize) || (photoSize as number) < 0)
      return { ok: false, error: 'photoSize must be a non-negative integer (bytes).' };
    if ((photoSize as number) > MAX_PHOTO_SIZE_BYTES)
      return {
        ok: false,
        error: `photo must be at most ${MAX_PHOTO_SIZE_BYTES} bytes.`,
      };
  }
  if (photoType !== undefined) {
    if (typeof photoType !== 'string' || !/^image\/[a-z0-9.+-]+$/.test(photoType))
      return { ok: false, error: 'photoType must be an image MIME type.' };
  }
  if (photoKey !== undefined) {
    if (typeof photoKey !== 'string' || photoKey.trim() === '')
      return { ok: false, error: 'photoKey must be a non-empty string.' };
    if (photoKey.length > 512) return { ok: false, error: 'photoKey is too long.' };
    // Key must have been issued to this user via POST /uploads
    // (prefix check; exact user binding enforced below).
    if (!photoKey.startsWith('uploads/'))
      return { ok: false, error: 'photoKey is not a valid upload key.' };
  }

  const value: ActionInput = {
    userId: userId.trim(),
    clientActionId: clientActionId.trim(),
    actionType,
  };
  if (note !== undefined) value.note = note;
  if (photoName !== undefined) value.photoName = photoName.trim();
  if (photoSize !== undefined) value.photoSize = photoSize as number;
  if (photoType !== undefined) value.photoType = photoType;
  if (photoKey !== undefined) {
    // Enforce user binding without importing uploads lib (avoid cycles):
    // key shape is uploads/<sanitized-userId>/<...>
    const seg = userId
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    const expected = `uploads/${seg === '' ? 'user' : seg}/`;
    if (!(photoKey as string).startsWith(expected))
      return { ok: false, error: 'photoKey does not belong to this user.' };
    value.photoKey = (photoKey as string).trim();
  }
  return { ok: true, value };
}
