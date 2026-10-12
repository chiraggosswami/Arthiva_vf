import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, decisions, eq, and, desc } from '@workspace/db';
import { ListDecisionsQueryParams } from '@workspace/api-zod';

const router: Router = Router();

// GET /decisions (Audited engine evaluation history)
router.get('/decisions', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = ListDecisionsQueryParams.parse(req.query);
    const conditions = [eq(decisions.storeId, req.storeId)];
    if (params.orderId) {
      conditions.push(eq(decisions.orderId, params.orderId));
    }

    const list = await db
      .select()
      .from(decisions)
      .where(and(...conditions))
      .orderBy(desc(decisions.createdAt))
      .limit(params.limit)
      .offset(params.offset);

    res.json(
      list.map((d) => ({
        id: d.id,
        orderId: d.orderId,
        score: d.score,
        chosenJourney: d.chosenJourney,
        explanation: d.explanation,
        policyVersion: d.policyVersion,
        createdAt: d.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

// GET /decisions/:id
router.get('/decisions/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const decisionId = String(req.params.id);
    const [d] = await db
      .select()
      .from(decisions)
      .where(and(eq(decisions.storeId, req.storeId), eq(decisions.id, decisionId)));

    if (!d) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Decision not found' } });
      return;
    }

    res.json({
      id: d.id,
      orderId: d.orderId,
      score: d.score,
      chosenJourney: d.chosenJourney,
      explanation: d.explanation,
      policyVersion: d.policyVersion,
      createdAt: d.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
