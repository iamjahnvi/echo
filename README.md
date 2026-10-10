# SustainTheGlobe (EcoEcho)

SustainTheGlobe, also referred to as EcoEcho, is the WeMakeDevs Hackathon project in this repository. The repository contains the original web and Android client projects, alongside a newer root-level backend project.

## Project structure

- `sustaintheglobe-web/` — React 18 and TypeScript web client, built with Vite. The current app uses React Router, Zustand, and Moment in a small shell with Home and About routes and a backend-mode display. Material UI and Tailwind are declared/configured in the package, but are not used in the current app source.
- `SustainTheGlobeApp/` — Android application using Kotlin, Jetpack Compose, and Material 3. Its current screen is a basic greeting. Firebase Auth, Firestore, and Storage libraries are declared in Gradle; this repository does not establish a working Firebase flow.
- `backend/` — standalone Node.js 20+ TypeScript backend package. AWS SAM defines a Lambda function backed by API Gateway for `GET /health`; the handler returns a JSON status response. DynamoDB and S3 SDK clients and a DynamoDB seed script are present, but the SAM template currently defines no DynamoDB or S3 resources and no application data routes.
- `docker-compose.yml` — LocalStack service configured for local DynamoDB and S3 development.

The web and Android projects predate the root-level backend and remain separate clients. The backend is not a shared client library, and the current Android screen does not call it. The web source currently reads `VITE_BACKEND` to display a mode label; it does not make an API request. The SAM `/health` route is the only backend HTTP route defined in the current template.

## Technology and architecture

The web client is a Vite single-page application with React and TypeScript. The Android client is a native Kotlin app using Compose. The backend compiles TypeScript to `backend/dist` and is structured for AWS Lambda on the Node.js 20 runtime. It uses AWS SDK clients for DynamoDB and S3, and the SAM template supplies `TABLE_NAME` and `AWS_REGION` to the health function. Local endpoint settings in the backend client code use `DYNAMODB_ENDPOINT` or `AWS_ENDPOINT_URL`.

The backend also includes an idempotent DynamoDB seed script. Its default endpoint is `http://localhost:4566`, matching the LocalStack port in the root Compose file. The seed script uses the `AWS_REGION` and `TABLE_NAME` environment variables, with defaults in source code. The health handler itself does not read from DynamoDB or S3.

## Developer setup

Use Node.js 20 or newer for the backend. Install dependencies in each JavaScript package separately:

```sh
cd sustaintheglobe-web
npm ci
npm run dev
```

The web package also defines `npm run build`, `npm run preview`, and `npm test` (which runs Vitest). Its Vite development server is configured for port 5173. The only web environment variable read by the current application source is `VITE_BACKEND`; when unset, blank, or `firebase`, the mode helper returns `firebase`. This value currently only affects the displayed mode.

For backend development:

```sh
cd backend
npm ci
npm run build
npm test
```

The backend package also defines `npm run seed:dry-run` and `npm run seed`. To run the seed script against local LocalStack, start LocalStack from the repository root first:

```sh
docker compose up -d
```

Then, from `backend/`, run `npm run seed:dry-run` to print the planned items or `npm run seed` to create/use the configured table and write the sample items. The non-dry-run command writes to the endpoint selected by `DYNAMODB_ENDPOINT`, then `AWS_ENDPOINT_URL`, or the source default `http://localhost:4566`; review your environment before running it.

The Android project includes the Gradle wrapper. On Windows, `SustainTheGlobeApp\gradlew.bat :app:assembleDebug` invokes the configured Android build task. The Google Services Gradle plugin is applied, while `SustainTheGlobeApp/app/google-services.json` is ignored and is not present in this repository snapshot. A locally configured Firebase project file may therefore be needed for Android Gradle tasks.

## Validation and deployment status

The repository contains a web Vitest test and backend Node test source, but this README does not assert that tests or builds have been run. No validation report is present in the repository snapshot. The checked-in SAM template describes infrastructure configuration; its presence does not verify a live AWS stack, API Gateway URL, Cognito user pool, or successful deployment. The web example environment file contains setup placeholders for additional AWS/Firebase settings, but those settings are not evidence of integrations implemented in the current source. Likewise, the Android source and Gradle files do not establish that an Android build has succeeded.

## Repository files

- `backend/template.yaml` — AWS SAM template for the health Lambda and API route.
- `backend/src/handlers/health.ts` — health response handler.
- `backend/src/lib/dynamo.ts` — AWS SDK client setup.
- `backend/src/seed.ts` — DynamoDB sample seed script.
- `sustaintheglobe-web/.env.example` — web environment example; keep real local values out of version control.

