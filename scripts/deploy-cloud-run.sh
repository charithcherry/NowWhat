#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID="${PROJECT_ID:-logical-contact-485620-v1}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-wellbeing-repo}"
TAG="${TAG:-$(date +%Y%m%d-%H%M%S)}"
AGENT_TIME_ZONE="${AGENT_TIME_ZONE:-America/Denver}"
PLACEHOLDER_URL="${PLACEHOLDER_URL:-https://placeholder.invalid}"

SERVICES=(
  "base"
  "community"
  "fitness-dashboard"
  "nutrition-yelp"
  "nutrition-wellness"
  "skin-hair-analysis"
)

service_dir() {
  case "$1" in
    base) echo "base" ;;
    community) echo "community" ;;
    fitness-dashboard) echo "fitness-dashboard" ;;
    nutrition-yelp) echo "nutrition-yelp" ;;
    nutrition-wellness) echo "nutrition-wellness" ;;
    skin-hair-analysis) echo "skin-hair-analysis" ;;
    *) echo "unknown service: $1" >&2; exit 1 ;;
  esac
}

service_name() {
  case "$1" in
    base) echo "wellbeing-base" ;;
    community) echo "wellbeing-community" ;;
    fitness-dashboard) echo "wellbeing-fitness" ;;
    nutrition-yelp) echo "wellbeing-restaurants" ;;
    nutrition-wellness) echo "wellbeing-nutrition" ;;
    skin-hair-analysis) echo "wellbeing-skin-hair" ;;
    *) echo "unknown service: $1" >&2; exit 1 ;;
  esac
}

image_name() {
  case "$1" in
    base) echo "base" ;;
    community) echo "community" ;;
    fitness-dashboard) echo "fitness" ;;
    nutrition-yelp) echo "restaurants" ;;
    nutrition-wellness) echo "nutrition" ;;
    skin-hair-analysis) echo "skin-hair" ;;
    *) echo "unknown service: $1" >&2; exit 1 ;;
  esac
}

service_url_key() {
  case "$1" in
    base) echo "NEXT_PUBLIC_BASE_URL" ;;
    community) echo "NEXT_PUBLIC_COMMUNITY_URL" ;;
    fitness-dashboard) echo "NEXT_PUBLIC_FITNESS_URL" ;;
    nutrition-yelp) echo "NEXT_PUBLIC_RESTAURANTS_URL" ;;
    nutrition-wellness) echo "NEXT_PUBLIC_NUTRITION_URL" ;;
    skin-hair-analysis) echo "NEXT_PUBLIC_SKIN_URL" ;;
    *) echo "unknown service: $1" >&2; exit 1 ;;
  esac
}

runtime_secrets() {
  case "$1" in
    base)
      echo "MONGODB_URI=wellbeing-mongodb-uri:latest,MONGODB_DB=wellbeing-mongodb-db:latest,GEMINI_API_KEY=wellbeing-gemini-api-key:latest,NEXT_PUBLIC_ELEVENLABS_API_KEY=wellbeing-elevenlabs-api-key:latest"
      ;;
    community)
      echo "MONGODB_URI=wellbeing-mongodb-uri:latest,MONGODB_DB=wellbeing-mongodb-db:latest,GEMINI_API_KEY=wellbeing-gemini-api-key:latest"
      ;;
    fitness-dashboard)
      echo "MONGODB_URI=wellbeing-mongodb-uri:latest,MONGODB_DB=wellbeing-mongodb-db:latest,GEMINI_API_KEY=wellbeing-gemini-api-key:latest"
      ;;
    nutrition-yelp)
      echo "MONGODB_URI=wellbeing-mongodb-uri:latest,MONGODB_DB=wellbeing-mongodb-db:latest,GEMINI_API_KEY=wellbeing-gemini-api-key:latest,YELP_API_KEY=wellbeing-yelp-api-key:latest"
      ;;
    nutrition-wellness)
      echo "MONGODB_URI=wellbeing-mongodb-uri:latest,MONGODB_DB=wellbeing-mongodb-db:latest,GEMINI_API_KEY=wellbeing-gemini-api-key:latest,NUTRITION_MEMORY_CRON_SECRET=wellbeing-nutrition-memory-cron-secret:latest"
      ;;
    skin-hair-analysis)
      echo "MONGODB_URI=wellbeing-mongodb-uri:latest,MONGODB_DB=wellbeing-mongodb-db:latest,GEMINI_API_KEY=wellbeing-gemini-api-key:latest"
      ;;
    *) echo "unknown service: $1" >&2; exit 1 ;;
  esac
}

