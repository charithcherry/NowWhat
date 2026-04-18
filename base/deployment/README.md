# Deploying Base Microservice to GCP Cloud Run

This guide provides instructions for containerizing and deploying the **Base** microservice independently.

## Prerequisites

1. [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed and authenticated.
2. [Docker](https://www.docker.com/products/docker-desktop/) installed.
3. Access to a GCP project with Artifact Registry and Cloud Run APIs enabled.

## Environment Variables

Ensure you have the following secrets/variables ready:
- `MONGODB_URI`: Connection string for MongoDB.
- `JWT_SECRET`: Shared secret for session signing.
- `NEXT_PUBLIC_BASE_URL`: The final URL of this service (once deployed).
- `NEXT_PUBLIC_FITNESS_URL`, `NEXT_PUBLIC_NUTRITION_URL`, etc.: URLs of the other microservices.

## Deployment Steps

### 1. Configure GCP
```bash
# Set your project ID
gcloud config set project [YOUR_PROJECT_ID]

# Enable required services
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

### 2. Create Artifact Registry
```bash
gcloud artifacts repositories create wellbeing-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository for WellBeing microservices"
```

### 3. Build and Push Image
Run these commands from the **root of the `base` directory**:
```bash
# Build the image using the deployment Dockerfile
docker build -t us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/wellbeing-repo/base:latest -f deployment/Dockerfile .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/wellbeing-repo/base:latest
```

### 4. Deploy to Cloud Run
```bash
gcloud run deploy wellbeing-base \
    --image us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/wellbeing-repo/base:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="MONGODB_URI=[SECRET],JWT_SECRET=[SECRET],NEXT_PUBLIC_BASE_URL=[YOUR_URL]"
```

## Local Testing
To test the Docker container locally:
```bash
docker build -t wellbeing-base -f deployment/Dockerfile .
docker run -p 8080:8080 --env-file .env.local wellbeing-base
```
