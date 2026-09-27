import { calculateScoreFromPR } from '../scoring/score.js';
import { PRMetadata, RiskTier } from '../types.js';
import { getScore } from './scoring-client.js';
import { route, buildOctokitForInstallation } from './router.js';
import { annotate } from './annotator.js';
import { enforceGate } from './approvalGate.js';
import { logger } from '../logger.js';

export async function processPR(metadata: PRMetadata): Promise<void> {
  const score = process.env.SCORING_SERVICE_STUB === 'true'
    ? await getScore({ pr_id: metadata.pr_id, changed_files: metadata.changed_files.map((file) => file.filename) })
    : await calculateScoreFromPR(metadata.changed_files.map((file) => file.filename));
  const decision = await route(score.risk_tier, metadata);
  const octokit = buildOctokitForInstallation(metadata.installation_id);
  await annotate(octokit, metadata, score, decision.requirements, decision.suggested_reviewers, decision.checklist_body);
  await enforceGate(octokit, metadata, decision.requirements, score.risk_tier);
  logger.info('Workflow pipeline complete', { pr: metadata.number, tier: score.risk_tier });
}

export async function reEvaluateGate(metadata: PRMetadata, tier: RiskTier): Promise<void> {
  const { requirements } = await route(tier, metadata);
  await enforceGate(buildOctokitForInstallation(metadata.installation_id), metadata, requirements, tier);
}
