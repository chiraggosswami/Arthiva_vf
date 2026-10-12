import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, webhookEvents, stores, orders, customers, ndrCases, eq, and } from '@workspace/db';
import { verifyShopifyHmac, verifyWooCommerceSignature } from '../lib/webhookAuth';
import { shopifyAdapter, woocommerceAdapter, customAdapter } from '../adapters';
import { enqueueOrderIngest, enqueueShipmentEvent, enqueueWorkflowStep } from '../lib/queue';
import {
  processOrderIngest,
  processShipmentEvent,
  processWorkflowStep,
  processPaymentReconcile,
} from '../lib/workerHandlers';
import { getCourierAdapter } from '../couriers';
import { getPaymentProvider } from '../lib/payments';
import { parseInboundMessage } from '../lib/messaging';
import { logger } from '../lib/logger';

const router: Router = Router();

// Helper to record webhook event idempotently
async function recordAndEnqueueEvent(opts: {
  storeId: string;
  source: 'shopify' | 'woocommerce' | 'custom' | 'courier';
  externalId: string;
  eventType: string;
  payload: any;
  headers: any;
}): Promise<{ eventId: string; isDuplicate: boolean }> {
  const { storeId, source, externalId, eventType, payload, headers } = opts;
  const eventId = `whk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const [inserted] = await db
      .insert(webhookEvents)
      .values({
        id: eventId,
        storeId,
        source,
        externalId,
        eventType,
        payload,
        headers,
        status: 'pending',
      })
      .onConflictDoNothing()
      .returning();

    if (!inserted) {
      logger.info({ storeId, source, externalId, eventType }, 'Duplicate webhook event received; ignoring');
      return { eventId: '', isDuplicate: true };
    }

    return { eventId: inserted.id, isDuplicate: false };
  } catch (err: any) {
    if (err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('duplicate')) {
      logger.info({ storeId, source, externalId, eventType }, 'Duplicate webhook caught by DB error; ignoring');
      return { eventId: '', isDuplicate: true };
    }
    throw err;
  }
}

// 1. POST /webhooks/shopify/:storeId
router.post('/webhooks/shopify/:storeId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = String(req.params.storeId);
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
    const topic = (req.headers['x-shopify-topic'] as string) || 'orders/create';
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

    const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
    if (!store) {
      res.status(404).json({ error: { code: 'STORE_NOT_FOUND', message: `Store ${storeId} not found` } });
      return;
    }

    const secret = store.shopifySharedSecret || process.env.SHOPIFY_WEBHOOK_SECRET || '';
    if (hmacHeader && !verifyShopifyHmac(rawBody, hmacHeader, secret)) {
      res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Shopify HMAC verification failed' } });
      return;
    }

    const externalId = String(req.body.id || req.body.order_number || '');
    const { eventId, isDuplicate } = await recordAndEnqueueEvent({
      storeId,
      source: 'shopify',
      externalId,
      eventType: topic,
      payload: req.body,
      headers: req.headers,
    });

    if (isDuplicate) {
      res.status(200).json({ status: 'duplicate_ignored', externalId });
      return;
    }

    // Normalize order
    const normalized = shopifyAdapter.normalize(req.body, storeId);

    // Enqueue for async worker; if pg-boss unavailable in development/test, process immediately
    const enqueued = await enqueueOrderIngest({
      storeId,
      source: 'shopify',
      externalId,
      order: normalized,
      webhookEventId: eventId,
    });

    if (!enqueued) {
      await processOrderIngest({
        storeId,
        source: 'shopify',
        externalId,
        order: normalized,
        webhookEventId: eventId,
      }).catch((e) => logger.error({ e }, 'Error in synchronous order ingest'));
    }

    res.status(200).json({ status: 'received', eventId, orderId: normalized.id });
  } catch (err) {
    next(err);
  }
});

// 2. POST /webhooks/woocommerce/:storeId
router.post('/webhooks/woocommerce/:storeId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = String(req.params.storeId);
    const signatureHeader = req.headers['x-wc-webhook-signature'] as string;
    const topic = (req.headers['x-wc-webhook-topic'] as string) || 'action.woocommerce_new_order';
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

    const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
    if (!store) {
      res.status(404).json({ error: { code: 'STORE_NOT_FOUND', message: `Store ${storeId} not found` } });
      return;
    }

    const secret = store.woocommerceWebhookSecret || process.env.WOOCOMMERCE_WEBHOOK_SECRET || '';
    if (signatureHeader && !verifyWooCommerceSignature(rawBody, signatureHeader, secret)) {
      res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'WooCommerce signature verification failed' } });
      return;
    }

    const externalId = String(req.body.id || req.body.number || '');
    const { eventId, isDuplicate } = await recordAndEnqueueEvent({
      storeId,
      source: 'woocommerce',
      externalId,
      eventType: topic,
      payload: req.body,
      headers: req.headers,
    });

    if (isDuplicate) {
      res.status(200).json({ status: 'duplicate_ignored', externalId });
      return;
    }

    const normalized = woocommerceAdapter.normalize(req.body, storeId);
    const enqueued = await enqueueOrderIngest({
      storeId,
      source: 'woocommerce',
      externalId,
      order: normalized,
      webhookEventId: eventId,
    });

    if (!enqueued) {
      await processOrderIngest({
        storeId,
        source: 'woocommerce',
        externalId,
        order: normalized,
        webhookEventId: eventId,
      }).catch((e) => logger.error({ e }, 'Error in synchronous order ingest'));
    }

    res.status(200).json({ status: 'received', eventId, orderId: normalized.id });
  } catch (err) {
    next(err);
  }
});

// 3. POST /webhooks/custom (Secured by API key / tenant middleware)
router.post('/webhooks/custom', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.storeId;
    const externalId = String(req.body.externalId || req.body.orderId || req.body.id || Date.now());
    const eventType = req.body.eventType || 'order.created';

    const { eventId, isDuplicate } = await recordAndEnqueueEvent({
      storeId,
      source: 'custom',
      externalId,
      eventType,
      payload: req.body,
      headers: req.headers,
    });

    if (isDuplicate) {
      res.status(200).json({ status: 'duplicate_ignored', externalId });
      return;
    }

    const normalized = customAdapter.normalize(req.body, storeId);
    const enqueued = await enqueueOrderIngest({
      storeId,
      source: 'custom',
      externalId,
      order: normalized,
      webhookEventId: eventId,
    });

    if (!enqueued) {
      await processOrderIngest({
        storeId,
        source: 'custom',
        externalId,
        order: normalized,
        webhookEventId: eventId,
      }).catch((e) => logger.error({ e }, 'Error in synchronous order ingest'));
    }

    res.status(200).json({ status: 'received', eventId, orderId: normalized.id });
  } catch (err) {
    next(err);
  }
});

// 4. POST /webhooks/courier/:courier (Courier status milestones)
router.post('/webhooks/courier/:courier', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const courier = String(req.params.courier);
    const courierAdapter = getCourierAdapter(courier);

    const storeId = (req.headers['x-store-id'] as string) || req.storeId || req.body.storeId || 'demo-store';
    const rawStatus = req.body.status || req.body.current_status || req.body.event || 'IN_TRANSIT';
    const mapping = courierAdapter.mapStatusToEvent(rawStatus, req.body);

    const orderId = req.body.orderId || req.body.order_id || req.body.reference_id;
    const awbNumber = req.body.awb || req.body.awb_number || req.body.tracking_number;
    const externalId = String(awbNumber || orderId || Date.now());

    const { eventId, isDuplicate } = await recordAndEnqueueEvent({
      storeId,
      source: 'courier',
      externalId,
      eventType: mapping.domainEvent,
      payload: req.body,
      headers: req.headers,
    });

    if (isDuplicate) {
      res.status(200).json({ status: 'duplicate_ignored', externalId });
      return;
    }

    const shipmentJobData = {
      storeId,
      orderId,
      courierId: courier,
      awbNumber,
      event: mapping.domainEvent,
      milestone: mapping.milestone,
      statusLabel: mapping.statusLabel,
      ndrReason: mapping.ndrReason,
      city: mapping.city,
      timestamp: mapping.timestamp,
      rawPayload: req.body,
      webhookEventId: eventId,
    };

    const enqueued = await enqueueShipmentEvent(shipmentJobData);
    if (!enqueued) {
      await processShipmentEvent(shipmentJobData).catch((e) => logger.error({ e }, 'Error in shipment event processing'));
    }

    res.status(200).json({
      status: 'received',
      eventId,
      domainEvent: mapping.domainEvent,
      milestone: mapping.milestone,
      orderId,
    });
  } catch (err) {
    next(err);
  }
});

// 5. POST /webhooks/events/:id/replay (Replay webhook endpoint)
router.post('/webhooks/events/:id/replay', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    const [event] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, id));

    if (!event) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `Webhook event ${id} not found` } });
      return;
    }

    await db
      .update(webhookEvents)
      .set({ status: 'processing', attempts: event.attempts + 1, error: null })
      .where(eq(webhookEvents.id, id));

    if (event.source === 'shopify' || event.source === 'woocommerce' || event.source === 'custom') {
      const adapter =
        event.source === 'shopify'
          ? shopifyAdapter
          : event.source === 'woocommerce'
          ? woocommerceAdapter
          : customAdapter;

      const normalized = adapter.normalize(event.payload, event.storeId);
      await processOrderIngest({
        storeId: event.storeId,
        source: event.source,
        externalId: event.externalId,
        order: normalized,
        webhookEventId: event.id,
      });
    }

    res.json({ status: 'replayed', eventId: id });
  } catch (err) {
    next(err);
  }
});

// 6. POST /webhooks/messages/inbound (Inbound replies from WhatsApp / SMS)
router.post('/webhooks/messages/inbound', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = (req.headers['x-store-id'] as string) || req.body.storeId || 'demo-store';
    // WhatsApp Cloud API sends entry[0].changes[0].value.messages[0], Twilio sends Body & From, or direct body
    let rawText = '';
    let fromNumber = '';
    let messageExternalId = '';

    if (req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const waMsg = req.body.entry[0].changes[0].value.messages[0];
      rawText = waMsg.text?.body || waMsg.button?.text || '';
      fromNumber = waMsg.from || '';
      messageExternalId = waMsg.id || '';
    } else if (req.body.Body || req.body.From) {
      rawText = req.body.Body || '';
      fromNumber = (req.body.From || '').replace(/^whatsapp:/i, '');
      messageExternalId = req.body.MessageSid || '';
    } else {
      rawText = req.body.text || req.body.message || '';
      fromNumber = req.body.from || req.body.phone || '';
      messageExternalId = req.body.messageId || `msg_${Date.now()}`;
    }

    const externalId = messageExternalId || `inbound_${Date.now()}`;
    const { eventId, isDuplicate } = await recordAndEnqueueEvent({
      storeId,
      source: 'custom',
      externalId,
      eventType: 'message.inbound',
      payload: req.body,
      headers: req.headers,
    });

    if (isDuplicate) {
      res.status(200).json({ status: 'duplicate_ignored', externalId });
      return;
    }

    const parsed = parseInboundMessage(rawText);
    logger.info({ storeId, fromNumber, rawText, parsed }, 'Received inbound reply message');

    // Find active order: by orderId in body, or match customer phone, or most recent NDR order
    let targetOrderId = req.body.orderId || req.body.order_id;

    if (!targetOrderId && fromNumber) {
      const cleanPhone = fromNumber.replace(/[^0-9]/g, '').slice(-10);
      const matchingOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.storeId, storeId));

      const foundOrder = matchingOrders.find((o) => {
        const p = (o.customerPhone || '').replace(/[^0-9]/g, '');
        return p.endsWith(cleanPhone);
      });
      targetOrderId = foundOrder?.id;
    }

    if (!targetOrderId) {
      // Find the most recent open NDR case
      const [recentNdr] = await db
        .select()
        .from(ndrCases)
        .where(and(eq(ndrCases.storeId, storeId), eq(ndrCases.status, 'open')));
      targetOrderId = recentNdr?.orderId;
    }

    if (targetOrderId && parsed.actionType !== 'UNKNOWN') {
      const workflowJob = {
        storeId,
        orderId: targetOrderId,
        step: 'customer_reply' as const,
        metadata: {
          ...parsed,
          from: fromNumber,
          text: rawText,
        },
      };

      const enqueued = await enqueueWorkflowStep(workflowJob);
      if (!enqueued) {
        await processWorkflowStep(workflowJob);
      }
    }

    res.status(200).json({
      status: 'received',
      eventId,
      orderId: targetOrderId,
      action: parsed.actionType,
      confidence: parsed.confidence,
    });
  } catch (err) {
    next(err);
  }
});

// 7. POST /webhooks/razorpay (Verified Razorpay Webhook)
router.post('/webhooks/razorpay', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
    const storeId = (req.headers['x-store-id'] as string) || 'demo-store';

    const paymentProvider = getPaymentProvider();
    const isValidSignature = paymentProvider.verifyWebhookSignature(rawBody, signature);

    if (!isValidSignature && signature) {
      logger.warn({ signature }, 'Invalid Razorpay webhook signature');
      res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' } });
      return;
    }

    const eventName = req.body.event || 'payment_link.paid';
    const paymentEntity = req.body.payload?.payment?.entity || req.body.payload?.payment_link?.entity || req.body;
    const paymentId = paymentEntity.id || `pay_${Date.now()}`;
    const externalId = String(req.body.id || paymentId);

    const { eventId, isDuplicate } = await recordAndEnqueueEvent({
      storeId,
      source: 'custom',
      externalId,
      eventType: eventName,
      payload: req.body,
      headers: req.headers,
    });

    if (isDuplicate) {
      res.status(200).json({ status: 'duplicate_ignored', externalId });
      return;
    }

    if (eventName === 'payment_link.paid' || eventName === 'payment.captured' || eventName === 'order.paid') {
      // Amount in paise -> convert to INR
      const rawAmount = paymentEntity.amount || 0;
      const amountInINR = rawAmount > 1000 ? Math.round(rawAmount / 100) : rawAmount;
      const orderId =
        paymentEntity.notes?.orderId ||
        paymentEntity.reference_id ||
        req.body.orderId ||
        req.body.order_id;

      if (orderId) {
        await processPaymentReconcile({
          storeId,
          orderId,
          amount: amountInINR,
          paymentId,
          method: 'Prepaid',
        });
      }
    }

    res.status(200).json({
      status: 'processed',
      eventId,
      provider: paymentProvider.name,
      verified: true,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
