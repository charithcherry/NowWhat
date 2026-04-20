# WhatNow Deployment

This document records the actual deployment process used for this repo on Google Cloud Run.

## Environment

- GCP account: `chpu8510@colorado.edu`
- GCP project display name: `My First Project`
- GCP project ID: `logical-contact-485620-v1`
- Region: `us-central1`
- Artifact Registry repo: `wellbeing-repo`
- Runtime platform: Cloud Run

## Deployed Services

These are the 6 deployed Cloud Run services:

| Repo Folder | Cloud Run Service | Public URL |
|---|---|---|
| `base` | `wellbeing-base` | `https://wellbeing-base-2ddknsu66q-uc.a.run.app` |
| `community` | `wellbeing-community` | `https://wellbeing-community-2ddknsu66q-uc.a.run.app` |
| `fitness-dashboard` | `wellbeing-fitness` | `https://wellbeing-fitness-2ddknsu66q-uc.a.run.app` |
| `nutrition-yelp` | `wellbeing-restaurants` | `https://wellbeing-restaurants-2ddknsu66q-uc.a.run.app` |
| `nutrition-wellness` | `wellbeing-nutrition` | `https://wellbeing-nutrition-2ddknsu66q-uc.a.run.app` |
| `skin-hair-analysis` | `wellbeing-skin-hair` | `https://wellbeing-skin-hair-2ddknsu66q-uc.a.run.app` |

Community entry through Base:

- `https://wellbeing-base-2ddknsu66q-uc.a.run.app/community`

## Secrets

`.env.local` values were not copied into Cloud Run manually. Runtime secrets were pulled from Google Secret Manager.

Secrets used:

- `wellbeing-mongodb-uri`
- `wellbeing-mongodb-db`
- `wellbeing-gemini-api-key`
- `wellbeing-yelp-api-key`
- `wellbeing-elevenlabs-api-key`
- `wellbeing-nutrition-memory-cron-secret`

There is also:

- `wellbeing-jwt-secret`

At the time of deployment, the app code was using shared session storage in MongoDB for auth handoff, and the above secret was not part of the active Cloud Run env mapping.

## Runtime Environment Variables

All services were deployed with these public URL env vars:

- `NEXT_PUBLIC_BASE_URL=https://wellbeing-base-2ddknsu66q-uc.a.run.app`
- `NEXT_PUBLIC_COMMUNITY_URL=https://wellbeing-community-2ddknsu66q-uc.a.run.app`
- `NEXT_PUBLIC_FITNESS_URL=https://wellbeing-fitness-2ddknsu66q-uc.a.run.app`
- `NEXT_PUBLIC_RESTAURANTS_URL=https://wellbeing-restaurants-2ddknsu66q-uc.a.run.app`
- `NEXT_PUBLIC_NUTRITION_URL=https://wellbeing-nutrition-2ddknsu66q-uc.a.run.app`
- `NEXT_PUBLIC_SKIN_URL=https://wellbeing-skin-hair-2ddknsu66q-uc.a.run.app`
- `NEXT_PUBLIC_COMMUNITY_ENTRY_URL=https://wellbeing-base-2ddknsu66q-uc.a.run.app/community`
- `AGENT_TIME_ZONE=America/Denver`

## Important Deployment Detail

This repo is Next.js-heavy, so `NEXT_PUBLIC_*` values are needed both:

- at Docker build time, because Next.js bakes them into the client bundle
- at Cloud Run runtime, because server code also reads them

If you only set them at Cloud Run runtime and not during `docker build`, the browser bundle will still contain stale values like `localhost` or `placeholder.invalid`.

## What We Had To Fix First

Before deployment could work reliably, these repo issues had to be fixed:

### 1. Dockerfiles did not inject build-time public env vars

Each service Dockerfile was updated to accept build args and export them before `next build`.

Affected files:

- [base/deployment/Dockerfile](/Users/charithpurushotham/Desktop/Wats_Next/base/deployment/Dockerfile:1)
- [community/deployment/Dockerfile](/Users/charithpurushotham/Desktop/Wats_Next/community/deployment/Dockerfile:1)
- [fitness-dashboard/deployment/Dockerfile](/Users/charithpurushotham/Desktop/Wats_Next/fitness-dashboard/deployment/Dockerfile:1)
- [nutrition-yelp/deployment/Dockerfile](/Users/charithpurushotham/Desktop/Wats_Next/nutrition-yelp/deployment/Dockerfile:1)
- [nutrition-wellness/deployment/Dockerfile](/Users/charithpurushotham/Desktop/Wats_Next/nutrition-wellness/deployment/Dockerfile:1)
- [skin-hair-analysis/deployment/Dockerfile](/Users/charithpurushotham/Desktop/Wats_Next/skin-hair-analysis/deployment/Dockerfile:1)

