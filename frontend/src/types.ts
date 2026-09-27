export type RiskTier = 'low' | 'medium' | 'high';

export interface ScoreRequest {
  pr_id: string;
  changed_files: string[];
}

export interface ScoreResponse {
  risk_score: number;
  risk_tier: RiskTier;
  driving_files: string[];
  driving_reasons: string[];
  related_incidents: string[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface HistoryEntry {
  pr_id: string;
  timestamp: string;
  result: ScoreResponse;
}
