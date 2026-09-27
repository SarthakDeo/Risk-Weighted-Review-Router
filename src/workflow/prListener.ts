import crypto from 'node:crypto';
import fs from 'node:fs';
import { Request, Response } from 'express';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { ChangedFile, PRMetadata } from '../types.js';
import { logger } from '../logger.js';

export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const digest = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expected = Buffer.from(digest);
  const received = Buffer.from(signatureHeader);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export function buildOctokit(installationId: number): Octokit {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  if (!appId || !privateKeyPath) throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY_PATH must be set');
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  return new Octokit({ authStrategy: createAppAuth, auth: { appId, privateKey, installationId } });
}

export async function fetchChangedFiles(octokit: Octokit, owner: string, repo: string, pullNumber: number): Promise<ChangedFile[]> {
  const files: ChangedFile[] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await octokit.pulls.listFiles({ owner, repo, pull_number: pullNumber, per_page: 100, page });
    files.push(...data.map((file) => ({
      filename: file.filename,
      status: file.status as ChangedFile['status'],
      additions: file.additions,
      deletions: file.deletions,
      previous_filename: file.previous_filename,
    })));
    if (data.length < 100) break;
  }
  return files;
}

export async function extractPRMetadata(payload: any, installationId: number): Promise<PRMetadata> {
  const pr = payload.pull_request;
  const repository = payload.repository;
  const owner = repository.owner.login as string;
  const repoName = repository.name as string;
  const octokit = buildOctokit(installationId);
  const changedFiles = await fetchChangedFiles(octokit, owner, repoName, pr.number);
  return {
    pr_id: pr.id,
    repo: `${owner}/${repoName}`,
    owner,
    repo_name: repoName,
    number: pr.number,
    author: pr.user.login,
    title: pr.title,
    base_sha: pr.base.sha,
    head_sha: pr.head.sha,
    changed_files: changedFiles,
    installation_id: installationId,
  };
}

export async function processWebhook(
  req: Request,
  res: Response,
  onPREvent: (metadata: PRMetadata) => Promise<void>,
  onReviewEvent?: (metadata: PRMetadata) => Promise<void>,
): Promise<void> {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from('');
  if (!verifyWebhookSignature(rawBody, req.headers['x-hub-signature-256'] as string | undefined, process.env.GITHUB_WEBHOOK_SECRET ?? '')) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }
  const event = req.headers['x-github-event'];
  if (event !== 'pull_request' && event !== 'pull_request_review') {
    res.status(200).json({ ignored: true, reason: `event=${req.headers['x-github-event']}` });
    return;
  }
  const validAction = event === 'pull_request'
    ? ['opened', 'synchronize', 'reopened'].includes(req.body?.action)
    : ['submitted', 'dismissed', 'edited'].includes(req.body?.action);
  if (!validAction) {
    res.status(200).json({ ignored: true, reason: `action=${req.body?.action}` });
    return;
  }

  res.status(202).json({ status: 'processing' });
  try {
    const metadata = await extractPRMetadata(req.body, Number(req.body?.installation?.id));
    if (event === 'pull_request_review' && onReviewEvent) await onReviewEvent(metadata);
    else if (event === 'pull_request') await onPREvent(metadata);
  } catch (error) {
    logger.error('Error processing PR webhook', { error: String(error) });
  }
}
