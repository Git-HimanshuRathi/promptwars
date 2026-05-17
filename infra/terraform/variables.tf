variable "gcp_project" {
  type        = string
  description = "GCP project ID hosting LEXGUARD"
}

variable "gcp_region" {
  type        = string
  default     = "us-central1"
  description = "Primary GCP region"
}

variable "image_tag" {
  type        = string
  default     = "latest"
  description = "Container image tag to deploy"
}

variable "db_tier" {
  type        = string
  default     = "db-custom-1-3840"
  description = "Cloud SQL machine tier"
}

variable "web_domain" {
  type        = string
  default     = "lexguard.app"
  description = "Public domain for CORS allow-list"
}
