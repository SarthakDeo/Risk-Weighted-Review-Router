import { Octokit } from '@octokit/rest';
import { PRMetadata, RiskTier, ScoreResponse, TierRequirements } from '../types.js';

const MARKER = '<!-- review-router-bot -->';
const labels: Record<RiskTier, string> = { low: 'Low Risk', medium: 'Medium Risk', high: 'High Risk' };

export function buildCommentBody(score: ScoreResponse, requirements: TierRequirements, reviewers: string[], checklist: string): string {
  const lines = [MARKER, `## Risk-Weighted Review - ${labels[score.risk_tier]}`, '', `**Risk Score:** \`${score.risk_score.toFixed(2)}\` | **Tier:** \`${score.risk_tier.toUpperCase()}\``, ''];
  if (score.driving_files.length) lines.push('### High-Risk Files Touched', ...score.driving_files.map((file) => `- \`${file}\``), '');
  if (score.driving_reasons.length) lines.push('### Risk Signals', ...score.driving_reasons.map((reason) => `- ${reason}`), '');
  if (score.related_incidents.length) lines.push('### Related Past Incidents', ...score.related_incidents.map((incident) => `- ${incident}`), '');
  lines.push('### Review Requirements', `- Required approvals: **${requirements.required_approvals}**`);
  if (requirements.require_reviewer_with_history) lines.push('- At least one approver must have prior commit history on affected files');
  lines.push(`- _${requirements.description}_`, '');
  if (reviewers.length) lines.push(`### Suggested Reviewers\n${reviewers.map((reviewer) => `@${reviewer}`).join(', ')}`, '');
  if (checklist) lines.push('---', '', checklist);
  lines.push('', '---', '_Maintained by the review-router bot._');
  return lines.join('\n');
}

export async function annotate(octokit: Octokit, metadata: PRMetadata, score: ScoreResponse, requirements: TierRequirements, reviewers: string[], checklist: string): Promise<void> {
  const body = buildCommentBody(score, requirements, reviewers, checklist);
  const { owner, repo_name: repo, number: pull_number, head_sha } = metadata;
  const comments = await octokit.issues.listComments({ owner, repo, issue_number: pull_number, per_page: 100 });
  const existing = comments.data.find((comment) => comment.body?.includes(MARKER));
  if (existing) await octokit.issues.updateComment({ owner, repo, comment_id: existing.id, body });
  else await octokit.issues.createComment({ owner, repo, issue_number: pull_number, body });

  const checks = await octokit.checks.listForRef({ owner, repo, ref: head_sha, check_name: requirements.status_check_name, per_page: 1 });
  const props = { name: requirements.status_check_name, head_sha, status: 'completed' as const, conclusion: score.risk_tier === 'low' ? 'success' as const : 'action_required' as const, output: { title: `${labels[score.risk_tier]} (${score.risk_score.toFixed(2)})`, summary: score.driving_reasons.join('\n') } };
  if (checks.data.check_runs[0]) await octokit.checks.update({ owner, repo, check_run_id: checks.data.check_runs[0].id, ...props });
  else await octokit.checks.create({ owner, repo, ...props });
}
