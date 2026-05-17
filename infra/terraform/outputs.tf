output "api_url" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Public HTTPS URL of the API service"
}

output "web_url" {
  value       = google_cloud_run_v2_service.web.uri
  description = "Public HTTPS URL of the web frontend"
}

output "registry_repo" {
  value       = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project}/lexguard"
  description = "Artifact Registry repository for container images"
}

output "gemini_secret" {
  value       = google_secret_manager_secret.gemini.id
  description = "Set the Gemini API key with: gcloud secrets versions add gemini-api-key --data-file=-"
}
