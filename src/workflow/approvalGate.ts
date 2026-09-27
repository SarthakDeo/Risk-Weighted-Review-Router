import { Octokit } from '@octokit/rest';
import { PRMetadata, RiskTier, TierRequirements } from '../types.js';

export const GATE_CHECK_NAME = 'review-router/gate';
export type GateEvaluation = { passed: boolean; reasons: string[] };

export async function getApprovals(octokit: Octokit, owner: string, repo: string, pull_number: number): Promise<string[]> {
  const { data } = await octokit.pulls.listReviews({ owner, repo, pull_number, per_page: 100 });
  const latest = new Map<string, string>();
  for (const review of data) if (review.user?.login) latest.set(review.user.login, review.state);
  return [...latest.entries()].filter(([, state]) => state === 'APPROVED').map(([login]) => login);
}

async function approversWithHistory(octokit: Octokit, metadata: PRMetadata, approvers: string[]): Promise<string[]> {
  const withHistory = new Set<string>();
  for (const file of metadata.changed_files) {
    try {
      const { data: commits } = await octokit.repos.listCommits({
        owner: metadata.owner,
        repo: metadata.repo_name,
        path: file.filename,
        per_page: 100,
      });
      for (const commit of commits) {
        const login = commit.author?.login;
        if (login && approvers.includes(login)) withHistory.add(login);
      }
    } catch {
      // History is best effort when a file is unavailable through the API.
    }
  }
  return [...withHistory];
}

export async function evaluateGate(octokit: Octokit, metadata: PRMetadata, requirements: TierRequirements): Promise<GateEvaluation> {
  const approvals = await getApprovals(octokit, metadata.owner, metadata.repo_name, metadata.number);
  const reasons: string[] = [];
  let passed = approvals.length >= requirements.required_approvals;
  if (!passed) reasons.push(`Needs ${requirements.required_approvals} approval(s); currently has ${approvals.length}.`);
  if (requirements.require_reviewer_with_history) {
    const historyApprovers = await approversWithHistory(octokit, metadata, approvals);
    if (historyApprovers.length === 0) {
      passed = false;
      reasons.push('At least one approver must have prior commit history on the affected files.');
    }
  }
  if (passed) reasons.push(`All requirements met: ${approvals.length}/${requirements.required_approvals} approvals.`);
  return { passed, reasons };
}

export async function enforceGate(octokit: Octokit, metadata: PRMetadata, requirements: TierRequirements, tier: RiskTier): Promise<GateEvaluation> {
  const evaluation = await evaluateGate(octokit, metadata, requirements);
  const { owner, repo_name: repo, head_sha } = metadata;
  const existing = await octokit.checks.listForRef({ owner, repo, ref: head_sha, check_name: GATE_CHECK_NAME, per_page: 1 });
  const props = { name: GATE_CHECK_NAME, head_sha, status: 'completed' as const, conclusion: evaluation.passed ? 'success' as const : 'failure' as const, output: { title: evaluation.passed ? `Review requirements met (${tier})` : `Review requirements not met (${tier})`, summary: evaluation.reasons.join('\n') } };
  if (existing.data.check_runs[0]) await octokit.checks.update({ owner, repo, check_run_id: existing.data.check_runs[0].id, ...props });
  else await octokit.checks.create({ owner, repo, ...props });
  return evaluation;
}

export async function ensureBranchProtection(octokit: Octokit, owner: string, repo: string, branch: string): Promise<void> {
  const { data: protection } = await octokit.repos.getBranchProtection({ owner, repo, branch });
  const existing = protection.required_status_checks?.contexts ?? [];
  if (existing.includes(GATE_CHECK_NAME)) return;
  await octokit.repos.updateBranchProtection({
    owner,
    repo,
    branch,
    required_status_checks: {
      strict: protection.required_status_checks?.strict ?? false,
      contexts: [...existing, GATE_CHECK_NAME],
    },
    enforce_admins: protection.enforce_admins?.enabled ?? false,
    required_pull_request_reviews: protection.required_pull_request_reviews
      ? {
          dismiss_stale_reviews: protection.required_pull_request_reviews.dismiss_stale_reviews,
          require_code_owner_reviews: protection.required_pull_request_reviews.require_code_owner_reviews,
          required_approving_review_count: protection.required_pull_request_reviews.required_approving_review_count,
        }
      : null,
    restrictions: null,
  });
}
