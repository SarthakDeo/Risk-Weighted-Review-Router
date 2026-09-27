import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export type RiskConfig = {
  scoring: {
    weights: {
      incident: number;
      revert: number;
      hotfix: number;
      bug_fix: number;
      churn: number;
      sensitivity: number;
      blast_radius: number;
    };
    normalize: {
      incident_max: number;
      revert_max: number;
      hotfix_max: number;
      bug_fix_max: number;
      churn_max: number;
      blast_radius_max: number;
    };
    tiers: {
      low_max: number;
      medium_max: number;
    };
    incident_window_days: number;
    tags: Record<string, number>;
    feature_flags: { enable_sensitivity: boolean; enable_blast_radius: boolean; enable_feedback_loop: boolean };
  };
};

export type SensitivityConfig = {
  categories: Record<string, { patterns: string[] }>;
};

export type HotfixPatterns = {
  keywords: string[];
  bugfix_keywords: string[];
};

function loadYaml<T>(relativePath: string): T {
  const filePath = path.resolve(process.cwd(), relativePath);
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content) as T;
}

export const config = loadYaml<RiskConfig>('config/scoring.yaml');
export const sensitivityConfig = loadYaml<SensitivityConfig>('config/sensitivity-tags.yaml');
export const hotfixPatterns = loadYaml<HotfixPatterns>('config/hotfix-patterns.yaml');

export const defaultRiskConfig = config;
