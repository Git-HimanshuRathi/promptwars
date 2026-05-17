import { z } from 'zod';
import {
  DOCUMENT_TYPES,
  RISK_CATEGORIES,
  SEVERITY_LEVELS,
  MAX_UPLOAD_BYTES,
} from './constants.js';

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export const riskCategorySchema = z.enum(RISK_CATEGORIES);
export const severitySchema = z.enum(SEVERITY_LEVELS);

export const agentNameSchema = z.enum([
  'risk_detection',
  'ambiguity',
  'privacy',
  'financial',
  'simplification',
  'user_advocate',
  'counterargument',
  'aggregator',
]);

export const clauseFindingSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(8000),
  span: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  category: riskCategorySchema,
  severity: severitySchema,
  riskScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  plainEnglish: z.string().min(1).max(2000),
  recommendation: z.string().min(1).max(2000),
  saferAlternative: z.string().max(4000).optional(),
  agent: agentNameSchema,
  citations: z.array(z.string()).max(20).optional(),
});

export const agentDebateTurnSchema = z.object({
  agent: agentNameSchema,
  argument: z.string().min(1).max(4000),
  agrees: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export const analysisResultSchema = z.object({
  documentId: z.string().uuid(),
  documentType: documentTypeSchema,
  overallRiskScore: z.number().min(0).max(100),
  riskBand: z.enum(['safe', 'caution', 'high_risk', 'dangerous']),
  summary: z.string().min(1).max(4000),
  executiveSummary: z.string().min(1).max(4000),
  findings: z.array(clauseFindingSchema).max(500),
  debate: z.array(agentDebateTurnSchema).max(50),
  recommendedActions: z.array(z.string().max(500)).max(20),
  categoryBreakdown: z.record(riskCategorySchema, z.number().nonnegative()),
  modelUsed: z.string(),
  durationMs: z.number().nonnegative(),
  createdAt: z.string(),
});

export const analyzeTextRequestSchema = z.object({
  text: z.string().min(50).max(250_000),
  documentType: documentTypeSchema.default('other'),
  jurisdiction: z.string().max(64).optional(),
  language: z.string().max(8).default('en'),
});

export const uploadMetadataSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[\w\-. ()]+\.(pdf|docx|doc|txt|md)$/i, 'invalid filename'),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  mimeType: z.string().max(128),
  documentType: documentTypeSchema.default('other'),
});

export type AnalyzeTextRequest = z.infer<typeof analyzeTextRequestSchema>;
export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
