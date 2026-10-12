import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { setupMemoryDb } from './setupDb';
import { db, orders, orderEvents, ndrCases, eq } from '@workspace/db';
import { MockMessageProvider, setMessageProviderForTesting } from '../src/lib/messaging';

describe('MP-1042 End-to-End Story Walkthrough', () => {
  const storeId = 'demo-store';
  const orderId = 'MP-1042';
  let mockMessageProvider: MockMessageProvider;

  beforeAll(async () => {
    await setupMemoryDb();

    // Ensure demo store exists
    const { stores } = await import('@workspace/db');
    await db
      .insert(stores)
      .values({
        id: storeId,
        name: 'Margin Pilot Demo Store',
        currency: 'INR',
      })
      .onConflictDoNothing();

    mockMessageProvider = new MockMessageProvider();
    setMessageProviderForTesting(mockMessageProvider);
  });

  it('runs MP-1042 story from webhook ingest to delivered and prints order_events timeline', async () => {
    // -------------------------------------------------------------
    // Step 1: Order Ingestion via Webhook (COD Order MP-1042)
    // -------------------------------------------------------------
    console.log('\n=============================================================');
    console.log(' STEP 1: Webhook Ingests COD Order MP-1042');
    console.log('=============================================================');

    const ingestRes = await request(app)
      .post('/webhooks/custom')
      .set('x-store-id', storeId)
      .send({
        id: orderId,
        orderNumber: '1042',
        totalPrice: 2899,
        paymentGateway: 'cod',
        customer: {
          id: 'cust-1042',
          name: 'Meera Kapoor',
          phone: '+91 9810000411',
          city: 'Gorakhpur',
        },
        shippingAddress: {
          address1: 'House 42, Civil Lines',
          city: 'Gorakhpur',
          zip: '273001',
          province: 'Uttar Pradesh',
        },
        lineItems: [
          {
            id: 'prod-noise-cancelling-headphones',
            title: 'Noise Cancelling Headphones',
            price: 2899,
            quantity: 1,
            cogs: 920,
          },
        ],
      });

    expect(ingestRes.status).toBe(200);

    // -------------------------------------------------------------
    // Step 2: Courier Dispatches & Marks Out for Delivery
    // -------------------------------------------------------------
    console.log('\n=============================================================');
    console.log(' STEP 2: Courier Marks Package Out for Delivery');
    console.log('=============================================================');

    const ofdRes = await request(app)
      .post('/webhooks/courier/delhivery')
      .set('x-store-id', storeId)
      .send({
        orderId,
        awb: 'DELH-MP1042-9988',
        status: 'OFD',
        location: 'Gorakhpur Hub',
      });

    expect(ofdRes.status).toBe(200);

    // -------------------------------------------------------------
    // Step 3: Courier Raises NDR (Customer Unreachable)
    // -------------------------------------------------------------
    console.log('\n=============================================================');
    console.log(' STEP 3: Courier Raises NDR (Customer Unreachable)');
    console.log('=============================================================');

    const ndrRes = await request(app)
      .post('/webhooks/courier/delhivery')
      .set('x-store-id', storeId)
      .send({
        orderId,
        awb: 'DELH-MP1042-9988',
        status: 'NDR',
        ndr_reason: 'Customer unreachable',
        location: 'Gorakhpur Hub',
      });

    expect(ndrRes.status).toBe(200);

    // Verify NDR rescue automated outreach dispatched
    const [ndrCase] = await db.select().from(ndrCases).where(eq(ndrCases.orderId, orderId));
    expect(ndrCase).toBeDefined();
    expect(ndrCase.status).toBe('open');
    expect(ndrCase.workflowStep).toBe('AWAITING_CUSTOMER_ACTION');

    const sentMessage = mockMessageProvider.sentMessages.find((m) => m.orderId === orderId);
    expect(sentMessage).toBeDefined();
    console.log(`[AUTOMATION DISPATCHED] WhatsApp message sent to ${sentMessage?.recipient}:`);
    console.log(`"${sentMessage?.rendered}"`);

    // -------------------------------------------------------------
    // Step 4: Customer Responds via Inbound WhatsApp Webhook
    // -------------------------------------------------------------
    console.log('\n=============================================================');
    console.log(' STEP 4: Customer Inbound Reply (CONFIRM Delivery Tomorrow)');
    console.log('=============================================================');

    const inboundRes = await request(app)
      .post('/webhooks/messages/inbound')
      .set('x-store-id', storeId)
      .send({
        orderId,
        from: '+91 9810000411',
        text: 'CONFIRM, please deliver tomorrow morning at House 42!',
      });

    expect(inboundRes.status).toBe(200);
    expect(inboundRes.body.action).toBe('CONFIRM');

    // Verify NDR case resolved & reattempt scheduled
    const [resolvedNdr] = await db.select().from(ndrCases).where(eq(ndrCases.orderId, orderId));
    expect(resolvedNdr.status).toBe('resolved');
    expect(resolvedNdr.workflowStep).toBe('RESOLVED');

    // -------------------------------------------------------------
    // Step 5: Courier Reattempts and Delivers Package
    // -------------------------------------------------------------
    console.log('\n=============================================================');
    console.log(' STEP 5: Courier Reattempts and Successfully Delivers');
    console.log('=============================================================');

    const deliveredRes = await request(app)
      .post('/webhooks/courier/delhivery')
      .set('x-store-id', storeId)
      .send({
        orderId,
        awb: 'DELH-MP1042-9988',
        status: 'DL',
        location: 'Gorakhpur Customer Address',
      });

    expect(deliveredRes.status).toBe(200);

    // Verify final order status
    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(finalOrder.status).toBe('Delivered');

    // -------------------------------------------------------------
    // Step 6: Fetch and Print Complete Audit Timeline from order_events
    // -------------------------------------------------------------
    console.log('\n=============================================================');
    console.log(' COMPLETE AUDIT TIMELINE (order_events) FOR MP-1042:');
    console.log('=============================================================');

    const timeline = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, orderId));

    // Sort chronologically by createdAt
    timeline.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    timeline.forEach((event, index) => {
      console.log(
        `#${index + 1} [${event.createdAt.toISOString()}] | TYPE: ${event.eventType.padEnd(25)} | LABEL: ${event.label}`
      );
      if (event.payload && Object.keys(event.payload).length > 0) {
        console.log(`    Payload Details: ${JSON.stringify(event.payload)}`);
      }
    });
    console.log('=============================================================\n');

    expect(timeline.length).toBeGreaterThanOrEqual(5);
  });
});
