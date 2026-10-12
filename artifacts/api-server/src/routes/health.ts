import { Router, type Request, type Response } from 'express';
import { pool } from '@workspace/db';

const router: Router = Router();

// GET /health and /healthz (Liveness)
router.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok' });
});

router.get('/healthz', (_req: Request, res: Response): void => {
  res.json({ status: 'ok' });
});

// GET /ready (Readiness probe verifying DB pool)
router.get('/ready', async (_req: Request, res: Response): Promise<void> => {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      res.json({
        status: 'ready',
        database: 'connected',
        uptimeSeconds: Math.floor(process.uptime()),
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(503).json({
      status: 'unavailable',
      database: 'disconnected',
      error: err.message,
    });
  }
});

export default router;
