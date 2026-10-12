import crypto from 'node:crypto';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const STORE_ID = process.env.STORE_ID || 'demo-store';
const SHOPIFY_SECRET = process.env.SHOPIFY_SECRET || process.env.SHOPIFY_WEBHOOK_SECRET || '';
const TOTAL_ORDERS = Number(process.env.COUNT || 25);
const RATE_PER_SEC = Number(process.env.RATE || 10);
const SIMULATE_COURIER = process.env.COURIER !== 'false';

// Realistic fixtures for Indian D2C load generation
const indianCustomers = [
  { name: 'Aarav Shah', phone: '+91 9810001001', city: 'Mumbai', zip: '400001' },
  { name: 'Meera Kapoor', phone: '+91 9810001002', city: 'Gorakhpur', zip: '273001' },
  { name: 'Rohan Mehta', phone: '+91 9810001003', city: 'Bengaluru', zip: '560001' },
  { name: 'Diya Rao', phone: '+91 9810001004', city: 'Delhi', zip: '110001' },
  { name: 'Kabir Singh', phone: '+91 9810001005', city: 'Lucknow', zip: '226001' },
  { name: 'Sana Nair', phone: '+91 9810001006', city: 'Jaipur', zip: '302001' },
  { name: 'Arjun Das', phone: '+91 9810001007', city: 'Kochi', zip: '682001' },
  { name: 'Ananya Roy', phone: '+91 9810001008', city: 'Kolkata', zip: '700001' },
  { name: 'Ishaan Bose', phone: '+91 9810001009', city: 'Indore', zip: '452001' },
  { name: 'Tara Verma', phone: '+91 9810001010', city: 'Patna', zip: '800001' },
];

const catalogItems = [
  { id: 'P01', title: 'Cedar & Fig Face Oil', price: 1899, grams: 250 },
  { id: 'P02', title: 'Daily Ritual Cleanser', price: 849, grams: 200 },
  { id: 'P03', title: 'Restore Night Serum', price: 2299, grams: 180 },
  { id: 'P04', title: 'Cloud Cotton Robe', price: 3190, grams: 650 },
  { id: 'P05', title: 'Mineral SPF 50', price: 1199, grams: 150 },
  { id: 'P06', title: 'The Saffron Gift Set', price: 2799, grams: 500 },
];

function createShopifyOrderPayload(orderIndex: number) {
  const customer = indianCustomers[orderIndex % indianCustomers.length];
  const item = catalogItems[orderIndex % catalogItems.length];
  const orderNumber = 10000 + orderIndex;
  const isCod = orderIndex % 4 !== 0; // 75% COD, 25% Prepaid
  const isHighRiskPincode = customer.zip === '273001' || customer.zip === '800001';

  return {
    id: 9000000000 + orderIndex,
    order_number: orderNumber,
    name: `#MP-${orderNumber}`,
    financial_status: isCod ? 'pending' : 'paid',
    gateway: isCod ? 'cash_on_delivery' : 'razorpay',
    total_price: String(item.price),
    subtotal_price: String(item.price),
    total_tax: '0.00',
    currency: 'INR',
    created_at: new Date().toISOString(),
    customer: {
      id: 50000 + (orderIndex % indianCustomers.length),
      first_name: customer.name.split(' ')[0],
      last_name: customer.name.split(' ')[1] || 'Kumar',
      phone: customer.phone,
      email: `${customer.name.toLowerCase().replace(/\s+/g, '.')}${orderIndex}@example.com`,
      orders_count: isHighRiskPincode ? 0 : 3,
    },
    shipping_address: {
      first_name: customer.name.split(' ')[0],
      last_name: customer.name.split(' ')[1] || 'Kumar',
      address1: `${10 + (orderIndex % 80)}, Sector ${3 + (orderIndex % 15)}, Near Market`,
      address2: orderIndex % 3 === 0 ? '' : 'Opposite City Center',
      city: customer.city,
      province: 'State',
      country: 'India',
      zip: customer.zip,
      phone: customer.phone,
    },
    line_items: [
      {
        id: 700000 + orderIndex,
        product_id: item.id,
        title: item.title,
        quantity: 1,
        price: String(item.price),
        grams: item.grams,
      },
    ],
    note_attributes: [
      { name: 'utm_source', value: orderIndex % 2 === 0 ? 'Instagram' : 'Meta prospecting' },
      { name: 'utm_campaign', value: 'monsoon_sale_2026' },
    ],
  };
}

function computeHmac(payload: any, secret: string): string {
  const raw = Buffer.from(JSON.stringify(payload));
  return crypto.createHmac('sha256', secret).update(raw).digest('base64');
}

