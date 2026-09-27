import express from 'express';
import { z } from 'zod';
import { logger } from '../logger.js';
import { calculateScoreFromPR } from '../scoring/score.js';

const requestSchema = z.object({
  pr_id: z.string().min(1),
  changed_files: z.array(z.string().min(1)).min(1),
});

export function buildApp() {
  const app = express();
  app.use(express.json());

  app.get('/', (_req, res) => {
    return res.json({
      service: 'risk-router-person-a',
      status: 'ok',
      scoring_endpoint: 'POST /score',
    });
  });

  app.post('/score', async (req, res) => {
    logger.info('scoring request received', { pr_id: req.body?.pr_id, files: req.body?.changed_files });

    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'changed_files must contain at least one file path',
        },
      });
    }

    try {
      const score = await calculateScoreFromPR(parsed.data.changed_files);
      logger.info('scoring completed', { pr_id: parsed.data.pr_id, score: score.risk_score, tier: score.risk_tier, files: parsed.data.changed_files });
      return res.json(score);
    } catch (error) {
      logger.error('scoring failed', { error: String(error) });
      return res.status(500).json({
        error: { code: 'SERVER_ERROR', message: 'Unable to calculate risk score' },
      });
    }
  });

  return app;
}
