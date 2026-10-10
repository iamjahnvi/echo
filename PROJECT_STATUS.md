# SustainTheGlobe — PROJECT_STATUS

> Truthfulness rule: a feature is WORKING only if verified by a test or actual
> execution. Unit-test success is NOT live-AWS proof. Nothing here has been
> deployed; no live end-to-end run has happened (Docker/AWS unavailable locally).

## A. Current architecture

- **Web (`sustaintheglobe-web/src/`)**: `App.tsx` Home shows mode (`lib.ts`), backend
  liveness (`api.ts:fetchHealth`), and — in AWS mode only — `ActionsPanel`:
  userId + action-type + note + photo picker → `requestUploadUrl` (POST /uploads)
  → `putPhotoBytes` (PUT bytes direct to S3, presigned URL, no creds in browser)
  → `submitAction` (POST /actions with `photoKey`) → refresh `listActions` +
  `getPoints`. Firebase mode renders the old shell only; no fetch happens there.
- **Backend (`backend/src/`)**: Lambda `nodejs24.x`. `GET /health` (static).
  `POST /actions` + `GET /actions` (`handlers/actions.ts`), `GET /points`
  (`handlers/points.ts`), `POST /uploads` (`handlers/uploads.ts`, presigned PUT
  via `@aws-sdk/s3-request-presigner`, 5-min expiry). Points come ONLY from the
  server rule table (`lib/points.ts`); the client never sends points.
- **Database**: single DynamoDB table `sustain-the-globe-dev` (`DataTable` in
  `template.yaml`). Action items: `pk=USER#<userId>`, `sk=ACTION#<clientActionId>`
  with server `points`, `createdAt`. Idempotency = conditional write
  (`attribute_not_exists(pk) AND attribute_not_exists(sk)`, atomic in DynamoDB)
  → duplicate `clientActionId` returns 409, never a second award. Totals are a
  server-side sum over the user's items (`GET /points`).
- **Photo storage**: private S3 bucket `PhotosBucket` (all public access blocked,
  SSE-S3). Keys `uploads/<user>/<action>.<ext>`; actions accept only keys bound
  to the submitting user (`photoKeyBelongsToUser`). JPEG/PNG/WebP ≤ 5 MB,
  re-validated server-side. Images are private; the app shows file names only.
- **Auth**: NONE. `userId` is a self-asserted request field (UI defaults to
  `demo-user`). Anyone can read anyone's points by changing the parameter.
  No Cognito pool, no authorizer exists in `template.yaml`.
- **Android**: greeting screen only, no backend calls. Untouched by design.
- **Unverified live**: template is `sam validate --lint` clean, but no LocalStack
  run, no `sam local start-api`, no deploy has occurred in this environment.

## B. Feature status

| Feature | Status | Evidence |
|---|---|---|
| `GET /health` backend + web status line | WORKING (unit) | `backend/src/tests/health.test.ts`, `web src/api.test.ts` fetchHealth suite |
| Action validation (types, lengths, photo meta) | WORKING (unit) | `backend/src/tests/actions.test.ts` (8 cases), `src/lib/points.ts` |
| Server-computed points (10/15/20/25/30) | WORKING (unit) | rule-table test; client sends no points |
| Duplicate protection (409, no double award) | WORKING (unit, atomic by DynamoDB design) | conditional-write test; concurrent live test NOT done |
| `GET /actions` newest-first list | WORKING (unit) | stub-Dynamo test |
| `GET /points` server-side totals | WORKING (unit) | sum test (10+25=35) |
| Presigned photo upload URL (type/size enforced, user-bound keys) | WORKING (unit) | `backend/src/tests/uploads.test.ts` (7 cases, injected signer) |
| Web upload orchestration (ticket → PUT → submit → refresh) | PARTIAL | `putPhotoBytes`/`requestUploadUrl` unit-tested; UI flow NOT run against a server |
| Photo bytes actually stored in S3 | BLOCKED | needs LocalStack S3 or real bucket; unit tests mock the signer/PUT |
| Points/activity surviving refresh | PARTIAL | DynamoDB-backed by design; live refresh NOT demonstrated |
| Authentication / user identity | NOT IMPLEMENTED | no pool/authorizer; `userId` spoofable (see P0-1) |
| Image verification of claimed action | NOT IMPLEMENTED | by design: points are for *submitted* actions; UI copy says so |
| Android backend integration | NOT IMPLEMENTED | greeting only, intentionally untouched |
| Environmental issue reporting expansion | NOT IMPLEMENTED | secondary; deliberately out of scope |
| Orphan cleanup (PUT ok + POST fail) | NOT IMPLEMENTED | documented in UI comment; P2 lifecycle task |

