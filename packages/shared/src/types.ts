import type {
  DOCUMENT_TYPES,
  RISK_CATEGORIES,
  SEVERITY_LEVELS,
} from './constants.js';

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type RiskCategory = (typeof RISK_CATEGORIES)[number];
export type Severity = (typeof SEVERITY_LEVELS)[number];

export type AgentName =
  | 'risk_detection'
  | 'ambiguity'
  | 'privacy'
  | 'financial'
  | 'simplification'
  | 'user_advocate'
  | 'counterargument'
  | 'aggregator';

export interface ClauseFinding {
  id: string;
  /** Original clause text from the document */
  text: string;
  /** Character offsets into the source text [start, end] */
  span: [number, number];
  category: RiskCategory;
  severity: Severity;
  /** 0-100 */
  riskScore: number;
  /** 0-1 */
  confidence: number;
  plainEnglish: string;
  recommendation: string;
  saferAlternative?: string;
  agent: AgentName;
  citations?: string[];
}

export interface AgentDebateTurn {
  agent: AgentName;
  argument: string;
  agrees: boolean;
  confidence: number;
}

export interface AnalysisResult {
  documentId: string;
  documentType: DocumentType;
  /** 0-100 — higher = riskier */
  overallRiskScore: number;
  riskBand: 'safe' | 'caution' | 'high_risk' | 'dangerous';
  summary: string;
  executiveSummary: string;
  findings: ClauseFinding[];
  debate: AgentDebateTurn[];
  recommendedActions: string[];
  /** Distribution of findings per category */
  categoryBreakdown: Record<RiskCategory, number>;
  modelUsed: string;
  durationMs: number;
  createdAt: string;
}

export interface UploadResponse {
  documentId: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
}

export interface AnalysisProgressEvent {
  type: 'started' | 'agent' | 'partial' | 'completed' | 'error';
  agent?: AgentName;
  message?: string;
  progress?: number; // 0-1
  partial?: Partial<AnalysisResult>;
  error?: string;
}
