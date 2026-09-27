import { config } from '../config.js';
import { getRelatedIncidentsForFiles, getRiskMapForFiles } from '../risk-map/repository.js';
import { FileRiskRecord, ScoreResponse } from '../types.js';
import { normalize } from '../utils.js';

export function determineRiskTier(score: number): 'low' | 'medium' | 'high' {
  if (score <= config.scoring.tiers.low_max) return 'low';
  if (score <= config.scoring.tiers.medium_max) return 'medium';
  return 'high';
}

export async function scoreFiles(files: string[]): Promise<{ score: number; reasons: string[]; relatedIncidents: string[]; drivingFiles: string[]; fileRisk: Map<string, number> }> {
  const unique = [...new Set(files)];
  const riskRecordMap = new Map<string, FileRiskRecord>();
  const fileRecords = await getRiskMapForFiles(unique);
  for (const record of fileRecords) riskRecordMap.set(record.file_path, record);

  const stepScores = Array.from(unique).map((filePath) => {
    const record = riskRecordMap.get(filePath) ?? {
      file_path: filePath,
      commit_count: 0,
      lines_added: 0,
      lines_deleted: 0,
      churn: 0,
      revert_count: 0,
      hotfix_count: 0,
      bug_fix_count: 0,
      bug_fix_ratio: 0,
      last_modified_at: null,
      incident_count: 0,
      recent_incident_count: 0,
      sensitivity_tags: [],
      blast_radius: 0,
      updated_at: new Date().toISOString(),
    };

    const incidentSignal = normalize(record.incident_count, config.scoring.normalize.incident_max);
    const revertSignal = normalize(record.revert_count, config.scoring.normalize.revert_max);
    const hotfixSignal = normalize(record.hotfix_count, config.scoring.normalize.hotfix_max);
    const bugFixSignal = normalize(record.bug_fix_ratio, config.scoring.normalize.bug_fix_max);
    const churnSignal = normalize(record.churn, config.scoring.normalize.churn_max);
    const sensitivitySignal = config.scoring.weights.sensitivity * (record.sensitivity_tags.length > 0 ? 1 : 0);
    const blastRadiusSignal = normalize(record.blast_radius, config.scoring.normalize.blast_radius_max);

    const weighted =
      config.scoring.weights.incident * incidentSignal +
      config.scoring.weights.revert * revertSignal +
      config.scoring.weights.hotfix * hotfixSignal +
      config.scoring.weights.bug_fix * bugFixSignal +
      config.scoring.weights.churn * churnSignal +
      sensitivitySignal +
      config.scoring.weights.blast_radius * blastRadiusSignal;

    return { filePath, weighted, reasons: [
      record.incident_count > 0 ? `${record.incident_count} incidents in ${config.scoring.incident_window_days}d` : null,
      record.sensitivity_tags.length ? `tagged: ${record.sensitivity_tags.join(', ')}` : null,
      record.blast_radius > 0 ? `blast radius ${record.blast_radius}` : null,
      record.churn > 0 ? `churn ${record.churn}` : null,
    ].filter(Boolean) as string[] };
  });

  const drivingFiles = stepScores
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, Math.min(3, stepScores.length))
    .map((entry) => entry.filePath);

  const scoreTotal = stepScores.reduce((sum, entry) => sum + entry.weighted, 0) / Math.max(stepScores.length, 1);
  const normalizedScore = Math.min(Math.max(scoreTotal, 0), 1);
  const reasons = stepScores
    .flatMap((entry) => entry.reasons)
    .slice(0, 5);
  const relatedIncidents = await getRelatedIncidentsForFiles(unique);

  return {
    score: normalizedScore,
    reasons,
    relatedIncidents,
    drivingFiles,
    fileRisk: new Map(stepScores.map((entry) => [entry.filePath, entry.weighted])),
  };
}

export async function calculateScoreFromPR(prFiles: string[]): Promise<ScoreResponse> {
  const result = await scoreFiles(prFiles);
  const tier = determineRiskTier(result.score);

  return {
    risk_score: Number(result.score.toFixed(2)),
    risk_tier: tier,
    driving_files: result.drivingFiles,
    driving_reasons: result.reasons,
    related_incidents: result.relatedIncidents,
  };
}
