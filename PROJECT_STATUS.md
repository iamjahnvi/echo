# SustainTheGlobe — PROJECT_STATUS

> Truthfulness rule: a feature is WORKING only if verified by a test or actual
> execution. Unit-test success is NOT live-AWS proof. Nothing here has been
> deployed; no live end-to-end run has happened (Docker/AWS unavailable locally).

## A. Current architecture

- **Web (`sustaintheglobe-web/src/`)**: `App.tsx` Home shows mode (`lib.ts`), backend
  liveness (`api.ts:fetchHealth`). In AWS mode, `AuthProvider` (`auth.tsx`,
  `amazon-cognito-identity-js`, already installed) gates everything: anonymous
  users get an `AuthScreen` (sign-up + email confirmation + resend + sign-in);
  authenticated users see their email, sign-out, and `ActionsPanel`, which sends
  `Authorization: Bearer <access token>` on every protected call
  (`api.ts:authHeaders`) and routes 401s back to sign-in (`isSessionExpired`).
  Upload sequence with orphan self-cleanup: ticket → PUT bytes → submit → refresh;
  if submit fails after a PUT, the app calls authed `DELETE /uploads?photoKey=`.
  Firebase mode renders the old shell only; no fetch happens there.
- **Backend (`backend/src/`)**: Lambda `nodejs24.x`. `GET /health` stays PUBLIC.
  `POST /actions` + `GET /actions` (`handlers/actions.ts`, list supports
  `limit` 1..50 + opaque `nextToken` cursor), `GET /points`
  (`handlers/points.ts`), `POST /uploads` + `DELETE /uploads?photoKey=`
  (`handlers/uploads.ts`; delete is ownership-checked, idempotent orphan
  cleanup), `GET /me` (`handlers/me.ts`: `{userId, email}` from the token),
  `GET /leaderboard?limit=` (`handlers/leaderboard.ts`: Scan-capped aggregate,
  masked display ids, top ≤20) are protected
  by the `CognitoAuth` authorizer on the shared `ApiGatewayApi` (REST API,
  CORS allows the SPA's `Content-Type`/`Authorization` headers) AND
  re-checked in code: identity comes ONLY from `lib/auth.ts:getAuthIdentity`
  (authorizer `claims.sub`, HTTP-API `jwt.claims` tolerated). Caller-supplied
  `userId` is overridden/ignored everywhere; missing identity → 401.
  Points come ONLY from the server rule table (`lib/points.ts`).
- **Database**: single DynamoDB table `sustain-the-globe-dev` (`DataTable` in
  `template.yaml`). Action items: `pk=USER#<cognito-sub>`, `sk=ACTION#<clientActionId>`
  with server `points`, `createdAt`. Idempotency = conditional write
  (`attribute_not_exists(pk) AND attribute_not_exists(sk)`, atomic in DynamoDB)
  → duplicate `clientActionId` returns 409, never a second award. Totals are a
  server-side sum over the caller's items (`GET /points`).
  DATA COMPATIBILITY: pre-auth demo records were keyed `USER#<raw userId>`; new
  records are keyed `USER#<cognito-sub>`. Old rows are NOT migrated (hackathon
  demo data); each identity sees only its own partition.
- **Photo storage**: private S3 bucket `PhotosBucket` (all public access blocked,
  SSE-S3). Keys `uploads/<sanitized-sub>/<sanitized-actionId>.<ext>`; actions accept
  only keys bound to the token identity. JPEG/PNG/WebP ≤ 5 MB, re-validated
  server-side. Images are private; the app shows file names only.
- **Auth (IMPLEMENTED, needs deployment to go live)**: `UserPool` (email sign-in,
  8+upper/lower/number policy) + public SPA `UserPoolClient` (NO secret,
  USER_PASSWORD/SRP/refresh flows) + `CognitoAuth` authorizer in `template.yaml`;
  outputs `UserPoolId`, `UserPoolClientId`, `Region`, `ApiUrl` feed
  `.env.example` (`VITE_COGNITO_*`, public IDs only — no secrets). No passwords,
  tokens, or secrets are logged (401 body is a static string; tests assert this).
- **Android**: greeting screen only, no backend calls. Untouched by design.
- **Unverified live**: template is `sam validate --lint` clean, but no LocalStack
  run, no `sam local start-api`, no deploy, no real Cognito login/email delivery
  has occurred in this environment. (`sam local` also skips authorizers, so local
  protected-route testing needs a real token regardless.)

## B. Feature status

| Feature | Status | Evidence |
|---|---|---|
| `GET /health` backend + web status line | WORKING (unit) | `backend/src/tests/health.test.ts`, `web src/api.test.ts` fetchHealth suite |
| Action validation (types, lengths, photo meta) | WORKING (unit) | `backend/src/tests/actions.test.ts` (8 cases), `src/lib/points.ts` |
| Server-computed points (10/15/20/25/30) | WORKING (unit) | rule-table test; client sends no points |
| Duplicate protection (409, no double award) | WORKING (unit, atomic by DynamoDB design) | conditional-write test; concurrent live test NOT done |
| `GET /actions` newest-first list | WORKING (unit) | stub-Dynamo test + limit/cursor pagination tests |
| `GET /me` profile from token | WORKING (unit) | `extra.test.ts` (shape, null-email, 401) |
| `GET /leaderboard` masked, sorted, capped | WORKING (unit) | aggregate/sort/limit/401 tests; live scan NOT run |
| `DELETE /uploads` orphan cleanup (ownership-checked) | WORKING (unit) | 200/400/403/401/500 cases; live S3 NOT run |
| `GET /points` server-side totals | WORKING (unit) | sum test (10+25=35) |
| Presigned photo upload URL (type/size enforced, user-bound keys) | WORKING (unit) | `backend/src/tests/uploads.test.ts` (injected signer); identity now from token, spoofed userId overridden |
| Web upload orchestration (ticket → PUT → submit → refresh) | PARTIAL | `putPhotoBytes`/`requestUploadUrl` unit-tested with Bearer headers; UI flow NOT run against a server |
| Photo bytes actually stored in S3 | BLOCKED | needs LocalStack S3 or real bucket; unit tests mock the signer/PUT |
| Points/activity surviving refresh | PARTIAL | DynamoDB-backed by design; live refresh NOT demonstrated |
| Cognito infrastructure (pool, SPA client, authorizer, outputs) | WORKING (static) | `sam validate --lint` clean; live deploy NOT done |
| Backend identity enforcement (401s, spoof-immunity, own-partition-only) | WORKING (unit) | `auth.test.ts` + spoof/cross-user tests in `actions/uploads.test.ts`; live authorizer NOT exercised |
| Web sign-up/confirm/sign-in/sign-out + Bearer on every protected call | PARTIAL | `auth.test.ts` covers config/error-mapping; real login + email delivery need a deployed pool |
| Authentication / user identity | PARTIAL (code done, AWS proof pending) | see two rows above; pre-auth `demo-user` flow removed from UI |
| Image verification of claimed action | NOT IMPLEMENTED | by design: points are for *submitted* actions; UI copy says so |
| Android backend integration | NOT IMPLEMENTED | greeting only, intentionally untouched |
| Environmental issue reporting expansion | NOT IMPLEMENTED | secondary; deliberately out of scope |
| Orphan cleanup (PUT ok + POST fail) | NOT IMPLEMENTED | documented in UI comment; P2 lifecycle task |

## C. Prioritized task backlog

### P0 — core experience blockers
- **P0-1 Deploy + live end-to-end proof (auth → upload → action → points).**
  Files: whole flow. Matters: auth code is proven only by unit tests; no real
  login, authorizer check, or S3/Dynamo round-trip has happened.
  Implement (needs AWS creds — genuine blocker, everything local is done):
  `sam deploy --guided` (stack `sustain-the-globe-dev`, region `us-east-1`) →
  read Outputs (`ApiUrl`, `UserPoolId`, `UserPoolClientId`, `Region`) → paste
  into local `.env` (`VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID/CLIENT_ID/REGION`;
  never commit) → `npm run dev` → sign up → confirm email → sign in → submit
  with photo → refresh persists → retry same action → 409 → sign out →
  unauthenticated calls get 401s.
  Verify: one user cannot see another's points (two test accounts); tampered
  `userId` in body is ignored.
- **P0-2 (local, no creds needed) Orphan lifecycle for photo uploads.** DONE in
  code: app calls ownership-checked `DELETE /uploads` when submit fails after a
  PUT (`App.tsx:onSubmit`, `api.ts:deleteUpload`, backend `deleteHandler` +
  `s3:DeleteObject` statement). Remaining: template bucket lifecycle rule is
  still absent (it cannot solve record-less orphans anyway) — keep as P2 polish.

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

- `npm test` from `backend/` → **33/33 pass**, exit 0. Adds: `GET /me` shape,
  leaderboard aggregate/mask/limit/401/handler mapping, `DELETE /uploads`
  ownership/idempotency/errors, list limit/cursor round-trip + 400s.
- `npm test` from `sustaintheglobe-web/` → **36/36 pass** (3 files), exit 0.
  Adds: `getMe`/`getLeaderboard`/`deleteUpload` (URLs, Bearer, error mapping,
  best-effort cleanup never throws).
- `npm run build` from `sustaintheglobe-web/` (`tsc && vite build`) → **pass**,
  118 modules, exit 0. (Fixed one new strict-TS arg-order error in `api.test.ts`
  found by `tsc`; vitest had masked it.)
- `sam validate --template-file template.yaml --region us-east-1 --lint` from
  `backend/` → **valid SAM template**, exit 0 (covers CORS, `MeFunction`,
  `LeaderboardFunction`, `DeleteUpload` route, `DeleteObject` statement).
- Genuine end-to-end (sign-up → email → login → upload → action → points over
  HTTP): **NOT run** — needs `sam deploy` + real Cognito delivery (AWS creds
  unavailable). `sam local` also skips authorizers, so even local protected
  routes need a real token. Unit success does not prove it.

## E. Recommended next 3 tasks (in order)

1. **P0-1 deploy + live auth E2E** (commands in P0-1): the only remaining proof;
   every line of code for it is already written and unit-tested. Now also
   covers `/me`, `/leaderboard`, and orphan-delete over HTTP.
2. **P1-1 demo recording** on the deployed stack (two accounts showing
   partition isolation + leaderboard) for the hackathon video.
3. **P2 bucket lifecycle polish** (template-only): belt-and-suspenders behind
   the now-working app-level orphan delete.
