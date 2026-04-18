# Deploying Restaurants (Yelp) Microservice to GCP Cloud Run

This guide provides instructions for containerizing and deploying the **Restaurants** microservice independently.

## Prerequisites

1. [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed and authenticated.
2. [Docker](https://www.docker.com/products/docker-desktop/) installed.

## Environment Variables

Ensure you have the following ready:
- `MONGODB_URI`: Connection string for MongoDB.
- `YELP_API_KEY`: API key for Yelp Fusion.
- `NEXT_PUBLIC_BASE_URL`: The URL of the **Base** microservice (e.g. `https://base-xxx.a.run.app`).
- `NEXT_PUBLIC_RESTAURANTS_URL`: The final URL of **this** service (e.g. `https://restaurants-xxx.a.run.app`).

## Deployment Steps

### 1. Build and Push Image
Run these commands from the **root of the `nutrition-yelp` directory**:
```bash
# Build the image
docker build -t us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/wellbeing-repo/restaurants:latest -f deployment/Dockerfile .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/wellbeing-repo/restaurants:latest
```

### 2. Deploy to Cloud Run
```bash
gcloud run deploy wellbeing-restaurants \
    --image us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/wellbeing-repo/restaurants:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="MONGODB_URI=[SECRET],YELP_API_KEY=[SECRET],NEXT_PUBLIC_BASE_URL=[YOUR_BASE_URL],NEXT_PUBLIC_RESTAURANTS_URL=[YOUR_RESTAURANTS_URL]"
```

## Local Testing
```bash
docker build -t wellbeing-restaurants -f deployment/Dockerfile .
docker run -p 8080:8080 --env-file .env.local wellbeing-restaurants
```
