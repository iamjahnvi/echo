import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_PHOTO_TYPES,
  buildPhotoKey,
  isAllowedPhotoType,
  photoKeyBelongsToUser,
  sanitizeSegment,
  validateUploadInput,
} from '../lib/uploads.js';
import { createUploadCore } from '../handlers/uploads.js';
import { createActionCore } from '../handlers/actions.js';

function stubDoc(impl: (cmd: unknown) => Promise<unknown>) {
  return { doc: { send: impl }, table: 't' };
}

test('upload validation accepts jpeg/png/webp within size limit', () => {
  for (const t of ALLOWED_PHOTO_TYPES) {
    const r = validateUploadInput({
      userId: 'u1',
      clientActionId: 'a1',
      photoType: t,
      photoSize: 1024,
    });
    assert.equal(r.ok, true);
  }
  assert.equal(isAllowedPhotoType('image/gif'), false);
});

test('upload validation rejects bad type, oversize, missing fields', () => {
  const base = { userId: 'u1', clientActionId: 'a1', photoType: 'image/png', photoSize: 100 };
  assert.equal(
    validateUploadInput({ ...base, photoType: 'application/pdf' }).ok,
    false,
  );
  assert.equal(
    validateUploadInput({ ...base, photoSize: 6 * 1024 * 1024 }).ok,
    false,
  );
  assert.equal(validateUploadInput({ ...base, photoSize: 0 }).ok, false);
  assert.equal(validateUploadInput({ ...base, userId: '' }).ok, false);
  assert.equal(validateUploadInput({ ...base, clientActionId: '' }).ok, false);
  assert.equal(validateUploadInput('nope').ok, false);
});

test('photo key is deterministic, user-bound, and extension-mapped', () => {
  assert.equal(buildPhotoKey('u1', 'a1', 'image/jpeg'), 'uploads/u1/a1.jpg');
  assert.equal(buildPhotoKey('u1', 'a1', 'image/png'), 'uploads/u1/a1.png');
  assert.equal(buildPhotoKey('u1', 'a1', 'image/webp'), 'uploads/u1/a1.webp');
  assert.equal(buildPhotoKey('u 1/x', 'a1', 'image/png'), 'uploads/u-1-x/a1.png');
  assert.equal(photoKeyBelongsToUser('uploads/u1/a1.jpg', 'u1'), true);
  assert.equal(photoKeyBelongsToUser('uploads/other/a1.jpg', 'u1'), false);
  assert.equal(photoKeyBelongsToUser(undefined, 'u1'), false);
  assert.equal(sanitizeSegment('  '), 'user');
});

test('createUploadCore signs one short-lived URL without credentials in output', async () => {
  let signed: { b: string; k: string; ct: string } | null = null;
  const r = await createUploadCore(
    { userId: 'ignored-spoof', clientActionId: 'a1', photoType: 'image/png', photoSize: 500 },
    { userId: 'sub-123' },
    {
      bucket: 'photos-bucket',
      sign: async (b, k, ct) => {
        signed = { b, k, ct };
        return 'https://signed.example/put';
      },
    },
  );
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.photoKey, 'uploads/sub-123/a1.png');
  assert.equal(r.body.uploadUrl, 'https://signed.example/put');
  assert.equal(r.body.expiresIn, 300);
  assert.deepEqual(signed, { b: 'photos-bucket', k: 'uploads/sub-123/a1.png', ct: 'image/png' });
  assert.ok(!JSON.stringify(r.body).includes('SECRET'));
});

test('createUploadCore returns 400 for invalid input, 500 when bucket/signing broken', async () => {
  const auth = { userId: 'sub-123' };
  const bad = await createUploadCore(
    { userId: 'u1', photoType: 'image/gif', photoSize: 10 },
    auth,
    { bucket: 'b', sign: async () => 'x' },
  );
  assert.equal(bad.statusCode, 400);

  const noBucket = await createUploadCore(
    { userId: 'u1', clientActionId: 'a1', photoType: 'image/png', photoSize: 10 },
    auth,
    { bucket: '', sign: async () => 'x' },
  );
  assert.equal(noBucket.statusCode, 500);

  const signFail = await createUploadCore(
    { userId: 'u1', clientActionId: 'a1', photoType: 'image/png', photoSize: 10 },
    auth,
    {
      bucket: 'b',
      sign: async () => {
        throw new Error('kms down');
      },
    },
  );
  assert.equal(signFail.statusCode, 500);
});

test('createUploadCore returns 401 without authentication', async () => {
  const r = await createUploadCore(
    { userId: 'u1', clientActionId: 'a1', photoType: 'image/png', photoSize: 10 },
    null,
    { bucket: 'b', sign: async () => 'x' },
  );
  assert.equal(r.statusCode, 401);
});

test('action rejects a photoKey issued to another user', async () => {
  let called = false;
  const d = stubDoc(async () => {
    called = true;
    return {};
  });
  const r = await createActionCore(
    {
      userId: 'ignored',
      clientActionId: 'a1',
      actionType: 'recycle',
      photoKey: 'uploads/other-user/a9.jpg',
    },
    { userId: 'sub-123' },
    d,
  );
  assert.equal(r.statusCode, 400);
  assert.equal(called, false);
});

test('action accepts own photoKey and stores it on the record', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let seen: any = null;
  const d = stubDoc(async (cmd: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seen = (cmd as any).input;
    return {};
  });
  const r = await createActionCore(
    {
      userId: 'ignored-spoof',
      clientActionId: 'a1',
      actionType: 'recycle',
      photoName: 'bin.jpg',
      photoSize: 100,
      photoType: 'image/jpeg',
      photoKey: 'uploads/sub-123/a1.jpg',
    },
    { userId: 'sub-123' },
    d,
  );
  assert.equal(r.statusCode, 201);
  assert.equal(seen.Item.photoKey, 'uploads/sub-123/a1.jpg');
});
