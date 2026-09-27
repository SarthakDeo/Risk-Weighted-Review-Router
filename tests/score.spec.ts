import { describe, expect, it } from 'vitest';
import { calculateScoreFromPR, determineRiskTier } from '../src/scoring/score.js';
import { getSensitivityTags } from '../src/ingestion/sensitivity/tagger.js';
import { buildApp } from '../src/api/server.js';

describe('risk scoring core', () => {
  it('detects sensitive file tag', () => {
    expect(getSensitivityTags('services/payments/charge.go')).toContain('payments');
  });

  it('returns low tier for low-risk values', () => {
    expect(determineRiskTier(0.1)).toBe('low');
    expect(determineRiskTier(0.5)).toBe('medium');
    expect(determineRiskTier(0.9)).toBe('high');
  });

  it('returns deterministic response for known files', async () => {
    const first = await calculateScoreFromPR(['docs/README.md']);
    const second = await calculateScoreFromPR(['docs/README.md']);
    expect(first).toEqual(second);
  });

  it('handles a previously unseen file without crashing', async () => {
    const response = await calculateScoreFromPR(['new/service/file.go']);
    expect(response.risk_tier).toMatch(/low|medium|high/);
    expect(typeof response.risk_score).toBe('number');
  });

  it('rejects empty changed files through the API validation contract', async () => {
    const app = buildApp();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    const response = await fetch(`http://127.0.0.1:${port}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pr_id: 'PR-123', changed_files: [] }),
    });

    const payload = await response.json() as { error: { code: string; message: string } };
    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_REQUEST');
    server.close();
  });
});
