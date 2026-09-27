export type FileRiskRecord = {
  file_path: string;
  commit_count: number;
  lines_added: number;
  lines_deleted: number;
  churn: number;
  revert_count: number;
  hotfix_count: number;
  bug_fix_count: number;
  bug_fix_ratio: number;
  last_modified_at: string | null;
  incident_count: number;
  recent_incident_count: number;
  sensitivity_tags: string[];
  blast_radius: number;
  updated_at: string;
};

export type IncidentRecord = {
  incident_id: string;
  date: string;
  title: string;
  files: string[];
  services: string[];
  severity: string;
};

export type ScoreRequest = {
  pr_id: string;
  changed_files: string[];
};

export type ScoreResponse = {
  risk_score: number;
  risk_tier: 'low' | 'medium' | 'high';
  driving_files: string[];
  driving_reasons: string[];
  related_incidents: string[];
};
