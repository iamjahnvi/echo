# SustainTheGlobe (EcoEcho)

SustainTheGlobe is a React web client backed by an AWS SAM API. The authenticated application records environmental actions, awards server-computed points, supports private photo uploads, and displays a leaderboard. The API uses Cognito, API Gateway, Lambda, DynamoDB, and S3.

## Local web and API development

Requirements: Node.js 20 or newer, AWS SAM CLI, and Docker Desktop running. SAM Local runs Lambda containers through Docker. From PowerShell, install dependencies once:

```powershell
cd C:\Users\Lenovo\Desktop\echo\backend
npm ci
npm run build
```

Start the API in that terminal:

```powershell
npm run local
```

The SAM API listens on `http://127.0.0.1:3000`. Its public `GET /health` endpoint works locally. The local API command uses the existing ignored `backend/local-env.json`; keep that file private and do not paste its contents into logs or chat.

In a second PowerShell terminal, start the web client:

```powershell
cd C:\Users\Lenovo\Desktop\echo\sustaintheglobe-web
npm ci
npm run dev
```

Open `http://localhost:5173/`. In Vite development, `/api` is proxied to SAM on port 3000. An unset, placeholder, malformed, or same-origin `VITE_API_URL` therefore uses the local API. A valid external API URL can still be used during development. `VITE_BACKEND=aws` enables the existing authenticated SustainTheGlobe interface; the counter previously shown on Home was a local Zustand demo and has been removed.

### Cognito and protected features

The browser needs real public values for `VITE_COGNITO_USER_POOL_ID` and `VITE_COGNITO_CLIENT_ID`. Obtain them from the outputs of a deployed SAM stack (`UserPoolId` and `UserPoolClientId`). The pool ID includes the region, so the current SDK infers it; `VITE_COGNITO_REGION` is not required by the frontend. Never add a Cognito client secret to the browser.

Local SAM does not create or emulate Cognito tokens or API Gateway's verified authorizer claims. The backend deliberately rejects protected requests without those verified claims. As a result, local SAM can verify health and support unprotected handler work, but sign-up/sign-in and protected actions, points, uploads, profile, and leaderboard require the real deployed API and Cognito configuration. No local authentication bypass or fake API responses are provided. If the two Cognito IDs are missing or remain placeholders, the UI explains that sign-in is unavailable.

The backend's data routes are `POST/GET /actions`, `GET /points`, `POST/DELETE /uploads`, `GET /me`, and `GET /leaderboard`; all require Cognito authorization. The `/health` route is public. The web client's upload flow uses the API's presigned S3 URL and sends the authenticated token on protected requests.

## Validation

Web:

```powershell
cd C:\Users\Lenovo\Desktop\echo\sustaintheglobe-web
npm test
npm run build
```

Backend:

```powershell
cd C:\Users\Lenovo\Desktop\echo\backend
npm test
```

`npm test` builds the backend TypeScript and runs its Node tests. `npm run local` starts the SAM API after the backend build. The root `docker-compose.yml` can start LocalStack for DynamoDB/S3 development, but LocalStack does not provide Cognito or API Gateway authorizer behavior.

## Android

`SustainTheGlobeApp/` is a separate Kotlin/Jetpack Compose project. Its current screen is a basic greeting and does not call the backend. Android Firebase configuration is separate from the web application's Cognito setup.

## AWS deployment

`backend/template.yaml` defines the AWS infrastructure. Deployment is intentionally separate from local development; no AWS resources are created by the commands above. The web API URL and Cognito public IDs for a deployed stack come from its SAM outputs and belong in the developer's ignored local environment file, never in source control.
