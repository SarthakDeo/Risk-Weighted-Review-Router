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

export type RiskTier = 'low' | 'medium' | 'high';

export type ChangedFile = {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  previous_filename?: string;
};

export type PRMetadata = {
  pr_id: number;
  repo: string;
  owner: string;
  repo_name: string;
  number: number;
  author: string;
  title: string;
  base_sha: string;
  head_sha: string;
  changed_files: ChangedFile[];
  installation_id: number;
};

export type TierRequirements = {
  label: string;
  required_approvals: number;
  require_reviewer_with_history: boolean;
  checklist_id: string;
  status_check_name: string;
  description: string;
};

export type ScoreResponse = {
  risk_score: number;
  risk_tier: 'low' | 'medium' | 'high';
  driving_files: string[];
  driving_reasons: string[];
  related_incidents: string[];
};