async function sendShopifyOrder(orderIndex: number) {
  const payload = createShopifyOrderPayload(orderIndex);
  const hmac = computeHmac(payload, SHOPIFY_SECRET);
  const startTime = Date.now();

  try {
    const res = await fetch(`${API_URL}/webhooks/shopify/${STORE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shopify-topic': 'orders/create',
        'x-shopify-hmac-sha256': hmac,
        'x-shopify-shop-domain': `${STORE_ID}.myshopify.com`,
      },
      body: JSON.stringify(payload),
    });

    const latencyMs = Date.now() - startTime;
    const body = (await res.json().catch(() => ({}))) as any;

    return {
      success: res.ok,
      status: res.status,
      latencyMs,
      orderId: body?.orderId || `SHOPIFY-${payload.order_number}`,
      duplicate: body?.status === 'duplicate_ignored',
    };
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      latencyMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

async function sendCourierMilestone(orderId: string, milestone: string) {
  const awb = `DELH-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  try {
    const res = await fetch(`${API_URL}/webhooks/courier/delhivery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-store-id': STORE_ID,
      },
      body: JSON.stringify({
        orderId,
        awb,
        status: milestone,
        remarks: milestone === 'NDR' ? 'Customer mobile switched off during delivery' : undefined,
        location: 'Hub - Destination City',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runSimulation() {
  console.log('='.repeat(70));
  console.log('🚀 MARGIN PILOT: Event-Driven Ingestion Traffic Simulator');
  console.log('='.repeat(70));
  console.log(`Target URL:      ${API_URL}`);
  console.log(`Store ID:        ${STORE_ID}`);
  console.log(`Total Orders:    ${TOTAL_ORDERS}`);
  console.log(`Target Rate:     ${RATE_PER_SEC} orders/second`);
  console.log(`Courier Events:  ${SIMULATE_COURIER ? 'Enabled (In-transit, NDR/Delivered)' : 'Disabled'}`);
  console.log('-'.repeat(70));

  const latencies: number[] = [];
  let successful = 0;
  let failed = 0;
  let courierEventsSent = 0;
  const startedAt = Date.now();

  const delayMs = Math.max(10, Math.floor(1000 / RATE_PER_SEC));

  for (let i = 0; i < TOTAL_ORDERS; i++) {
    const result = await sendShopifyOrder(i);
    latencies.push(result.latencyMs);

    if (result.success) {
      successful++;
      process.stdout.write(`\r[${i + 1}/${TOTAL_ORDERS}] Ingested ${result.orderId} (${result.latencyMs}ms)`);

      // Optionally emit downstream courier milestones
      if (SIMULATE_COURIER && result.orderId) {
        // Emit in-transit
        await sendCourierMilestone(result.orderId, 'IN_TRANSIT');
        courierEventsSent++;

        // High risk pincodes or 20% of orders trigger NDR
        if (i % 5 === 0) {
          await sendCourierMilestone(result.orderId, 'NDR');
          courierEventsSent++;
        } else {
          await sendCourierMilestone(result.orderId, 'DELIVERED');
          courierEventsSent++;
        }
      }
    } else {
      failed++;
      console.log(`\n❌ Order ${i} failed: ${result.status} ${result.error || ''}`);
    }

    if (i < TOTAL_ORDERS - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // Idempotency check: replay the very first order to verify deduplication under load
  console.log('\n\nChecking Idempotency with immediate payload replay...');
  const replayResult = await sendShopifyOrder(0);
  console.log(`Idempotency Replay Result: status=${replayResult.status}, duplicate=${replayResult.duplicate}`);

  const totalDurationSec = (Date.now() - startedAt) / 1000;
  latencies.sort((a, b) => a - b);
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const effectiveRps = (TOTAL_ORDERS / totalDurationSec).toFixed(2);

  console.log('\n' + '='.repeat(70));
  console.log('📊 SIMULATION BENCHMARK SUMMARY');
  console.log('='.repeat(70));
  console.log(`Duration:              ${totalDurationSec.toFixed(2)} seconds`);
  console.log(`Orders Dispatched:     ${TOTAL_ORDERS}`);
  console.log(`Orders Succeeded:      ${successful}`);
  console.log(`Orders Failed:         ${failed}`);
  console.log(`Courier Events Sent:   ${courierEventsSent}`);
  console.log(`Effective Rate:        ${effectiveRps} orders/sec`);
  console.log(`Latency min / avg:     ${latencies[0] || 0}ms / ${avgLatency}ms`);
  console.log(`Latency p50 / p95 / p99: ${p50}ms / ${p95}ms / ${p99}ms`);
  console.log(`Idempotency Verified:  ${replayResult.duplicate ? '✅ PASSED (Deduplicated)' : '⚠️ Check response'}`);
  console.log('='.repeat(70));
}

// Execute if run directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runSimulation().catch((err) => {
    console.error('Fatal simulation error:', err);
    process.exit(1);
  });
}
