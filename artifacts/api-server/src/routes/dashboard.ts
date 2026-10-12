import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, orders, rtoCases, eq } from '@workspace/db';

const router: Router = Router();

// GET /dashboard/summary
router.get('/dashboard/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.storeId, req.storeId));

    const storeRtos = await db
      .select()
      .from(rtoCases)
      .where(eq(rtoCases.storeId, req.storeId));

    const totalOrders = storeOrders.length;
    let realisedRevenue = 0;
    let expectedMargin = 0;
    let sumPto = 0;
    let marginSavedVsBaseline = 0;

    for (const o of storeOrders) {
      const pRto = Number(o.pRto || 0.2);
      sumPto += pRto;

      if (o.status === 'Delivered' || o.paymentMethod === 'Prepaid') {
        realisedRevenue += o.totalValue;
      }

      // Est. unit margin
      const margin = Math.round(o.totalValue * (1 - pRto * 0.7));
      expectedMargin += margin;

      if (o.journey !== 'Full COD') {
        marginSavedVsBaseline += Math.round(o.totalValue * 0.14);
      }
    }

    const totalRecoveryValue = storeRtos.reduce((s, r) => s + (r.recoveredValue || 0), 0);
    const avgRtoRate = totalOrders ? Number((sumPto / totalOrders).toFixed(3)) : 0.2;

    res.json({
      totalOrders,
      realisedRevenue,
      expectedMargin,
      avgRtoRate,
      totalRecoveryValue,
      marginSavedVsBaseline,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
