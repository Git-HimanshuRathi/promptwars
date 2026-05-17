###############################################################################
# LEXGUARD — Minimal GCP infra
# Just enough to ship: Cloud Run (api + web), Artifact Registry, Secret Manager.
# No Cloud SQL, no Redis, no KMS bucket. The API is stateless.
###############################################################################

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}

provider "google" {
  project = var.gcp_project
  region  = var.gcp_region
}

# ── APIs ──────────────────────────────────────────────────────────────────
locals {
  services = [
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "aiplatform.googleapis.com",
    "logging.googleapis.com",
    "iam.googleapis.com",
  ]
}

resource "google_project_service" "enabled" {
  for_each           = toset(local.services)
  service            = each.value
  disable_on_destroy = false
}

# ── Artifact Registry ─────────────────────────────────────────────────────
resource "google_artifact_registry_repository" "lexguard" {
  location      = var.gcp_region
  repository_id = "lexguard"
  description   = "LEXGUARD container images"
  format        = "DOCKER"
  depends_on    = [google_project_service.enabled]
}

# ── Secrets ───────────────────────────────────────────────────────────────
resource "google_secret_manager_secret" "gemini" {
  secret_id = "gemini-api-key"
  replication { auto {} }
  depends_on = [google_project_service.enabled]
}

# ── Service account for Cloud Run ─────────────────────────────────────────
resource "google_service_account" "api" {
  account_id   = "lexguard-api"
  display_name = "LEXGUARD API runtime"
}

resource "google_project_iam_member" "api_roles" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/aiplatform.user",
    "roles/logging.logWriter",
  ])
  project = var.gcp_project
  role    = each.value
  member  = "serviceAccount:${google_service_account.api.email}"
}

# ── Cloud Run — API ───────────────────────────────────────────────────────
resource "google_cloud_run_v2_service" "api" {
  name     = "lexguard-api"
  location = var.gcp_region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.api.email
    scaling {
      max_instance_count = 5
      min_instance_count = 0
    }

    containers {
      image = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project}/lexguard/api:${var.image_tag}"
      ports { container_port = 8080 }
      resources {
        limits   = { cpu = "1", memory = "1Gi" }
        cpu_idle = true
      }
      # Vertex AI is the primary provider on Cloud Run — uses the runtime SA
      # via ADC, so no API key needed. The Secret Manager-backed Gemini key
      # below is a safety-net fallback if Vertex hits an outage.
      env { name = "USE_VERTEX_AI",        value = "true" }
      env { name = "GOOGLE_CLOUD_PROJECT", value = var.gcp_project }
      env { name = "VERTEX_AI_LOCATION",   value = var.gcp_region }

      # Tell the API to resolve this Secret Manager reference at boot rather
      # than mounting the secret as an env var (which would only refresh on
      # container restart).
      env { name = "GEMINI_API_KEY_SECRET", value = google_secret_manager_secret.gemini.secret_id }

      env { name = "NODE_ENV",     value = "production" }
      env { name = "CORS_ORIGINS", value = "https://${var.web_domain}" }

      startup_probe {
        http_get { path = "/healthz" }
        period_seconds    = 10
        timeout_seconds   = 3
        failure_threshold = 6
      }
      liveness_probe {
        http_get { path = "/healthz" }
        period_seconds = 30
      }
    }
  }
  depends_on = [google_project_iam_member.api_roles]
}

# ── Cloud Run — Web ───────────────────────────────────────────────────────
resource "google_cloud_run_v2_service" "web" {
  name     = "lexguard-web"
  location = var.gcp_region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = 5
      min_instance_count = 0
    }
    containers {
      image = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project}/lexguard/web:${var.image_tag}"
      ports { container_port = 8080 }
      resources { limits = { cpu = "1", memory = "512Mi" } }
      env { name = "NEXT_PUBLIC_API_URL", value = google_cloud_run_v2_service.api.uri }
      env { name = "NODE_ENV",            value = "production" }
    }
  }
}

# Public access for web + api (api is rate-limited, no auth required for the demo)
resource "google_cloud_run_v2_service_iam_member" "web_public" {
  name     = google_cloud_run_v2_service.web.name
  location = google_cloud_run_v2_service.web.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
