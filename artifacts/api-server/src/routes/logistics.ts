import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, shipments, ndrCases, rtoCases, eq, and } from '@workspace/db';
import {
  CreateShipmentBody,
  ActOnNdrCaseBody,
  ActOnRtoCaseBody,
} from '@workspace/api-zod';

const router: Router = Router();

// --- Shipments ---
router.get('/shipments', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(shipments)
      .where(eq(shipments.storeId, req.storeId));

    res.json(
      list.map((s) => ({
        id: s.id,
        orderId: s.orderId,
        courierId: s.courierId,
        awbNumber: s.awbNumber,
        trackingStatus: s.trackingStatus,
        forwardCost: s.forwardCost,
        reverseCost: s.reverseCost,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/shipments', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = CreateShipmentBody.parse(req.body);
    const id = `ship_${Math.random().toString(36).slice(2, 10)}`;

    const [created] = await db
      .insert(shipments)
      .values({
        id,
        storeId: req.storeId,
        orderId: parsed.orderId,
        courierId: parsed.courierId,
        awbNumber: parsed.awbNumber,
        trackingStatus: 'manifested',
      })
      .returning();

    res.status(201).json({
      id: created.id,
      orderId: created.orderId,
      courierId: created.courierId,
      awbNumber: created.awbNumber,
      trackingStatus: created.trackingStatus,
      forwardCost: created.forwardCost,
      reverseCost: created.reverseCost,
    });
  } catch (err) {
    next(err);
  }
});

// --- NDR Cases ---
router.get('/ndr-cases', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(ndrCases)
      .where(eq(ndrCases.storeId, req.storeId));

    res.json(
      list.map((c) => ({
        id: c.id,
        orderId: c.orderId,
        reason: c.reason,
        rescueAction: c.rescueAction,
        rescueMessage: c.rescueMessage,
        includesGoodwill: c.includesGoodwill,
        status: c.status,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/ndr-cases/:id/action', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const caseId = String(req.params.id);
    const parsed = ActOnNdrCaseBody.parse(req.body);

    const [existing] = await db
      .select()
      .from(ndrCases)
      .where(and(eq(ndrCases.storeId, req.storeId), eq(ndrCases.id, caseId)));

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'NDR case not found' } });
      return;
    }

    const [updated] = await db
      .update(ndrCases)
      .set({
        rescueAction: parsed.rescueAction,
        rescueMessage: parsed.rescueMessage || existing.rescueMessage,
        status: parsed.status || 'resolved',
        updatedAt: new Date(),
      })
      .where(and(eq(ndrCases.storeId, req.storeId), eq(ndrCases.id, caseId)))
      .returning();

    res.json({
      id: updated.id,
      orderId: updated.orderId,
      reason: updated.reason,
      rescueAction: updated.rescueAction,
      rescueMessage: updated.rescueMessage,
      includesGoodwill: updated.includesGoodwill,
      status: updated.status,
    });
  } catch (err) {
    next(err);
  }
});

// --- RTO Cases ---
router.get('/rto-cases', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(rtoCases)
      .where(eq(rtoCases.storeId, req.storeId));

    res.json(
      list.map((c) => ({
        id: c.id,
        orderId: c.orderId,
        recoveryAction: c.recoveryAction,
        inventoryRoute: c.inventoryRoute,
        recoveredValue: c.recoveredValue,
        status: c.status,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/rto-cases/:id/action', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const caseId = String(req.params.id);
    const parsed = ActOnRtoCaseBody.parse(req.body);

    const [existing] = await db
      .select()
      .from(rtoCases)
      .where(and(eq(rtoCases.storeId, req.storeId), eq(rtoCases.id, caseId)));

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'RTO case not found' } });
      return;
    }

    const [updated] = await db
      .update(rtoCases)
      .set({
        recoveryAction: parsed.recoveryAction,
        inventoryRoute: parsed.inventoryRoute,
        recoveredValue: parsed.recoveredValue !== undefined ? parsed.recoveredValue : existing.recoveredValue,
        status: parsed.status || 'received',
        updatedAt: new Date(),
      })
      .where(and(eq(rtoCases.storeId, req.storeId), eq(rtoCases.id, caseId)))
      .returning();

    res.json({
      id: updated.id,
      orderId: updated.orderId,
      recoveryAction: updated.recoveryAction,
      inventoryRoute: updated.inventoryRoute,
      recoveredValue: updated.recoveredValue,
      status: updated.status,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
