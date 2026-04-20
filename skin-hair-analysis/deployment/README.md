# Deploying Skin & Hair Analysis Microservice to GCP Cloud Run

This guide provides instructions for containerizing and deploying the **Skin & Hair Analysis** microservice independently.

## Prerequisites

1. [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed and authenticated.
2. [Docker](https://www.docker.com/products/docker-desktop/) installed.

## Environment Variables

Ensure you have the following ready:
- `MONGODB_URI`: Connection string for MongoDB.
- `GEMINI_API_KEY`: API key for Gemini AI.
- `NEXT_PUBLIC_BASE_URL`: The URL of the **Base** microservice (e.g. `https://base-xxx.a.run.app`).
- `NEXT_PUBLIC_SKIN_URL`: The final URL of **this** service (e.g. `https://skin-xxx.a.run.app`).
- `NEXT_PUBLIC_FITNESS_URL`: The URL of the fitness dashboard service.
- `NEXT_PUBLIC_NUTRITION_URL`: The URL of the nutrition wellness service.
- `NEXT_PUBLIC_RESTAURANTS_URL`: The URL of the restaurants service.
- `NEXT_PUBLIC_COMMUNITY_URL`: The URL of the community service, including `/community`.

Every deployed service must know the full set of sibling service URLs. The auth handoff allowlist uses these values in production.

## Deployment Steps

### 1. Build and Push Image
Run these commands from the **root of the `skin-hair-analysis` directory**:
```bash
# Build the image
docker build -t us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/wellbeing-repo/skin-hair:latest -f deployment/Dockerfile .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/wellbeing-repo/skin-hair:latest
```

### 2. Deploy to Cloud Run
```bash
gcloud run deploy wellbeing-skin-hair \
    --image us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/wellbeing-repo/skin-hair:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="MONGODB_URI=[SECRET],GEMINI_API_KEY=[SECRET],NEXT_PUBLIC_BASE_URL=[YOUR_BASE_URL],NEXT_PUBLIC_FITNESS_URL=[YOUR_FITNESS_URL],NEXT_PUBLIC_NUTRITION_URL=[YOUR_NUTRITION_URL],NEXT_PUBLIC_RESTAURANTS_URL=[YOUR_RESTAURANTS_URL],NEXT_PUBLIC_SKIN_URL=[YOUR_SKIN_URL],NEXT_PUBLIC_COMMUNITY_URL=[YOUR_COMMUNITY_URL]"
```

## Local Testing
```bash
docker build -t wellbeing-skin-hair -f deployment/Dockerfile .
docker run -p 8080:8080 --env-file .env.local wellbeing-skin-hair
```
