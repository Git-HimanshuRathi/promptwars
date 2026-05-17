#!/usr/bin/env bash
# LEXGUARD — one-shot Cloud Run deploy
# Usage: ./scripts/deploy-gcp.sh <PROJECT_ID> [REGION]
set -euo pipefail

PROJECT_ID="${1:-}"
REGION="${2:-us-central1}"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 <PROJECT_ID> [REGION]"
  exit 1
fi

REPO="$REGION-docker.pkg.dev/$PROJECT_ID/lexguard"
TAG="$(git rev-parse --short HEAD 2>/dev/null || echo latest)"
TMPDIR_CB="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_CB"' EXIT

echo "▸ Setting project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

echo "▸ Enabling required APIs"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com --quiet

echo "▸ Creating Artifact Registry repo (idempotent)"
gcloud artifacts repositories create lexguard \
  --repository-format=docker --location="$REGION" --quiet 2>/dev/null || true

echo "▸ Configuring Docker auth"
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

if ! gcloud secrets describe gemini-api-key >/dev/null 2>&1; then
  echo "▸ Creating gemini-api-key secret"
  echo "  → Paste your Gemini API key and press Ctrl+D:"
  gcloud secrets create gemini-api-key --replication-policy=automatic --data-file=-
fi

echo "▸ Building + pushing API image"
cat > "$TMPDIR_CB/cloudbuild-api.yaml" <<EOF
steps:
- name: gcr.io/cloud-builders/docker
  args: ['build', '-f', 'apps/api/Dockerfile', '-t', '$REPO/api:$TAG', '.']
- name: gcr.io/cloud-builders/docker
  args: ['push', '$REPO/api:$TAG']
images:
- '$REPO/api:$TAG'
EOF
gcloud builds submit --config="$TMPDIR_CB/cloudbuild-api.yaml" .

# Grant the default Cloud Run service account access to Secret Manager + Vertex AI.
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
DEFAULT_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for ROLE in roles/secretmanager.secretAccessor roles/aiplatform.user roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEFAULT_SA}" --role="$ROLE" --quiet >/dev/null
done

echo "▸ Deploying API to Cloud Run"
API_URL=$(gcloud run deploy lexguard-api \
  --image="$REPO/api:$TAG" \
  --region="$REGION" \
  --allow-unauthenticated \
  --set-env-vars=NODE_ENV=production,USE_VERTEX_AI=true,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,VERTEX_AI_LOCATION=$REGION,GEMINI_API_KEY_SECRET=gemini-api-key \
  --memory=1Gi --cpu=1 --max-instances=5 \
  --format='value(status.url)')

echo "▸ API live at: $API_URL"

echo "▸ Building + pushing Web image"
cat > "$TMPDIR_CB/cloudbuild-web.yaml" <<EOF
steps:
- name: gcr.io/cloud-builders/docker
  args: ['build', '-f', 'apps/web/Dockerfile', '--build-arg', 'NEXT_PUBLIC_API_URL=$API_URL', '-t', '$REPO/web:$TAG', '.']
- name: gcr.io/cloud-builders/docker
  args: ['push', '$REPO/web:$TAG']
images:
- '$REPO/web:$TAG'
EOF
gcloud builds submit --config="$TMPDIR_CB/cloudbuild-web.yaml" .

echo "▸ Deploying Web to Cloud Run"
WEB_URL=$(gcloud run deploy lexguard-web \
  --image="$REPO/web:$TAG" \
  --region="$REGION" \
  --allow-unauthenticated \
  --set-env-vars=NEXT_PUBLIC_API_URL=$API_URL,NODE_ENV=production \
  --memory=512Mi --cpu=1 --max-instances=5 \
  --format='value(status.url)')

echo ""
echo "✓ Deployed."
echo "  Web: $WEB_URL"
echo "  API: $API_URL"