secret_value() {
  gcloud secrets versions access latest \
    --project "$PROJECT_ID" \
    --secret "$1" 2>/dev/null
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

join_csv() {
  local IFS=","
  echo "$*"
}

build_and_push() {
  local service="$1"
  local dir image dockerfile
  dir="$(service_dir "$service")"
  image="us-central1-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/$(image_name "$service"):${TAG}"
  dockerfile="${ROOT_DIR}/${dir}/deployment/Dockerfile"

  echo "==> Building ${service} -> ${image}" >&2
  (
    cd "${ROOT_DIR}/${dir}"
    docker buildx build \
      --platform linux/amd64 \
      --provenance=false \
      --push \
      -f "$dockerfile" \
      -t "$image" \
      --build-arg "MONGODB_URI=${MONGODB_URI}" \
      --build-arg "MONGODB_DB=${MONGODB_DB}" \
      --build-arg "GEMINI_API_KEY=${GEMINI_API_KEY}" \
      --build-arg "YELP_API_KEY=${YELP_API_KEY}" \
      --build-arg "NUTRITION_MEMORY_CRON_SECRET=${NUTRITION_MEMORY_CRON_SECRET}" \
      --build-arg "NEXT_PUBLIC_ELEVENLABS_API_KEY=${NEXT_PUBLIC_ELEVENLABS_API_KEY}" \
      --build-arg "NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}" \
      --build-arg "NEXT_PUBLIC_FITNESS_URL=${NEXT_PUBLIC_FITNESS_URL}" \
      --build-arg "NEXT_PUBLIC_NUTRITION_URL=${NEXT_PUBLIC_NUTRITION_URL}" \
      --build-arg "NEXT_PUBLIC_RESTAURANTS_URL=${NEXT_PUBLIC_RESTAURANTS_URL}" \
      --build-arg "NEXT_PUBLIC_SKIN_URL=${NEXT_PUBLIC_SKIN_URL}" \
      --build-arg "NEXT_PUBLIC_COMMUNITY_URL=${NEXT_PUBLIC_COMMUNITY_URL}" \
      --build-arg "NEXT_PUBLIC_COMMUNITY_ENTRY_URL=${NEXT_PUBLIC_COMMUNITY_ENTRY_URL}" \
      --build-arg "AGENT_TIME_ZONE=${AGENT_TIME_ZONE}" \
      . >&2
  )
  printf '%s\n' "$image"
}

deploy_service() {
  local service="$1"
  local image="$2"
  local service_name_value env_csv secrets_csv
  service_name_value="$(service_name "$service")"
  secrets_csv="$(runtime_secrets "$service")"
  env_csv="$(join_csv \
    "NODE_ENV=production" \
    "AGENT_TIME_ZONE=${AGENT_TIME_ZONE}" \
    "NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}" \
    "NEXT_PUBLIC_FITNESS_URL=${NEXT_PUBLIC_FITNESS_URL}" \
    "NEXT_PUBLIC_NUTRITION_URL=${NEXT_PUBLIC_NUTRITION_URL}" \
    "NEXT_PUBLIC_RESTAURANTS_URL=${NEXT_PUBLIC_RESTAURANTS_URL}" \
    "NEXT_PUBLIC_SKIN_URL=${NEXT_PUBLIC_SKIN_URL}" \
    "NEXT_PUBLIC_COMMUNITY_URL=${NEXT_PUBLIC_COMMUNITY_URL}" \
    "NEXT_PUBLIC_COMMUNITY_ENTRY_URL=${NEXT_PUBLIC_COMMUNITY_ENTRY_URL}")"

  echo "==> Deploying ${service_name_value}"
  gcloud run deploy "$service_name_value" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --image "$image" \
    --set-env-vars "$env_csv" \
    --set-secrets "$secrets_csv" \
    >/dev/null
}

fetch_service_url() {
  gcloud run services describe "$(service_name "$1")" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --platform managed \
    --format='value(status.url)'
}

