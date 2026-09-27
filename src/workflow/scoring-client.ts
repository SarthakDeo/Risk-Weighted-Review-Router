import axios from 'axios';
import { ScoreResponse } from '../types.js';
import { logger } from '../logger.js';

export type WorkflowScoreRequest = { pr_id: number | string; changed_files: string[] };

export async function getScore(request: WorkflowScoreRequest): Promise<ScoreResponse> {
  const useStub = (process.env.SCORING_SERVICE_STUB ?? 'false') === 'true';
  if (useStub) {
    const highKeywords = ['payment', 'auth', 'billing', 'charge', 'token', 'secret', 'infra', 'migration'];
    const drivingFiles = request.changed_files.filter((file) => highKeywords.some((keyword) => file.toLowerCase().includes(keyword)));
    const score = Math.min(1, 0.2 + drivingFiles.length * 0.35);
    const tier = score > 0.69 ? 'high' : score > 0.39 ? 'medium' : 'low';
    return {
      risk_score: Number(score.toFixed(2)),
      risk_tier: tier,
      driving_files: drivingFiles,
      driving_reasons: drivingFiles.map((file) => `tagged: ${highKeywords.find((keyword) => file.toLowerCase().includes(keyword))} (stub)`),
      related_incidents: tier === 'high' ? ['INC-STUB-001'] : [],
    };
  }

  const url = `${process.env.SCORING_SERVICE_URL ?? 'http://localhost:3000'}/score`;
  try { return (await axios.post<ScoreResponse>(url, request, { timeout: 10000 })).data; }
  catch (error) { logger.error('Scoring service call failed', { error: String(error) }); throw error; }
}
