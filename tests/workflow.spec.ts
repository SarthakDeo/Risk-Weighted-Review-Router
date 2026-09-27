import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/server.js';
import { buildCommentBody } from '../src/workflow/annotator.js';
import { getTierRequirements, loadChecklist, resetPolicyCache } from '../src/workflow/router.js';
import { getScore } from '../src/workflow/scoring-client.js';
import { verifyWebhookSignature } from '../src/workflow/prListener.js';

describe('combined workflow layer', () => {
  it('loads configurable approval policy and checklist content', () => {
    resetPolicyCache();
    expect(getTierRequirements('high').required_approvals).toBe(2);
    expect(getTierRequirements('high').require_reviewer_with_history).toBe(true);
    expect(loadChecklist('low')).toContain('Low-Risk');
  });

  it('returns a deterministic stub score for isolated workflow tests', async () => {
    const previous = process.env.SCORING_SERVICE_STUB;
    process.env.SCORING_SERVICE_STUB = 'true';
    const result = await getScore({ pr_id: 123, changed_files: ['src/payments/charge.ts', 'docs/README.md'] });
    expect(result.risk_tier).toBe('medium');
    expect(result.driving_files).toEqual(['src/payments/charge.ts']);
    process.env.SCORING_SERVICE_STUB = previous;
  });

  it('builds a comment from actual scoring evidence', () => {
    const body = buildCommentBody(
      {
        risk_score: 0.8,
        risk_tier: 'high',
        driving_files: ['src/payments/charge.ts'],
        driving_reasons: ['tagged: payments'],
        related_incidents: ['INC-1'],
      },
      {
        label: 'High Risk',
        required_approvals: 2,
        require_reviewer_with_history: true,
        checklist_id: 'high',
        status_check_name: 'review-router/high',
        description: 'History required',
      },
      ['reviewer'],
      'checklist',
    );
    expect(body).toContain('src/payments/charge.ts');
    expect(body).toContain('INC-1');
    expect(body).toContain('@reviewer');
  });

  it('verifies GitHub webhook signatures safely', () => {
    const payload = Buffer.from('{"action":"opened"}');
    const secret = 'test-secret';
    const digest = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
    expect(verifyWebhookSignature(payload, digest, secret)).toBe(true);
    expect(verifyWebhookSignature(payload, 'sha256=invalid', secret)).toBe(false);
    expect(verifyWebhookSignature(payload, undefined, secret)).toBe(false);
  });

  it('exposes both unified health and scoring endpoints', async () => {
    const app = buildApp();
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    const score = await fetch(`http://127.0.0.1:${port}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pr_id: 123, changed_files: ['docs/README.md'] }),
    });
    expect(health.status).toBe(200);
    expect(score.status).toBe(200);
    const scoreBody = await score.json() as { risk_tier?: string };
    expect(scoreBody.risk_tier).toBeDefined();
    server.close();
  });
});
