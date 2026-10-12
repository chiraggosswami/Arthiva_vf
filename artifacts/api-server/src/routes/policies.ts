import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, policies, eq, and } from '@workspace/db';
import { CreatePolicyBody } from '@workspace/api-zod';

const router: Router = Router();

// GET /policies
router.get('/policies', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(policies)
      .where(and(eq(policies.storeId, req.storeId), eq(policies.isActive, true)));

    res.json(
      list.map((p) => ({
        id: p.id,
        type: p.type,
        value: p.value,
        action: p.action,
        version: p.version,
        isActive: p.isActive,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// POST /policies
router.post('/policies', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = CreatePolicyBody.parse(req.body);
    const policyId = parsed.id || `pol_${parsed.type}_${parsed.value}`;
    const version = parsed.version || 'v1.0';

    const [created] = await db
      .insert(policies)
      .values({
        id: policyId,
        storeId: req.storeId,
        type: parsed.type,
        value: parsed.value,
        action: parsed.action,
        version,
        isActive: parsed.isActive !== undefined ? parsed.isActive : true,
      })
      .onConflictDoUpdate({
        target: policies.id,
        set: {
          type: parsed.type,
          value: parsed.value,
          action: parsed.action,
          version,
          isActive: parsed.isActive !== undefined ? parsed.isActive : true,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.status(201).json({
      id: created.id,
      type: created.type,
      value: created.value,
      action: created.action,
      version: created.version,
      isActive: created.isActive,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
