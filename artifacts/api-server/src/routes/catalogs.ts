import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, customers, products, couriers, pincodeStats, eq, and } from '@workspace/db';
import {
  CreateCustomerBody,
  CreateProductBody,
  CreateCourierBody,
  UpsertPincodeBody,
  ListCustomersQueryParams,
  ListPincodesQueryParams,
} from '@workspace/api-zod';

const router: Router = Router();

// --- Customers ---
router.get('/customers', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = ListCustomersQueryParams.parse(req.query);
    const list = await db
      .select()
      .from(customers)
      .where(eq(customers.storeId, req.storeId))
      .limit(params.limit)
      .offset(params.offset);

    res.json(
      list.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        city: c.city,
        ordersCount: c.ordersCount,
        rtosCount: c.rtosCount,
        prepaidCount: c.prepaidCount,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/customers', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = CreateCustomerBody.parse(req.body);
    const id = parsed.id || `c_${Math.random().toString(36).slice(2, 10)}`;

    const [created] = await db
      .insert(customers)
      .values({
        id,
        storeId: req.storeId,
        name: parsed.name,
        phone: parsed.phone,
        city: parsed.city,
      })
      .returning();

    res.status(201).json({
      id: created.id,
      name: created.name,
      phone: created.phone,
      city: created.city,
      ordersCount: created.ordersCount,
      rtosCount: created.rtosCount,
      prepaidCount: created.prepaidCount,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/customers/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const custId = String(req.params.id);
    const [c] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.storeId, req.storeId), eq(customers.id, custId)));

    if (!c) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    res.json({
      id: c.id,
      name: c.name,
      phone: c.phone,
      city: c.city,
      ordersCount: c.ordersCount,
      rtosCount: c.rtosCount,
      prepaidCount: c.prepaidCount,
    });
  } catch (err) {
    next(err);
  }
});

// --- Products ---
router.get('/products', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(products)
      .where(eq(products.storeId, req.storeId));

    res.json(
      list.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        cogs: p.cogs,
        damageRate: Number(p.damageRate),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/products', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = CreateProductBody.parse(req.body);
    const id = parsed.id || `p_${Math.random().toString(36).slice(2, 10)}`;

    const [created] = await db
      .insert(products)
      .values({
        id,
        storeId: req.storeId,
        name: parsed.name,
        price: parsed.price,
        cogs: parsed.cogs,
        damageRate: parsed.damageRate ? parsed.damageRate.toString() : '0.02',
      })
      .returning();

    res.status(201).json({
      id: created.id,
      name: created.name,
      price: created.price,
      cogs: created.cogs,
      damageRate: Number(created.damageRate),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const prodId = String(req.params.id);
    const [p] = await db
      .select()
      .from(products)
      .where(and(eq(products.storeId, req.storeId), eq(products.id, prodId)));

    if (!p) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found' } });
      return;
    }

    res.json({
      id: p.id,
      name: p.name,
      price: p.price,
      cogs: p.cogs,
      damageRate: Number(p.damageRate),
    });
  } catch (err) {
    next(err);
  }
});

// --- Couriers ---
router.get('/couriers', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(couriers)
      .where(and(eq(couriers.storeId, req.storeId), eq(couriers.isActive, true)));

    res.json(
      list.map((c) => ({
        id: c.id,
        name: c.name,
        successRate: Number(c.successRate),
        forwardCost: c.forwardCost,
        reverseCost: c.reverseCost,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/couriers', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = CreateCourierBody.parse(req.body);

    const [created] = await db
      .insert(couriers)
      .values({
        id: parsed.id,
        storeId: req.storeId,
        name: parsed.name,
        successRate: parsed.successRate.toString(),
        forwardCost: parsed.forwardCost,
        reverseCost: parsed.reverseCost,
      })
      .onConflictDoUpdate({
        target: couriers.id,
        set: {
          name: parsed.name,
          successRate: parsed.successRate.toString(),
          forwardCost: parsed.forwardCost,
          reverseCost: parsed.reverseCost,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.status(201).json({
      id: created.id,
      name: created.name,
      successRate: Number(created.successRate),
      forwardCost: created.forwardCost,
      reverseCost: created.reverseCost,
    });
  } catch (err) {
    next(err);
  }
});

// --- Pincodes ---
router.get('/pincodes', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const params = ListPincodesQueryParams.parse(req.query);
    const list = await db
      .select()
      .from(pincodeStats)
      .where(eq(pincodeStats.storeId, req.storeId))
      .limit(params.limit)
      .offset(params.offset);

    res.json(
      list.map((pin) => ({
        code: pin.code,
        city: pin.city,
        state: pin.state,
        rtoRate: Number(pin.rtoRate),
        successRate: Number(pin.successRate),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post('/pincodes', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = UpsertPincodeBody.parse(req.body);
    const id = `${req.storeId}:${parsed.code}`;

    const [created] = await db
      .insert(pincodeStats)
      .values({
        id,
        storeId: req.storeId,
        code: parsed.code,
        city: parsed.city,
        state: parsed.state,
        rtoRate: parsed.rtoRate.toString(),
        successRate: parsed.successRate.toString(),
      })
      .onConflictDoUpdate({
        target: pincodeStats.id,
        set: {
          city: parsed.city,
          state: parsed.state,
          rtoRate: parsed.rtoRate.toString(),
          successRate: parsed.successRate.toString(),
          updatedAt: new Date(),
        },
      })
      .returning();

    res.status(201).json({
      code: created.code,
      city: created.city,
      state: created.state,
      rtoRate: Number(created.rtoRate),
      successRate: Number(created.successRate),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
