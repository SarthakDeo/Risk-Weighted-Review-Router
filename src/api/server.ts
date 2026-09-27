import express, { Request } from 'express';
import { z } from 'zod';
import { logger } from '../logger.js';
import { calculateScoreFromPR } from '../scoring/score.js';
import { processWebhook } from '../workflow/prListener.js';
import { processPR } from '../workflow/pipeline.js';
import { reEvaluateGate } from '../workflow/pipeline.js';
import { calculateScoreFromPR as scorePR } from '../scoring/score.js';

const requestSchema = z.object({
  pr_id: z.union([z.string().min(1), z.number()]),
  changed_files: z.array(z.string().min(1)).min(1),
});

export function buildApp() {
  const app = express();
  app.use(express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buffer) => {
      req.rawBody = buffer;
    },
  }));

  app.get('/', (_req, res) => {
    return res.json({
      service: 'risk-router-person-a',
      status: 'ok',
      scoring_endpoint: 'POST /score',
    });
  });

  app.get('/health', (_req, res) => {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

  app.post('/webhook', async (req, res) => {
    await processWebhook(
      req,
      res,
      processPR,
      async (metadata) => {
        const score = await scorePR(metadata.changed_files.map((file) => file.filename));
        await reEvaluateGate(metadata, score.risk_tier);
      },
    );
  });

  return app;
}