### 2. `skin-hair-analysis` needed standalone output

This service would not package correctly for Cloud Run until Next standalone output was enabled.

Affected file:

- [skin-hair-analysis/next.config.js](/Users/charithpurushotham/Desktop/Wats_Next/skin-hair-analysis/next.config.js:1)

### 3. Docker context was too large

Nested `node_modules` and `.next` directories were being included in build contexts. `.dockerignore` and `.gcloudignore` files were added or tightened across services.

### 4. `fitness-dashboard` Dockerfile copied a missing `public/` folder

That service has no `public` directory. Its runner stage was failing on:

- `COPY --from=builder /app/public ./public`

That copy step was removed from:

- [fitness-dashboard/deployment/Dockerfile](/Users/charithpurushotham/Desktop/Wats_Next/fitness-dashboard/deployment/Dockerfile:1)

## How Deployment Was Done

### Step 1. Authenticate and select project

Use the correct Google account and project:

```bash
gcloud config set project logical-contact-485620-v1
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
```

### Step 2. Read secrets from Secret Manager

Secrets were accessed with:

```bash
gcloud secrets versions access latest --secret <secret-name>
```

### Step 3. Build images with build args

Images were built and pushed with `docker buildx`:

```bash
docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  --push \
  -f deployment/Dockerfile \
  -t us-central1-docker.pkg.dev/logical-contact-485620-v1/wellbeing-repo/<image>:<tag> \
  --build-arg NEXT_PUBLIC_BASE_URL=... \
  --build-arg NEXT_PUBLIC_COMMUNITY_URL=... \
  --build-arg NEXT_PUBLIC_FITNESS_URL=... \
  --build-arg NEXT_PUBLIC_RESTAURANTS_URL=... \
  --build-arg NEXT_PUBLIC_NUTRITION_URL=... \
  --build-arg NEXT_PUBLIC_SKIN_URL=... \
  --build-arg NEXT_PUBLIC_COMMUNITY_ENTRY_URL=... \
  .
```

The important flags were:

- `--platform linux/amd64`
- `--provenance=false`
- `--push`

This was needed because Cloud Run rejected earlier OCI index output from Docker Desktop when the image/platform handling was not explicit.

### Step 4. Deploy to Cloud Run

Each service was deployed with:

```bash
gcloud run deploy <service-name> \
  --project logical-contact-485620-v1 \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --image us-central1-docker.pkg.dev/logical-contact-485620-v1/wellbeing-repo/<image>:<tag> \
  --set-env-vars "NODE_ENV=production,AGENT_TIME_ZONE=America/Denver,..." \
  --set-secrets "MONGODB_URI=wellbeing-mongodb-uri:latest,..."
```

### Step 5. Two-pass URL wiring

Because service URLs depend on Cloud Run-assigned hostnames, deployment had to be treated as a two-pass process:

1. Bootstrap missing services so every Cloud Run URL exists
2. Read the real Cloud Run URLs
3. Rebuild and redeploy all services with the final real URL map

Without that second rebuild, client bundles still point at placeholder or old values.

## Navigation Architecture That Ended Up Working

### Same-origin routes through Base

These were made to stay on the Base origin:

- `base -> /community`
- `community -> /` when Community is accessed through Base
- `base -> /skin`
- `base -> /fitness`

This avoids unnecessary auth handoff.

### True cross-service jumps

These still use auth handoff:

- `base -> wellbeing-fitness`
- `base -> wellbeing-restaurants`
- `base -> wellbeing-nutrition`
- `skin -> nutrition`
- `restaurants -> fitness-dashboard`
- any service -> another service when the browser leaves one `*.run.app` host and goes to a different one

## Auth Handoff Issues We Hit

We hit two production issues in the handoff flow.

### 1. `Invalid or expired handoff grant`

Original problem:

- the target service tried to redeem the one-time grant using an exact `targetOrigin === request.nextUrl.origin` check
- Cloud Run host/origin behavior made this brittle

Fix:

- redeem by `handoffId` plus expiration, not by exact request origin match

