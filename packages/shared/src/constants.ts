export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_DOC_CHARS = 250_000; // hard cap for AI ingestion
export const MAX_CLAUSES_PER_DOC = 400;

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
] as const;

export const DOCUMENT_TYPES = [
  'contract',
  'offer_letter',
  'quotation',
  'ticket_terms',
  'privacy_policy',
  'tos',
  'saas_agreement',
  'nda',
  'lease',
  'other',
] as const;

export const RISK_CATEGORIES = [
  'exploitative',
  'hidden_liability',
  'legal_ambiguity',
  'one_sided',
  'financial_risk',
  'data_privacy',
  'auto_renewal',
  'cancellation_trap',
  'arbitration_trap',
  'indemnity',
  'ip_assignment',
  'non_compete',
  'jurisdiction',
  'limitation_of_liability',
  'dark_pattern',
] as const;

export const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'info'] as const;