## C. Prioritized task backlog

### P0 — core experience blockers
- **P0-1 Live end-to-end proof (actions + photo + points).** Files: whole flow
  (`/uploads` → S3 PUT → `/actions` → `/points`, `App.tsx:ActionsPanel`).
  Matters: nothing is proven until bytes + records + totals work over HTTP.
  Implement: `docker compose up -d` → `npm run seed` → `sam local start-api`
  → drive the web UI. Blockers: Docker daemon unavailable here.
  Verify: submit with photo, refresh, totals persist; retry same key → 409, no
  extra points. Local-only: yes, once Docker exists.
- **P0-2 Cognito authentication + user binding.** Files: `template.yaml`
  (UserPool, authorizer), all handlers (identity from verified token, not
  `userId` param), web sign-in. Matters: currently anyone can impersonate/read
  anyone. Implement: add pool + `AWS::Serverless::Api` authorizer, replace
  `userId` input with `sub` claim (keep `demo-user` only for firebase mode).
  Blockers: needs AWS resources/credentials; would block local testing if forced
  now. Verify: forged `userId` rejected; tokenless calls 401. Local: partial
  (JWT shape tests only).

### P1 — complete the core product
- **P1-1 `sam deploy` to a dev stack + wire real `VITE_API_URL`.** Matters: first
  real URL for demo/video. Needs AWS creds. Verify: live `GET /health` 200.
- **P1-2 Orphan lifecycle for photo uploads.** Files: `template.yaml`
  (bucket lifecycle rule, e.g. abort/expire unreferenced `uploads/*`), or a
  cleanup note. Matters: failed submits leave private orphans. Local: yes
  (template-only + lint).
- **P1-3 Photo-type enforcement end-to-end.** Note: presigned PUTs can't bind
  Content-Length server-side; declared size is validated, bytes are trusted to
  match. Matters: honesty about limits. Implement: re-check object size via
  HeadObject in a post-submit step or accept + document. Local: needs S3.

### P2 — important improvements/integration
- **P2-1 Android read path** (points/activity screen calling `GET /points`).
  Blockers: SDK/`google-services.json` absent here.
- **P2-2 Pagination/caps hardening** (`Limit: 50/200` + in-code sort is fine for
  hackathon scale; revisit if users exceed it).
- **P2-3 Private photo viewing** (authenticated GET via short-lived presigned
  download URLs; never public-read).

### P3 — secondary (reporting and beyond)
- **P3-1 Environmental issue reporting enhancements** (municipality
  integrations, new report types). Deliberately deferred: secondary feature.
- **P3-2 AI/image verification.** Do NOT claim; only if a genuine mechanism is
  built and tested.

## D. Verification results (this run, exact commands)

- `npm test` from `backend/` → **19/19 pass** (12 prior + 7 uploads/photoKey),
  exit 0. Covers: rule table, validation, 201+conditional write, 409 duplicate,
  400-without-store-touch, list ordering, points sum, upload ticket shape/expiry,
  signer failure → 500, cross-user `photoKey` rejection.
- `npm test` from `sustaintheglobe-web/` → **23/23 pass** (2 files), exit 0.
  Covers: health, submit (201/400/409/network/missing-config), list/points
  URLs+errors, `validatePhotoFile`, ticket flow, PUT bytes (200/403/network),
  id uniqueness.
- `npm run build` from `sustaintheglobe-web/` (`tsc && vite build`) → **pass**,
  49 modules, exit 0. (Fixed 3 strict-TS tuple casts in `api.test.ts` found by
  `tsc`; vitest had masked them.)
- `sam validate --template-file template.yaml --region us-east-1 --lint` from
  `backend/` → **valid SAM template**, exit 0 (covers new `PhotosBucket`,
  `UploadsFunction`, `S3WritePolicy`).
- Genuine end-to-end (browser → API → DynamoDB/S3): **NOT run** — Docker daemon
  unavailable, no AWS creds. Unit success above does not prove it.

## E. Recommended next 3 tasks (in order)

1. **P0-1 live local E2E** (LocalStack + `sam local start-api` + web UI drive):
   converts 42 passing unit tests into one proven flow; unblocks the demo.
2. **P0-2 Cognito auth** (pool + authorizer + token-derived identity): closes the
   impersonation hole before any shared/demo deployment.
3. **P1-1 dev-stack deploy + real `VITE_API_URL`**: makes the hackathon demo
   recordable (eligibility requires AWS running; local SAM+LocalStack already
   qualifies as Build-It tooling, a URL makes it undeniable).
