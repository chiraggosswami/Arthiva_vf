import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from '@workspace/db';
import {
  orders,
  orderItems,
  orderEvents,
  products,
  customers,
  pincodeStats,
  couriers,
  policies,
  decisions,
  ndrCases,
  rtoCases,
  listings,
  listingScores,
  eq,
  and,
  desc,
} from '@workspace/db';
import { evaluate, DEFAULT_ENGINE_CONFIG, type EngineConfig } from '@workspace/engine';
import {
  CreateOrderBody,
  UpdateOrderBody,
  AddOrderEventBody,
  ListOrdersQueryParams,
} from '@workspace/api-zod';
import { getQueueBoss } from '../lib/queue';

const router: Router = Router();

// GET /orders (with filtering & pagination)
router.get('/orders', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queryParams = ListOrdersQueryParams.parse(req.query);
    const limit = queryParams.limit;
    const offset = queryParams.offset;

    const conditions = [eq(orders.storeId, req.storeId)];
    if (queryParams.status) conditions.push(eq(orders.status, queryParams.status));
    if (queryParams.paymentMethod) conditions.push(eq(orders.paymentMethod, queryParams.paymentMethod));
    if (queryParams.journey) conditions.push(eq(orders.journey, queryParams.journey));
    if (queryParams.pincode) conditions.push(eq(orders.pincode, queryParams.pincode));

    const list = await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    const eventsList = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.storeId, req.storeId));

    const itemsList = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.storeId, req.storeId));

    const formatted = list.map((o) => {
      const orderEvts = eventsList
        .filter((e) => e.orderId === o.id)
        .map((e) => ({
          label: e.label,
          at: (e.payload as any)?.at || 'Just now',
        }));
      const item = itemsList.find((it) => it.orderId === o.id);

      return {
        id: o.id,
        productId: item?.productId || 'P01',
        customerId: o.customerId,
        courierId: o.courierId,
        pincode: o.pincode,
        qty: item?.quantity || 1,
        value: o.totalValue,
        payment: o.paymentMethod,
        address: o.address,
        addressComplete: o.addressComplete,
        addressVerified: o.addressVerified,
        otpPassed: o.otpPassed,
        advancePaid: o.advancePaid,
        campaign: o.campaign,
        status: o.status,
        journey: o.journey,
        score: o.score,
        created: o.createdAt.toISOString().slice(0, 10),
        timeline: orderEvts,
        customerName: o.customerName || undefined,
        customerPhone: o.customerPhone || undefined,
      };
    });

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// POST /orders
router.post('/orders', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = CreateOrderBody.parse(req.body);

    let [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.storeId, req.storeId), eq(products.id, parsed.productId)));

    if (!product) {
      const [insertedProduct] = await db
        .insert(products)
        .values({
          id: parsed.productId,
          storeId: req.storeId,
          name: parsed.productId,
          price: parsed.value,
          cogs: Math.round(parsed.value * 0.3),
        })
        .onConflictDoNothing()
        .returning();
      product = insertedProduct;
    }
    let [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.storeId, req.storeId), eq(customers.id, parsed.customerId)));

    if (!customer) {
      const [insertedCustomer] = await db
        .insert(customers)
        .values({
          id: parsed.customerId,
          storeId: req.storeId,
          name: parsed.customerName || `Customer ${parsed.customerId}`,
          phone: parsed.customerPhone || '+91 9999999999',
          city: 'Delhi',
        })
        .onConflictDoNothing()
        .returning();
      customer = insertedCustomer;
    }

    let [courier] = await db
      .select()
      .from(couriers)
      .where(and(eq(couriers.storeId, req.storeId), eq(couriers.id, parsed.courierId)));

    if (!courier) {
      const [insertedCourier] = await db
        .insert(couriers)
        .values({
          id: parsed.courierId,
          storeId: req.storeId,
          name: parsed.courierId,
          successRate: '0.85',
          forwardCost: 80,
          reverseCost: 90,
        })
        .onConflictDoNothing()
        .returning();
      courier = insertedCourier;
    }

    let [pin] = await db
      .select()
      .from(pincodeStats)
      .where(and(eq(pincodeStats.storeId, req.storeId), eq(pincodeStats.code, parsed.pincode)));

    if (!pin) {
      const [insertedPin] = await db
        .insert(pincodeStats)
        .values({
          id: `${req.storeId}:${parsed.pincode}`,
          storeId: req.storeId,
          code: parsed.pincode,
          city: 'Delhi',
          state: 'Delhi',
          rtoRate: '0.20',
          successRate: '0.85',
        })
        .onConflictDoNothing()
        .returning();
      pin = insertedPin;
    }

    const orderId = parsed.id || `MP-${Math.floor(1000 + Math.random() * 9000)}`;
    const timelineLabel = `Order placed · ${parsed.campaign || 'Direct'}`;

    let score = 50;
    let pRto = 0.2;
    let bestJourney = 'Full COD';

    if (product && customer && pin && courier) {
      const evaluation = evaluate(
        {
          id: orderId,
          productId: product.id,
          customerId: customer.id,
          courierId: courier.id,
          pincode: pin.code,
          qty: parsed.qty || 1,
          value: parsed.value,
          payment: parsed.payment as any,
          address: parsed.address,
          addressComplete: true,
          addressVerified: false,
          otpPassed: false,
          advancePaid: false,
          campaign: parsed.campaign || 'Direct',
          status: 'Confirmed',
          journey: 'Full COD',
          score: 50,
          created: new Date().toISOString().slice(0, 10),
          timeline: [{ label: timelineLabel, at: 'Just now' }],
        },
        {
          ...product,
          damageRate: Number(product.damageRate),
        },
        {
          ...pin,
          rtoRate: Number(pin.rtoRate),
          success: Number(pin.successRate),
        },
        {
          ...courier,
          forward: courier.forwardCost,
          reverse: courier.reverseCost,
          success: Number(courier.successRate),
        },
        {
          orders: customer.ordersCount,
          rtos: customer.rtosCount,
          prepaid: customer.prepaidCount,
        },
        DEFAULT_ENGINE_CONFIG,
      );
      score = evaluation.score;
      pRto = evaluation.pRto;
      bestJourney = evaluation.best.name;
    }

    const [created] = await db
      .insert(orders)
      .values({
        id: orderId,
        storeId: req.storeId,
        customerId: parsed.customerId,
        courierId: parsed.courierId,
        pincode: parsed.pincode,
        totalValue: parsed.value,
        paymentMethod: parsed.payment,
        address: parsed.address,
        campaign: parsed.campaign || 'Direct',
        status: 'Confirmed',
        journey: bestJourney,
        score,
        pRto: pRto.toString(),
        customerName: parsed.customerName || customer?.name,
        customerPhone: parsed.customerPhone || customer?.phone,
      })
      .returning();

    // Order item
    await db.insert(orderItems).values({
      id: `item-${created.id}-${parsed.productId}`,
      storeId: req.storeId,
      orderId: created.id,
      productId: parsed.productId,
      quantity: parsed.qty || 1,
      unitPrice: product?.price || parsed.value,
      unitCogs: product?.cogs || Math.round(parsed.value * 0.3),
    });

    // Timeline event
    await db.insert(orderEvents).values({
      id: `evt-${created.id}-0`,
      storeId: req.storeId,
      orderId: created.id,
      eventType: 'order_placed',
      label: timelineLabel,
      payload: { at: 'Just now' },
    });

    const queue = await getQueueBoss();
    if (queue) {
      await queue.send('order-scoring', { orderId: created.id, storeId: req.storeId });
    }

    res.status(201).json({
      id: created.id,
      productId: parsed.productId,
      customerId: created.customerId,
      courierId: created.courierId,
      pincode: created.pincode,
      qty: parsed.qty || 1,
      value: created.totalValue,
      payment: created.paymentMethod,
      address: created.address,
      addressComplete: created.addressComplete,
      addressVerified: created.addressVerified,
      otpPassed: created.otpPassed,
      advancePaid: created.advancePaid,
      campaign: created.campaign,
      status: created.status,
      journey: created.journey,
      score: created.score,
      created: created.createdAt.toISOString().slice(0, 10),
      timeline: [{ label: timelineLabel, at: 'Just now' }],
      customerName: created.customerName || undefined,
      customerPhone: created.customerPhone || undefined,
    });
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id
router.get('/orders/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = String(req.params.id);
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, req.storeId), eq(orders.id, orderId)));

    if (!order) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    const eventsList = await db
      .select()
      .from(orderEvents)
      .where(and(eq(orderEvents.storeId, req.storeId), eq(orderEvents.orderId, orderId)));
    const [item] = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.storeId, req.storeId), eq(orderItems.orderId, orderId)));

    res.json({
      id: order.id,
      productId: item?.productId || 'P01',
      customerId: order.customerId,
      courierId: order.courierId,
      pincode: order.pincode,
      qty: item?.quantity || 1,
      value: order.totalValue,
      payment: order.paymentMethod,
      address: order.address,
      addressComplete: order.addressComplete,
      addressVerified: order.addressVerified,
      otpPassed: order.otpPassed,
      advancePaid: order.advancePaid,
      campaign: order.campaign,
      status: order.status,
      journey: order.journey,
      score: order.score,
      created: order.createdAt.toISOString().slice(0, 10),
      timeline: eventsList.map((e) => ({ label: e.label, at: (e.payload as any)?.at || 'Just now' })),
      customerName: order.customerName || undefined,
      customerPhone: order.customerPhone || undefined,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /orders/:id
router.patch('/orders/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = String(req.params.id);
    const parsed = UpdateOrderBody.parse(req.body);
    const [existing] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, req.storeId), eq(orders.id, orderId)));

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    if (parsed.timelineLabel) {
      await db.insert(orderEvents).values({
        id: `evt-${orderId}-${Date.now()}`,
        storeId: req.storeId,
        orderId,
        eventType: 'timeline_label',
        label: parsed.timelineLabel,
        payload: { at: 'Just now' },
      });
    }

    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (parsed.status !== undefined) updatePayload.status = parsed.status;
    if (parsed.journey !== undefined) updatePayload.journey = parsed.journey;
    if (parsed.advancePaid !== undefined) updatePayload.advancePaid = parsed.advancePaid;
    if (parsed.addressVerified !== undefined) updatePayload.addressVerified = parsed.addressVerified;
    if (parsed.addressComplete !== undefined) updatePayload.addressComplete = parsed.addressComplete;
    if (parsed.otpPassed !== undefined) updatePayload.otpPassed = parsed.otpPassed;

    const [updated] = await db
      .update(orders)
      .set(updatePayload)
      .where(and(eq(orders.storeId, req.storeId), eq(orders.id, orderId)))
      .returning();

    const eventsList = await db
      .select()
      .from(orderEvents)
      .where(and(eq(orderEvents.storeId, req.storeId), eq(orderEvents.orderId, orderId)));
    const [item] = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.storeId, req.storeId), eq(orderItems.orderId, orderId)));

    res.json({
      id: updated.id,
      productId: item?.productId || 'P01',
      customerId: updated.customerId,
      courierId: updated.courierId,
      pincode: updated.pincode,
      qty: item?.quantity || 1,
      value: updated.totalValue,
      payment: updated.paymentMethod,
      address: updated.address,
      addressComplete: updated.addressComplete,
      addressVerified: updated.addressVerified,
      otpPassed: updated.otpPassed,
      advancePaid: updated.advancePaid,
      campaign: updated.campaign,
      status: updated.status,
      journey: updated.journey,
      score: updated.score,
      created: updated.createdAt.toISOString().slice(0, 10),
      timeline: eventsList.map((e) => ({ label: e.label, at: (e.payload as any)?.at || 'Just now' })),
      customerName: updated.customerName || undefined,
      customerPhone: updated.customerPhone || undefined,
    });
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/evaluate (Runs engine and persists decision record)
router.post('/orders/:id/evaluate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = String(req.params.id);
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, req.storeId), eq(orders.id, orderId)));

    if (!order) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    const [item] = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.storeId, req.storeId), eq(orderItems.orderId, orderId)));
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.storeId, req.storeId), eq(products.id, item?.productId || 'P01')));
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.storeId, req.storeId), eq(customers.id, order.customerId)));
    const [pin] = await db
      .select()
      .from(pincodeStats)
      .where(and(eq(pincodeStats.storeId, req.storeId), eq(pincodeStats.code, order.pincode)));
    const [courier] = await db
      .select()
      .from(couriers)
      .where(and(eq(couriers.storeId, req.storeId), eq(couriers.id, order.courierId)));

    const activePolicies = await db
      .select()
      .from(policies)
      .where(and(eq(policies.storeId, req.storeId), eq(policies.isActive, true)));

    // Fetch listing score if listing exists for this item/product
    let listingScoreRecord = null;
    const [matchingListing] = await db
      .select()
      .from(listings)
      .where(and(eq(listings.storeId, req.storeId), eq(listings.sku, item?.productId || '')));

    if (matchingListing) {
      const [scoreRow] = await db
        .select()
        .from(listingScores)
        .where(and(eq(listingScores.storeId, req.storeId), eq(listingScores.listingId, matchingListing.id)));
      if (scoreRow) {
        listingScoreRecord = scoreRow;
      }
    }

    const config: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      policies: activePolicies.map((p) => ({
        id: p.id,
        type: p.type as any,
        value: p.value,
        action: p.action as any,
      })),
      enableListingRiskModifier: activePolicies.some(
        (p) => p.type === 'listing_risk' && p.action === 'apply-modifier'
      ),
    };

    const evaluation = evaluate(
      {
        id: order.id,
        productId: item?.productId || 'P01',
        customerId: order.customerId,
        courierId: order.courierId,
        pincode: order.pincode,
        qty: item?.quantity || 1,
        value: order.totalValue,
        payment: order.paymentMethod as any,
        address: order.address,
        addressComplete: order.addressComplete,
        addressVerified: order.addressVerified,
        otpPassed: order.otpPassed,
        advancePaid: order.advancePaid,
        campaign: order.campaign,
        status: order.status,
        journey: order.journey,
        score: order.score,
        created: order.createdAt.toISOString().slice(0, 10),
        timeline: [],
      },
      {
        id: product?.id || 'P01',
        name: product?.name || 'Product',
        price: product?.price || order.totalValue,
        cogs: product?.cogs || Math.round(order.totalValue * 0.3),
        damageRate: Number(product?.damageRate || 0.02),
      },
      {
        code: pin?.code || order.pincode,
        city: pin?.city || 'City',
        state: pin?.state || 'State',
        rtoRate: Number(pin?.rtoRate || 0.2),
        success: Number(pin?.successRate || 0.85),
      },
      {
        id: courier?.id || order.courierId,
        name: courier?.name || 'Courier',
        forward: courier?.forwardCost || 80,
        reverse: courier?.reverseCost || 95,
        success: Number(courier?.successRate || 0.85),
      },
      {
        orders: customer?.ordersCount || 0,
        rtos: customer?.rtosCount || 0,
        prepaid: customer?.prepaidCount || 0,
      },
      config,
      undefined,
      config.enableListingRiskModifier && listingScoreRecord
        ? {
            riskModifier: listingScoreRecord.riskModifier,
            dominantIssue: listingScoreRecord.dominantIssue,
          }
        : null,
    );

    // Persist audited decision row
    const decisionId = `dec_${orderId}_${Date.now()}`;
    await db.insert(decisions).values({
      id: decisionId,
      storeId: req.storeId,
      orderId,
      inputsSnapshot: { order, product, pin, courier, customer },
      score: evaluation.score,
      factorBreakdown: evaluation.factors,
      chosenJourney: evaluation.best.name,
      journeyEvaluations: evaluation.journeys,
      explanation: evaluation.explanation,
      policyVersion: 'v1.0',
    });

    // Update order with new score and chosen journey
    await db
      .update(orders)
      .set({
        score: evaluation.score,
        journey: evaluation.best.name,
        pRto: evaluation.pRto.toString(),
        updatedAt: new Date(),
      })
      .where(and(eq(orders.storeId, req.storeId), eq(orders.id, orderId)));

    res.json(evaluation);
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/events (Simulates events and auto re-scores)
router.post('/orders/:id/events', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = String(req.params.id);
    const parsed = AddOrderEventBody.parse(req.body);
    const [existing] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, req.storeId), eq(orders.id, orderId)));

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    const label = parsed.event;
    const addressVerified = existing.addressVerified || label === 'address_verified' || label === 'Address verified';
    const addressComplete = existing.addressComplete || addressVerified;
    const otpPassed = existing.otpPassed || label === 'otp_passed' || label === 'OTP passed';
    const advancePaid = existing.advancePaid || label === 'advance_paid' || label === 'Advance paid';

    let status = existing.status;
    if (label === 'ndr_raised' || label === 'NDR raised') status = 'NDR raised';
    else if (label === 'rto_initiated' || label === 'RTO initiated') status = 'RTO initiated';
    else if (label === 'delivery_attempted' || label === 'Delivery attempted') status = 'Out for delivery';
    else if (addressVerified) status = 'Address verified';
    else if (otpPassed) status = 'Confirmed';

    // Record timeline event
    await db.insert(orderEvents).values({
      id: `evt-${orderId}-${Date.now()}`,
      storeId: req.storeId,
      orderId,
      eventType: label,
      label,
      payload: { at: 'Just now' },
    });

    // If NDR raised, upsert ndrCase
    if (status === 'NDR raised') {
      await db
        .insert(ndrCases)
        .values({
          id: `ndr_${orderId}`,
          storeId: req.storeId,
          orderId,
          reason: 'Customer unreachable',
          rescueAction: 'WhatsApp + call + reschedule',
          rescueMessage: 'Our courier could not reach you. Please confirm delivery slot.',
          includesGoodwill: false,
          status: 'open',
        })
        .onConflictDoNothing();
    }

    // If RTO initiated, upsert rtoCase
    if (status === 'RTO initiated') {
      await db
        .insert(rtoCases)
        .values({
          id: `rto_${orderId}`,
          storeId: req.storeId,
          orderId,
          recoveryAction: 'Restock to nearest warehouse',
          inventoryRoute: 'Restock',
          recoveredValue: 0,
          status: 'in_transit',
        })
        .onConflictDoNothing();
    }

    // Load related models to auto re-score with lib/engine
    const [item] = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.storeId, req.storeId), eq(orderItems.orderId, orderId)));
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.storeId, req.storeId), eq(products.id, item?.productId || 'P01')));
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.storeId, req.storeId), eq(customers.id, existing.customerId)));
    const [pin] = await db
      .select()
      .from(pincodeStats)
      .where(and(eq(pincodeStats.storeId, req.storeId), eq(pincodeStats.code, existing.pincode)));
    const [courier] = await db
      .select()
      .from(couriers)
      .where(and(eq(couriers.storeId, req.storeId), eq(couriers.id, existing.courierId)));

    let reScore = existing.score;
    let reJourney = existing.journey;
    let rePRto = existing.pRto;

    if (product && customer && pin && courier) {
      const evaluation = evaluate(
        {
          id: existing.id,
          productId: item?.productId || 'P01',
          customerId: existing.customerId,
          courierId: existing.courierId,
          pincode: existing.pincode,
          qty: item?.quantity || 1,
          value: existing.totalValue,
          payment: existing.paymentMethod as any,
          address: existing.address,
          addressComplete,
          addressVerified,
          otpPassed,
          advancePaid,
          campaign: existing.campaign,
          status,
          journey: existing.journey,
          score: existing.score,
          created: existing.createdAt.toISOString().slice(0, 10),
          timeline: [],
        },
        {
          ...product,
          damageRate: Number(product.damageRate),
        },
        {
          ...pin,
          rtoRate: Number(pin.rtoRate),
          success: Number(pin.successRate),
        },
        {
          ...courier,
          forward: courier.forwardCost,
          reverse: courier.reverseCost,
          success: Number(courier.successRate),
        },
        {
          orders: customer.ordersCount,
          rtos: customer.rtosCount,
          prepaid: customer.prepaidCount,
        },
        DEFAULT_ENGINE_CONFIG,
      );
      reScore = evaluation.score;
      reJourney = evaluation.best.name;
      rePRto = evaluation.pRto.toString();
    }

    const [updated] = await db
      .update(orders)
      .set({
        addressVerified,
        addressComplete,
        otpPassed,
        advancePaid,
        status,
        score: reScore,
        journey: reJourney,
        pRto: rePRto,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.storeId, req.storeId), eq(orders.id, orderId)))
      .returning();

    const eventsList = await db
      .select()
      .from(orderEvents)
      .where(and(eq(orderEvents.storeId, req.storeId), eq(orderEvents.orderId, orderId)));

    res.json({
      id: updated.id,
      productId: item?.productId || 'P01',
      customerId: updated.customerId,
      courierId: updated.courierId,
      pincode: updated.pincode,
      qty: item?.quantity || 1,
      value: updated.totalValue,
      payment: updated.paymentMethod,
      address: updated.address,
      addressComplete: updated.addressComplete,
      addressVerified: updated.addressVerified,
      otpPassed: updated.otpPassed,
      advancePaid: updated.advancePaid,
      campaign: updated.campaign,
      status: updated.status,
      journey: updated.journey,
      score: updated.score,
      created: updated.createdAt.toISOString().slice(0, 10),
      timeline: eventsList.map((e) => ({ label: e.label, at: (e.payload as any)?.at || 'Just now' })),
      customerName: updated.customerName || undefined,
      customerPhone: updated.customerPhone || undefined,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
