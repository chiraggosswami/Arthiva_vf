import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import app from '../src/app';
import { setupMemoryDb } from './setupDb';
import { db, stores, webhookEvents, orders, orderEvents, ndrCases, rtoCases, decisions, eq } from '@workspace/db';
import shopifyFixture from './fixtures/shopify-order.json';
import wcFixture from './fixtures/woocommerce-order.json';
import customFixture from './fixtures/custom-order.json';

describe('Event-Driven Webhook Ingestion & Idempotency Pipeline', () => {
  const testStoreId = 'store_test_webhooks';
  const shopifySecret = 'test_shopify_hmac_secret_key';
  const wcSecret = 'test_wc_signature_secret_key';

  beforeAll(async () => {
    await setupMemoryDb();

    // Create test store with secrets
    await db.insert(stores).values({
      id: testStoreId,
      name: 'Webhook Testing Store',
      currency: 'INR',
      shopifySharedSecret: shopifySecret,
      woocommerceWebhookSecret: wcSecret,
    });
  });

  function computeShopifyHmac(body: any, secret: string): string {
    const raw = Buffer.from(JSON.stringify(body));
    return crypto.createHmac('sha256', secret).update(raw).digest('base64');
  }

  function computeWcSignature(body: any, secret: string): string {
    const raw = Buffer.from(JSON.stringify(body));
    return crypto.createHmac('sha256', secret).update(raw).digest('base64');
  }

  describe('Shopify Webhook Receiver', () => {
    it('rejects Shopify webhook with invalid HMAC signature with 401', async () => {
      const res = await request(app)
        .post(`/webhooks/shopify/${testStoreId}`)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-hmac-sha256', 'invalid_hmac_signature')
        .send(shopifyFixture);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('accepts valid Shopify order webhook, ingests asynchronously and assigns journey', async () => {
      const hmac = computeShopifyHmac(shopifyFixture, shopifySecret);

      const res = await request(app)
        .post(`/webhooks/shopify/${testStoreId}`)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-hmac-sha256', hmac)
        .send(shopifyFixture);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('received');
      expect(res.body.orderId).toBe('SHOPIFY-1042');
      expect(res.body.eventId).toBeDefined();

      // Verify DB persistence of order and event
      const [ingestedOrder] = await db.select().from(orders).where(eq(orders.id, 'SHOPIFY-1042'));
      expect(ingestedOrder).toBeDefined();
      expect(ingestedOrder.storeId).toBe(testStoreId);
      expect(ingestedOrder.customerName).toBe('Meera Kapoor');
      expect(ingestedOrder.paymentMethod).toBe('COD');
      expect(ingestedOrder.totalValue).toBe(1899);

      // Verify webhook event record was logged as processed
      const [eventRecord] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, res.body.eventId));
      expect(eventRecord).toBeDefined();
      expect(eventRecord.status).toBe('processed');
    });

    it('deduplicates replayed Shopify webhook without double processing (Idempotency)', async () => {
      const hmac = computeShopifyHmac(shopifyFixture, shopifySecret);

      // Send the exact same webhook again
      const res = await request(app)
        .post(`/webhooks/shopify/${testStoreId}`)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-hmac-sha256', hmac)
        .send(shopifyFixture);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('duplicate_ignored');
      expect(res.body.externalId).toBe(String(shopifyFixture.id));

      // Ensure no duplicate orders or duplicate timeline items were created
      const allOrders = await db.select().from(orders).where(eq(orders.id, 'SHOPIFY-1042'));
      expect(allOrders.length).toBe(1);
    });
  });

  describe('WooCommerce Webhook Receiver', () => {
    it('rejects WooCommerce webhook with invalid signature with 401', async () => {
      const res = await request(app)
        .post(`/webhooks/woocommerce/${testStoreId}`)
        .set('x-wc-webhook-topic', 'action.woocommerce_new_order')
        .set('x-wc-webhook-signature', 'invalid_wc_sig')
        .send(wcFixture);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('accepts valid WooCommerce order webhook and ingests order', async () => {
      const sig = computeWcSignature(wcFixture, wcSecret);

      const res = await request(app)
        .post(`/webhooks/woocommerce/${testStoreId}`)
        .set('x-wc-webhook-topic', 'action.woocommerce_new_order')
        .set('x-wc-webhook-signature', sig)
        .send(wcFixture);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('received');
      expect(res.body.orderId).toBe('WC-55412');

      const [wcOrder] = await db.select().from(orders).where(eq(orders.id, 'WC-55412'));
      expect(wcOrder).toBeDefined();
      expect(wcOrder.customerName).toBe('Rahul Sharma');
      expect(wcOrder.totalValue).toBe(2499);
    });

    it('enforces idempotency on repeated WooCommerce payload', async () => {
      const sig = computeWcSignature(wcFixture, wcSecret);

      const res = await request(app)
        .post(`/webhooks/woocommerce/${testStoreId}`)
        .set('x-wc-webhook-topic', 'action.woocommerce_new_order')
        .set('x-wc-webhook-signature', sig)
        .send(wcFixture);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('duplicate_ignored');
    });
  });

  describe('Custom Webhook Receiver', () => {
    it('accepts custom ERP JSON order and enqueues ingestion', async () => {
      const res = await request(app)
        .post('/webhooks/custom')
        .set('x-store-id', testStoreId)
        .send(customFixture);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('received');
      expect(res.body.orderId).toBe('CUSTOM-ERP-ORD-9021');

      const [customOrder] = await db.select().from(orders).where(eq(orders.id, 'CUSTOM-ERP-ORD-9021'));
      expect(customOrder).toBeDefined();
      expect(customOrder.paymentMethod).toBe('Prepaid');
      expect(customOrder.totalValue).toBe(3199);
    });
  });

  describe('Courier Tracking Webhook Milestones & Re-scoring Flow', () => {
    it('processes courier delivery milestone for SHOPIFY-1042', async () => {
      const res = await request(app)
        .post('/webhooks/courier/delhivery')
        .set('x-store-id', testStoreId)
        .send({
          orderId: 'SHOPIFY-1042',
          awb: 'DELH-88291039',
          status: 'IN_TRANSIT',
          location: 'Delhi Hub',
          updated_at: new Date().toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('received');
      expect(res.body.milestone).toBe('IN_TRANSIT');

      // Verify timeline event inserted
      const events = await db
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, 'SHOPIFY-1042'));
      const inTransitEvent = events.find((e) => e.eventType === 'shipped');
      expect(inTransitEvent).toBeDefined();
    });

    it('processes NDR event, updates order status, creates ndr_cases row and dispatches rescue', async () => {
      const res = await request(app)
        .post('/webhooks/courier/delhivery')
        .set('x-store-id', testStoreId)
        .send({
          orderId: 'SHOPIFY-1042',
          awb: 'DELH-88291039-ndr',
          status: 'UNDELIVERED_CUSTOMER_UNREACHABLE',
          reason: 'Customer phone switched off',
          location: 'Gorakhpur Branch',
        });

      expect(res.status).toBe(200);
      expect(res.body.milestone).toBe('NDR');

      // Verify order status updated to NDR raised
      const [order] = await db.select().from(orders).where(eq(orders.id, 'SHOPIFY-1042'));
      expect(order.status).toBe('NDR raised');

      // Verify ndr_cases table has row
      const [ndrCase] = await db.select().from(ndrCases).where(eq(ndrCases.orderId, 'SHOPIFY-1042'));
      expect(ndrCase).toBeDefined();
      expect(ndrCase.status).toBe('open');
      expect(ndrCase.rescueAction).toContain('WhatsApp');
    });

    it('processes RTO initiated milestone and records rto_cases row', async () => {
      const res = await request(app)
        .post('/webhooks/courier/delhivery')
        .set('x-store-id', testStoreId)
        .send({
          orderId: 'SHOPIFY-1042',
          awb: 'DELH-88291039-rto',
          status: 'RTO_INITIATED',
          reason: '3 failed attempts',
        });

      expect(res.status).toBe(200);
      expect(res.body.milestone).toBe('RTO_INITIATED');

      const [order] = await db.select().from(orders).where(eq(orders.id, 'SHOPIFY-1042'));
      expect(order.status).toBe('RTO initiated');

      const [rtoCase] = await db.select().from(rtoCases).where(eq(rtoCases.orderId, 'SHOPIFY-1042'));
      expect(rtoCase).toBeDefined();
      expect(rtoCase.recoveredValue).toBeGreaterThan(0);
    });
  });

  describe('Webhook Replay Endpoint', () => {
    it('replays a stored webhook event via POST /webhooks/events/:id/replay', async () => {
      // Find an event from earlier
      const [event] = await db
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.storeId, testStoreId));
      expect(event).toBeDefined();

      const res = await request(app)
        .post(`/webhooks/events/${event.id}/replay`)
        .set('x-store-id', testStoreId);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('replayed');
      expect(res.body.eventId).toBe(event.id);
    });

    it('returns 404 for non-existent webhook event id replay', async () => {
      const res = await request(app)
        .post('/webhooks/events/whk_non_existent/replay')
        .set('x-store-id', testStoreId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