assign_urls() {
  NEXT_PUBLIC_BASE_URL="$1"
  NEXT_PUBLIC_FITNESS_URL="$2"
  NEXT_PUBLIC_NUTRITION_URL="$3"
  NEXT_PUBLIC_RESTAURANTS_URL="$4"
  NEXT_PUBLIC_SKIN_URL="$5"
  NEXT_PUBLIC_COMMUNITY_URL="$6"
  NEXT_PUBLIC_COMMUNITY_ENTRY_URL="${NEXT_PUBLIC_BASE_URL%/}/community"
  export NEXT_PUBLIC_BASE_URL
  export NEXT_PUBLIC_FITNESS_URL
  export NEXT_PUBLIC_NUTRITION_URL
  export NEXT_PUBLIC_RESTAURANTS_URL
  export NEXT_PUBLIC_SKIN_URL
  export NEXT_PUBLIC_COMMUNITY_URL
  export NEXT_PUBLIC_COMMUNITY_ENTRY_URL
}

print_urls() {
  echo "Base:        ${NEXT_PUBLIC_BASE_URL}"
  echo "Fitness:     ${NEXT_PUBLIC_FITNESS_URL}"
  echo "Nutrition:   ${NEXT_PUBLIC_NUTRITION_URL}"
  echo "Restaurants: ${NEXT_PUBLIC_RESTAURANTS_URL}"
  echo "Skin/Hair:   ${NEXT_PUBLIC_SKIN_URL}"
  echo "Community:   ${NEXT_PUBLIC_COMMUNITY_URL}"
  echo "Community entry: ${NEXT_PUBLIC_COMMUNITY_ENTRY_URL}"
}

require_cmd gcloud
require_cmd docker

if ! docker buildx version >/dev/null 2>&1; then
  echo "missing required docker buildx support" >&2
  exit 1
fi

gcloud config set project "$PROJECT_ID" >/dev/null
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  --project "$PROJECT_ID" >/dev/null

if ! gcloud artifacts repositories describe "$REPOSITORY" \
  --project "$PROJECT_ID" \
  --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPOSITORY" \
    --project "$PROJECT_ID" \
    --repository-format=docker \
    --location "$REGION" \
    --description="Docker repository for WellBeing microservices" >/dev/null
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet >/dev/null

MONGODB_URI="$(secret_value wellbeing-mongodb-uri)"
MONGODB_DB="$(secret_value wellbeing-mongodb-db)"
GEMINI_API_KEY="$(secret_value wellbeing-gemini-api-key)"
YELP_API_KEY="$(secret_value wellbeing-yelp-api-key)"
NUTRITION_MEMORY_CRON_SECRET="$(secret_value wellbeing-nutrition-memory-cron-secret)"
NEXT_PUBLIC_ELEVENLABS_API_KEY="$(secret_value wellbeing-elevenlabs-api-key)"

export MONGODB_URI
export MONGODB_DB
export GEMINI_API_KEY
export YELP_API_KEY
export NUTRITION_MEMORY_CRON_SECRET
export NEXT_PUBLIC_ELEVENLABS_API_KEY
export AGENT_TIME_ZONE

assign_urls \
  "$PLACEHOLDER_URL" \
  "$PLACEHOLDER_URL" \
  "$PLACEHOLDER_URL" \
  "$PLACEHOLDER_URL" \
  "$PLACEHOLDER_URL" \
  "$PLACEHOLDER_URL"

echo "==> Pass 1: bootstrap services to obtain Cloud Run URLs"
for service in "${SERVICES[@]}"; do
  image="$(build_and_push "$service")"
  deploy_service "$service" "$image"
done

BASE_URL="$(fetch_service_url base)"
COMMUNITY_URL="$(fetch_service_url community)"
FITNESS_URL="$(fetch_service_url fitness-dashboard)"
RESTAURANTS_URL="$(fetch_service_url nutrition-yelp)"
NUTRITION_URL="$(fetch_service_url nutrition-wellness)"
SKIN_URL="$(fetch_service_url skin-hair-analysis)"

assign_urls \
  "$BASE_URL" \
  "$FITNESS_URL" \
  "$NUTRITION_URL" \
  "$RESTAURANTS_URL" \
  "$SKIN_URL" \
  "$COMMUNITY_URL"

echo "==> Pass 2: rebuild with real production URLs"
for service in "${SERVICES[@]}"; do
  image="$(build_and_push "$service")"
  deploy_service "$service" "$image"
done

echo "==> Deployment complete"
print_urls
