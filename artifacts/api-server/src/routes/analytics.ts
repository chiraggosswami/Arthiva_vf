import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, orders, eq, sql } from '@workspace/db';

const router: Router = Router();

// GET /analytics/summary
router.get('/analytics/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.storeId, req.storeId));

    const totalOrders = storeOrders.length;
    let totalRiskValue = 0;
    let sumPto = 0;
    let protectedMargin = 0;

    for (const o of storeOrders) {
      const pRto = Number(o.pRto || 0.2);
      sumPto += pRto;
      if (pRto > 0.35) {
        totalRiskValue += o.totalValue;
      }
      // Estimated savings from selected journeys
      if (o.journey !== 'Full COD') {
        protectedMargin += Math.round(o.totalValue * 0.12);
      }
    }

    const avgRtoRate = totalOrders ? Number((sumPto / totalOrders).toFixed(3)) : 0.2;

    res.json({
      totalOrders,
      protectedMargin,
      avgRtoRate,
      atRiskValue: totalRiskValue,
    });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/rto-causes (Reason analysis aggregation)
router.get('/analytics/rto-causes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rtoCases } = await import('@workspace/db');
    const cases = await db
      .select()
      .from(rtoCases)
      .where(eq(rtoCases.storeId, req.storeId));

    const rootCauseCounts: Record<string, number> = {};
    const recoveryActionCounts: Record<string, { count: number; totalRecovered: number }> = {};
    let totalRecovered = 0;

    for (const c of cases) {
      const cause = c.rootCause || 'customer_unreachable';
      rootCauseCounts[cause] = (rootCauseCounts[cause] || 0) + 1;

      const action = c.recoveryAction || 'Restock to nearest warehouse';
      if (!recoveryActionCounts[action]) {
        recoveryActionCounts[action] = { count: 0, totalRecovered: 0 };
      }
      recoveryActionCounts[action].count += 1;
      recoveryActionCounts[action].totalRecovered += c.recoveredValue || 0;
      totalRecovered += c.recoveredValue || 0;
    }

    res.json({
      totalCases: cases.length,
      totalRecovered,
      rootCauses: rootCauseCounts,
      recoveryActions: recoveryActionCounts,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
