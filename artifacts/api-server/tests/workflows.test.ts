import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import app from '../src/app';
import { setupMemoryDb } from './setupDb';
import { db, orders, orderEvents, ndrCases, rtoCases, eq } from '@workspace/db';
import { processWorkflowStep } from '../src/lib/workerHandlers';
import { MockMessageProvider, setMessageProviderForTesting } from '../src/lib/messaging';
import { MockPaymentProvider, setPaymentProviderForTesting } from '../src/lib/payments';

describe('Durable NDR Rescue & RTO Recovery Workflows and Webhooks', () => {
  const storeId = 'store_workflow_test';
  let mockMessageProvider: MockMessageProvider;
  let mockPaymentProvider: MockPaymentProvider;

  beforeAll(async () => {
    await setupMemoryDb();

    // Ensure store exists in stores table
    const { stores } = await import('@workspace/db');
    await db
      .insert(stores)
      .values({
        id: storeId,
        name: 'Workflow Testing Store',
        currency: 'INR',
      })
      .onConflictDoNothing();

    mockMessageProvider = new MockMessageProvider();
    setMessageProviderForTesting(mockMessageProvider);

    mockPaymentProvider = new MockPaymentProvider();
    setPaymentProviderForTesting(mockPaymentProvider);
  });

  it('1. NDR Workflow Timeline with Fake Clock: initial action, reminders, escalation', async () => {
    const orderId = 'MP-NDR-TIMELINE';

    // 1. Ingest test order
    const ingestRes = await request(app)
      .post('/webhooks/custom')
      .set('x-store-id', storeId)
      .send({
        id: orderId,
        orderNumber: '9901',
        totalPrice: 2499,
        paymentGateway: 'cod',
        customer: {
          id: 'cust-ndr-timeline',
          name: 'Rohit Sharma',
          phone: '+91 9876543210',
          city: 'Mumbai',
        },
        shippingAddress: {
          address1: 'Flat 402, High View Towers',
          city: 'Mumbai',
          zip: '400050',
          province: 'Maharashtra',
        },
        lineItems: [
          {
            id: 'item-1',
            title: 'Wireless Earbuds Pro',
            price: 2499,
            quantity: 1,
            cogs: 800,
          },
        ],
      });

    expect(ingestRes.status).toBe(200);

    // 2. Courier triggers ndr_raised
    const courierNdrRes = await request(app)
      .post('/webhooks/courier/delhivery')
      .set('x-store-id', storeId)
      .send({
        orderId,
        status: 'NDR',
        ndr_reason: 'Customer unavailable',
      });

    expect(courierNdrRes.status).toBe(200);

    // Verify NDR case created in AWAITING_CUSTOMER_ACTION
    const [ndrCase1] = await db.select().from(ndrCases).where(eq(ndrCases.orderId, orderId));
    expect(ndrCase1).toBeDefined();
    expect(ndrCase1.status).toBe('open');
    expect(ndrCase1.workflowStep).toBe('AWAITING_CUSTOMER_ACTION');
    expect(ndrCase1.attempts).toBe(1);

    // Verify WhatsApp template message sent
    const sentMsg = mockMessageProvider.sentMessages.find((m) => m.orderId === orderId);
    expect(sentMsg).toBeDefined();
    expect(sentMsg?.templateName).toBe('ndr_reconnect_whatsapp');
    expect(sentMsg?.rendered).toContain('Rohit');

    // 3. Fake clock advance to +4h: trigger follow-up reminder
    const fakeNow4h = new Date(Date.now() + 4 * 3600 * 1000);
    vi.setSystemTime(fakeNow4h);

    await processWorkflowStep({
      storeId,
      orderId,
      step: 'ndr_followup',
      metadata: { attempt: 2 },
    });

    const [ndrCase2] = await db.select().from(ndrCases).where(eq(ndrCases.orderId, orderId));
    expect(ndrCase2.attempts).toBe(2);
    expect(ndrCase2.workflowStep).toBe('FOLLOWUP_SCHEDULED');

    // 4. Fake clock advance to +24h: trigger next reminder
    const fakeNow24h = new Date(Date.now() + 24 * 3600 * 1000);
    vi.setSystemTime(fakeNow24h);

    await processWorkflowStep({
      storeId,
      orderId,
      step: 'ndr_followup',
      metadata: { attempt: 3 },
    });

    const [ndrCase3] = await db.select().from(ndrCases).where(eq(ndrCases.orderId, orderId));
    expect(ndrCase3.attempts).toBe(3);

    // 5. Final decision: SLA timeout reached without reply -> Escalate to RTO
    await processWorkflowStep({
      storeId,
      orderId,
      step: 'ndr_final_decision',
    });

    const [ndrCaseFinal] = await db.select().from(ndrCases).where(eq(ndrCases.orderId, orderId));
    expect(ndrCaseFinal.status).toBe('escalated');
    expect(ndrCaseFinal.workflowStep).toBe('ESCALATED_RTO');

    const [updatedOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(updatedOrder.status).toBe('RTO initiated');

    // Verify RTO case evaluated and recorded
    const [rtoCase] = await db.select().from(rtoCases).where(eq(rtoCases.orderId, orderId));
    expect(rtoCase).toBeDefined();
    expect(rtoCase.recoveryAction).toBeDefined();
    expect(rtoCase.optionsEvaluated).toBeDefined();

    vi.useRealTimers();
  });

  it('2. Inbound Message Webhook advances NDR workflow on CONFIRM', async () => {
    const orderId = 'MP-INBOUND-CONFIRM';

    // Ingest order
    await request(app)
      .post('/webhooks/custom')
      .set('x-store-id', storeId)
      .send({
        id: orderId,
        orderNumber: '9902',
        totalPrice: 1999,
        paymentGateway: 'cod',
        customer: {
          id: 'cust-inbound',
          name: 'Pooja Hegde',
          phone: '+91 9820011223',
          city: 'Bengaluru',
        },
        shippingAddress: {
          address1: '12th Cross, Indiranagar',
          city: 'Bengaluru',
          zip: '560038',
          province: 'Karnataka',
        },
        lineItems: [{ id: 'item-2', title: 'Running Shoes', price: 1999, quantity: 1, cogs: 600 }],
      });

    // Trigger NDR
    await request(app)
      .post('/webhooks/courier/delhivery')
      .set('x-store-id', storeId)
      .send({
        orderId,
        status: 'NDR',
        ndr_reason: 'Customer unavailable',
      });

    // Customer replies CONFIRM via inbound webhook
    const inboundRes = await request(app)
      .post('/webhooks/messages/inbound')
      .set('x-store-id', storeId)
      .send({
        orderId,
        from: '+91 9820011223',
        text: 'CONFIRM, please deliver tomorrow morning',
      });

    expect(inboundRes.status).toBe(200);
    expect(inboundRes.body.action).toBe('CONFIRM');

    // NDR case is now resolved
    const [ndr] = await db.select().from(ndrCases).where(eq(ndrCases.orderId, orderId));
    expect(ndr.status).toBe('resolved');
    expect(ndr.workflowStep).toBe('RESOLVED');

    // Order status updated to Out for delivery
    const [ord] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(ord.status).toBe('Out for delivery');
  });

  it('3. Razorpay Webhook signature verification and payment reconciliation', async () => {
    const orderId = 'MP-RZP-PAYMENT';

    // Ingest COD order
    await request(app)
      .post('/webhooks/custom')
      .set('x-store-id', storeId)
      .send({
        id: orderId,
        orderNumber: '9903',
        totalPrice: 2999,
        paymentGateway: 'cod',
        customer: {
          id: 'cust-rzp',
          name: 'Vikram Seth',
          phone: '+91 9988776655',
          city: 'Delhi',
        },
        shippingAddress: {
          address1: 'C-40 Hauz Khas',
          city: 'New Delhi',
          zip: '110016',
          province: 'Delhi',
        },
        lineItems: [{ id: 'item-3', title: 'Smart Watch', price: 2999, quantity: 1, cogs: 900 }],
      });

    const webhookSecret = 'rzp_mock_webhook_secret';
    const payloadObj = {
      event: 'payment_link.paid',
      payload: {
        payment_link: {
          entity: {
            id: 'plink_test_12345',
            amount: 299900, // 2999 INR in paise
            status: 'paid',
            notes: {
              orderId,
            },
          },
        },
      },
    };
    const rawPayload = JSON.stringify(payloadObj);

    // A. Invalid signature rejected
    const invalidRes = await request(app)
      .post('/webhooks/razorpay')
      .set('x-store-id', storeId)
      .set('x-razorpay-signature', 'invalid_signature_hex')
      .send(payloadObj);

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.code).toBe('INVALID_SIGNATURE');

    // B. Valid HMAC SHA256 signature accepted
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawPayload)
      .digest('hex');

    const validRes = await request(app)
      .post('/webhooks/razorpay')
      .set('x-store-id', storeId)
      .set('x-razorpay-signature', validSignature)
      .send(payloadObj);

    expect(validRes.status).toBe(200);
    expect(validRes.body.verified).toBe(true);

    // Verify order is now prepaid & advance paid
    const [ord] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(ord.advancePaid).toBe(true);
    expect(ord.paymentMethod).toBe('Prepaid');

    // C. Duplicate webhook is safe (idempotent)
    const duplicateRes = await request(app)
      .post('/webhooks/razorpay')
      .set('x-store-id', storeId)
      .set('x-razorpay-signature', validSignature)
      .send(payloadObj);

    expect(duplicateRes.status).toBe(200);
    expect(duplicateRes.body.status).toBe('duplicate_ignored');
  });

  it('4. RTO Reason Analysis Aggregation API', async () => {
    const res = await request(app)
      .get('/api/analytics/rto-causes')
      .set('x-store-id', storeId);

    expect(res.status).toBe(200);
    expect(res.body.totalCases).toBeGreaterThanOrEqual(1);
    expect(res.body.rootCauses).toBeDefined();
    expect(res.body.recoveryActions).toBeDefined();
  });
});
