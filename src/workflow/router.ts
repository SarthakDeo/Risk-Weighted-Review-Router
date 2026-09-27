import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { PRMetadata, RiskTier, TierRequirements } from '../types.js';
import { logger } from '../logger.js';

type PolicyConfig = { tiers: Record<RiskTier, TierRequirements> };
let policyCache: PolicyConfig | null = null;

export function loadPolicy(configPath = process.env.POLICY_CONFIG_PATH ?? path.resolve(process.cwd(), 'config/policy.yaml')): PolicyConfig {
  if (!policyCache) policyCache = yaml.load(fs.readFileSync(configPath, 'utf8')) as PolicyConfig;
  return policyCache;
}

export function resetPolicyCache(): void { policyCache = null; }
export function getTierRequirements(tier: RiskTier): TierRequirements {
  const result = loadPolicy().tiers[tier];
  if (!result) throw new Error(`No policy defined for tier ${tier}`);
  return result;
}

export function buildOctokitForInstallation(installationId: number): Octokit {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  if (!appId || !privateKeyPath) throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY_PATH must be set');
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey: fs.readFileSync(privateKeyPath, 'utf8'), installationId },
  });
}

export async function rankReviewers(metadata: PRMetadata, octokit: Octokit, maxResults = 5): Promise<string[]> {
  const scores = new Map<string, number>();
  for (const file of metadata.changed_files.filter((entry) => entry.status !== 'added')) {
    try {
      const { data: commits } = await octokit.repos.listCommits({ owner: metadata.owner, repo: metadata.repo_name, path: file.filename, per_page: 100 });
      for (const commit of commits) {
        const author = commit.author?.login ?? commit.commit.author?.name;
        if (author && author !== metadata.author) scores.set(author, (scores.get(author) ?? 0) + 1);
      }
    } catch (error) {
      logger.warn('Failed to fetch reviewer history', { file: file.filename, error: String(error) });
    }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxResults).map(([login]) => login);
}

export function loadChecklist(tier: RiskTier): string {
  const filePath = path.resolve(process.env.CHECKLIST_DIR ?? path.join(process.cwd(), 'config/checklists'), `${tier}.md`);
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

export async function route(tier: RiskTier, metadata: PRMetadata) {
  const requirements = getTierRequirements(tier);
  let suggested_reviewers: string[] = [];
  try { suggested_reviewers = await rankReviewers(metadata, buildOctokitForInstallation(metadata.installation_id)); }
  catch (error) { logger.warn('Reviewer ranking skipped', { error: String(error) }); }
  return { requirements, suggested_reviewers, checklist_body: loadChecklist(tier) };
}