Affected files:

- [base/src/app/api/auth/handoff/route.ts](/Users/charithpurushotham/Desktop/Wats_Next/base/src/app/api/auth/handoff/route.ts:1)
- [community/src/app/api/auth/handoff/route.ts](/Users/charithpurushotham/Desktop/Wats_Next/community/src/app/api/auth/handoff/route.ts:1)
- [fitness-dashboard/src/app/api/auth/handoff/route.ts](/Users/charithpurushotham/Desktop/Wats_Next/fitness-dashboard/src/app/api/auth/handoff/route.ts:1)
- [nutrition-yelp/src/app/api/auth/handoff/route.ts](/Users/charithpurushotham/Desktop/Wats_Next/nutrition-yelp/src/app/api/auth/handoff/route.ts:1)
- [nutrition-wellness/src/app/api/auth/handoff/route.ts](/Users/charithpurushotham/Desktop/Wats_Next/nutrition-wellness/src/app/api/auth/handoff/route.ts:1)
- [skin-hair-analysis/src/app/api/auth/handoff/route.ts](/Users/charithpurushotham/Desktop/Wats_Next/skin-hair-analysis/src/app/api/auth/handoff/route.ts:1)

### 2. Redirects landing on `https://0.0.0.0:8080/`

Original problem:

- after redeeming a handoff, redirect code used `request.nextUrl.origin`
- inside the container that can resolve to the bind host rather than the public service host

Fix:

- redirect using the stored `handoff.targetOrigin`

That same fix was applied in all six handoff route files listed above.

## Self-Link Navigation

Another issue was that services could trigger auth handoff even when clicking their own nav button.

Example:

- Community clicking `Community`
- Fitness Dashboard clicking `Dashboard`

That should not navigate at all. Those self-links were disabled in the nav UI instead of sending them through handoff.

Affected files:

- [community/src/components/Navigation.tsx](/Users/charithpurushotham/Desktop/Wats_Next/community/src/components/Navigation.tsx:1)
- [fitness-dashboard/src/components/Navigation.tsx](/Users/charithpurushotham/Desktop/Wats_Next/fitness-dashboard/src/components/Navigation.tsx:1)

## Base-Specific Fixes

### Community from Base

Base was updated so Community uses local `/community` instead of external handoff.

Affected files:

- [base/src/components/Navigation.tsx](/Users/charithpurushotham/Desktop/Wats_Next/base/src/components/Navigation.tsx:1)
- [base/src/components/FitnessNavigation.tsx](/Users/charithpurushotham/Desktop/Wats_Next/base/src/components/FitnessNavigation.tsx:1)

### Home screen CTA buttons

The Base landing page still had hardcoded localhost targets. These were fixed so:

- Community CTA uses `/community`
- Skin CTA uses `/skin`
- Nutrition and Restaurants CTAs use handoff with real production URLs

Affected file:

- [base/src/app/page.tsx](/Users/charithpurushotham/Desktop/Wats_Next/base/src/app/page.tsx:1)

## Script Used

A deployment helper script was created:

- [scripts/deploy-cloud-run.sh](/Users/charithpurushotham/Desktop/Wats_Next/scripts/deploy-cloud-run.sh:1)

Purpose:

- fetch secrets
- build and push images
- deploy services
- do a two-pass rollout so final URLs are baked into the client bundles

Note:

During debugging, some deploys were also run directly with inline shell commands instead of only through the script.

## Verification

After the final rollout, Cloud Run reported all 6 services healthy:

```bash
gcloud run services list --region us-central1
```

Expected result:

- `wellbeing-base` healthy
- `wellbeing-community` healthy
- `wellbeing-fitness` healthy
- `wellbeing-restaurants` healthy
- `wellbeing-nutrition` healthy
- `wellbeing-skin-hair` healthy

## If You Need To Re-Deploy Later

Use this order:

1. Verify the correct account and project
2. Confirm required secrets exist in Secret Manager
3. Build and push all images with the real `NEXT_PUBLIC_*` URL args
4. Deploy all 6 Cloud Run services with matching runtime env vars
5. Hard-refresh the browser before validating navigation, because old JS bundles can continue to reference stale hosts like `placeholder.invalid`

## Important Warning

Do not assume Cloud Run runtime env alone is enough for this repo.

For these services, if a public URL changes, you must rebuild the affected Docker images because the Next.js client bundle embeds `NEXT_PUBLIC_*` values at build time.
