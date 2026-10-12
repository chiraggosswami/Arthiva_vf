import { db, pool } from '@workspace/db';
import {
  stores,
  products,
  customers,
  couriers,
  pincodeStats,
  orders,
  orderItems,
  orderEvents,
  decisions,
  ndrCases,
  rtoCases,
  policies,
  listings,
  listingImages,
  reviews,
  returnReasons,
  reviewAnalysis,
  listingIssues,
  listingScores,
  eq,
} from '@workspace/db';
import { createHash } from 'crypto';
import {
  evaluate,
  DEFAULT_ENGINE_CONFIG,
  type Product,
  type Customer,
  type Pin,
  type Courier,
  type Order,
  SEED_LISTINGS,
  generateSeedReviewsAndReturns,
  LexiconAnalyzer,
  calculateListingScore,
  type AnalyzedFeedbackItem,
} from '@workspace/engine';

const DEMO_STORE_ID = 'demo-store';

const seedProducts: Product[] = [
  { id: 'P01', name: 'Cedar & Fig Face Oil', price: 1899, cogs: 510, damageRate: 0.025 },
  { id: 'P02', name: 'Daily Ritual Cleanser', price: 849, cogs: 205, damageRate: 0.018 },
  { id: 'P03', name: 'Restore Night Serum', price: 2299, cogs: 620, damageRate: 0.03 },
  { id: 'P04', name: 'Cloud Cotton Robe', price: 3190, cogs: 1160, damageRate: 0.012 },
  { id: 'P05', name: 'Mineral SPF 50', price: 1199, cogs: 355, damageRate: 0.02 },
  { id: 'P06', name: 'The Saffron Gift Set', price: 2799, cogs: 870, damageRate: 0.035 },
  { id: 'P07', name: 'Barrier Repair Cream', price: 1499, cogs: 430, damageRate: 0.02 },
  { id: 'P08', name: 'Travel Skin Kit', price: 699, cogs: 188, damageRate: 0.028 },
];

const firstNames = ['Aarav', 'Ananya', 'Kabir', 'Meera', 'Ishaan', 'Sana', 'Rohan', 'Diya', 'Arjun', 'Tara', 'Vivaan', 'Nisha', 'Dev', 'Kavya', 'Neil', 'Ira', 'Reyansh', 'Aditi', 'Mihir', 'Zoya'];
const cities = ['Mumbai', 'Bengaluru', 'Delhi', 'Gorakhpur', 'Jaipur', 'Pune', 'Lucknow', 'Hyderabad', 'Kochi', 'Indore'];

const seedCustomers: Customer[] = Array.from({ length: 40 }, (_, i) => ({
  id: `C${String(i + 1).padStart(3, '0')}`,
  name: `${firstNames[i % 20]} ${['Shah', 'Kapoor', 'Rao', 'Singh', 'Mehta', 'Nair', 'Das', 'Bose'][i % 8]}`,
  phone: `+91 98${String(10000000 + i * 137).slice(0, 8)}`,
  city: cities[i % 10],
  orders: i % 7,
  rtos: i % 9 === 0 ? 1 : 0,
  prepaid: i % 4,
})).map((c) => (c.id === 'C004' ? { ...c, city: 'Gorakhpur', orders: 0, rtos: 0, prepaid: 0 } : c));

const pinData: [string, string, string, number, number][] = [
  ['273001', 'Gorakhpur', 'Uttar Pradesh', 0.42, 0.59],
  ['110001', 'New Delhi', 'Delhi', 0.13, 0.89],
  ['400001', 'Mumbai', 'Maharashtra', 0.12, 0.91],
  ['560001', 'Bengaluru', 'Karnataka', 0.1, 0.93],
  ['302001', 'Jaipur', 'Rajasthan', 0.21, 0.81],
  ['226001', 'Lucknow', 'Uttar Pradesh', 0.28, 0.74],
  ['411001', 'Pune', 'Maharashtra', 0.14, 0.88],
  ['500001', 'Hyderabad', 'Telangana', 0.16, 0.86],
  ['682001', 'Kochi', 'Kerala', 0.12, 0.9],
  ['452001', 'Indore', 'Madhya Pradesh', 0.19, 0.82],
  ['700001', 'Kolkata', 'West Bengal', 0.2, 0.8],
  ['600001', 'Chennai', 'Tamil Nadu', 0.13, 0.9],
  ['751001', 'Bhubaneswar', 'Odisha', 0.24, 0.77],
  ['800001', 'Patna', 'Bihar', 0.34, 0.67],
  ['462001', 'Bhopal', 'Madhya Pradesh', 0.22, 0.78],
  ['201301', 'Noida', 'Uttar Pradesh', 0.17, 0.85],
  ['122001', 'Gurugram', 'Haryana', 0.15, 0.87],
  ['395003', 'Surat', 'Gujarat', 0.18, 0.83],
  ['380001', 'Ahmedabad', 'Gujarat', 0.16, 0.85],
  ['641001', 'Coimbatore', 'Tamil Nadu', 0.14, 0.88],
  ['302017', 'Jaipur', 'Rajasthan', 0.24, 0.77],
  ['208001', 'Kanpur', 'Uttar Pradesh', 0.29, 0.73],
  ['226010', 'Lucknow', 'Uttar Pradesh', 0.25, 0.77],
  ['273002', 'Gorakhpur', 'Uttar Pradesh', 0.39, 0.62],
  ['221001', 'Varanasi', 'Uttar Pradesh', 0.31, 0.7],
];

const seedPincodes: Pin[] = pinData.map(([code, city, state, rtoRate, success]) => ({
  code,
  city,
  state,
  rtoRate,
  success,
}));

const seedCouriers: Courier[] = [
  { id: 'shiprocket', name: 'Shiprocket', success: 0.83, forward: 78, reverse: 92 },
  { id: 'delhivery', name: 'Delhivery', success: 0.88, forward: 82, reverse: 96 },
  { id: 'bluedart', name: 'Blue Dart', success: 0.93, forward: 108, reverse: 126 },
  { id: 'ecom', name: 'Ecom Express', success: 0.79, forward: 72, reverse: 90 },
  { id: 'xpressbees', name: 'Xpressbees', success: 0.85, forward: 75, reverse: 94 },
];

const campaigns = ['Instagram', 'Meta prospecting', 'Google Search', 'Direct', 'Email'];
const statusList = ['In transit', 'Confirmed', 'Out for delivery', 'Delivered', 'NDR raised', 'RTO initiated', 'Address check'];

const seedOrders: Order[] = Array.from({ length: 80 }, (_, i) => {
  const id = `MP-${String(963 + i).padStart(4, '0')}`;
  const product = seedProducts[i % 8];
  const c = seedCustomers[(i * 7) % 40];
  const pin = seedPincodes[(i * 3) % 25];
  const payment = (i % 5 === 0 ? 'Prepaid' : i % 7 === 0 ? 'Partial COD' : 'COD') as Order['payment'];
  const special = i === 79;
  return {
    id: special ? 'MP-1042' : id,
    productId: special ? 'P01' : product.id,
    customerId: special ? 'C004' : c.id,
    qty: 1 + (i % 3 === 0 ? 1 : 0),
    value: special ? 1899 : product.price * (1 + (i % 3 === 0 ? 1 : 0)),
    payment: special ? 'COD' : payment,
    address: special ? 'House 14, lane 3, near old post office' : `${12 + i} Lake View Road`,
    addressComplete: special ? false : i % 6 !== 0,
    addressVerified: false,
    otpPassed: false,
    campaign: special ? 'Instagram' : campaigns[i % 5],
    pincode: special ? '273001' : pin.code,
    courierId: seedCouriers[i % 5].id,
    status: special ? 'Address check' : statusList[i % 7],
    journey: special ? 'WhatsApp address verification' : ['Full COD', 'Partial COD 20% advance', 'Prepaid incentive 5% off', 'OTP', 'Human review'][i % 5],
    score: special ? 38 : 34 + ((i * 13) % 62),
    created: new Date(Date.now() - ((i * 7) % 30) * 86400000).toISOString().slice(0, 10),
    advancePaid: false,
    timeline: special
      ? [
          { label: 'Order placed · Instagram', at: 'Today, 09:42' },
          { label: 'Risk check flagged incomplete address', at: 'Today, 09:42' },
          { label: 'WhatsApp verification selected', at: 'Today, 09:43' },
        ]
      : [{ label: 'Order placed · ' + campaigns[i % 5], at: `${(i % 28) + 1} Jun, 10:${String(i % 60).padStart(2, '0')}` }],
  };
});

async function ensureDatabaseConnection() {
  try {
    await pool.query('SELECT 1');
  } catch (err: any) {
    console.log('Postgres connection unavailable; initializing in-memory PGlite with schema migrations...');
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { setTestDb } = await import('@workspace/db');
    const schema = await import('@workspace/db/schema');

    const client = new PGlite();
    let migrationsDir = path.resolve(process.cwd(), 'lib/db/migrations');
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.resolve(process.cwd(), '../lib/db/migrations');
    }
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      if (fs.existsSync(fullPath)) {
        const sqlContent = fs.readFileSync(fullPath, 'utf-8');
        const statements = sqlContent
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          try {
            await client.exec(stmt);
          } catch (e: any) {
            // ignore duplicate type or index creation error
          }
        }
      }
    }

    pool.query = async (text: any, params?: any) => {
      if (typeof text === 'string') {
        const res = await client.query(text, params);
        return { rows: res.rows, rowCount: res.rows.length };
      }
      const res = await client.query(text.text, text.values);
      return { rows: res.rows, rowCount: res.rows.length };
    };

    const pgliteDrizzle = drizzle(client, { schema });
    setTestDb(pgliteDrizzle, pool);
    console.log('In-memory database initialized successfully.');
  }
}

export async function runSeed() {
  await ensureDatabaseConnection();
  console.log(`Starting seed for store '${DEMO_STORE_ID}'...`);

  // 1. Demo Store
  await db
    .insert(stores)
    .values({
      id: DEMO_STORE_ID,
      name: 'Margin Pilot Demo Store',
      currency: 'INR',
    })
    .onConflictDoUpdate({
      target: stores.id,
      set: { name: 'Margin Pilot Demo Store', updatedAt: new Date() },
    });

  // 2. Products
  for (const p of seedProducts) {
    await db
      .insert(products)
      .values({
        id: p.id,
        storeId: DEMO_STORE_ID,
        name: p.name,
        price: p.price,
        cogs: p.cogs,
        damageRate: p.damageRate.toString(),
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: p.name,
          price: p.price,
          cogs: p.cogs,
          damageRate: p.damageRate.toString(),
          updatedAt: new Date(),
        },
      });
  }

  // 3. Couriers
  for (const c of seedCouriers) {
    await db
      .insert(couriers)
      .values({
        id: c.id,
        storeId: DEMO_STORE_ID,
        name: c.name,
        successRate: c.success.toString(),
        forwardCost: c.forward,
        reverseCost: c.reverse,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: couriers.id,
        set: {
          name: c.name,
          successRate: c.success.toString(),
          forwardCost: c.forward,
          reverseCost: c.reverse,
          updatedAt: new Date(),
        },
      });
  }

  // 4. Customers
  for (const c of seedCustomers) {
    await db
      .insert(customers)
      .values({
        id: c.id,
        storeId: DEMO_STORE_ID,
        name: c.name,
        phone: c.phone,
        city: c.city,
        ordersCount: c.orders,
        rtosCount: c.rtos,
        prepaidCount: c.prepaid,
      })
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          name: c.name,
          phone: c.phone,
          city: c.city,
          ordersCount: c.orders,
          rtosCount: c.rtos,
          prepaidCount: c.prepaid,
          updatedAt: new Date(),
        },
      });
  }

  // 5. Pincode Stats
  for (const pin of seedPincodes) {
    const id = `${DEMO_STORE_ID}:${pin.code}`;
    await db
      .insert(pincodeStats)
      .values({
        id,
        storeId: DEMO_STORE_ID,
        code: pin.code,
        city: pin.city,
        state: pin.state,
        rtoRate: pin.rtoRate.toString(),
        successRate: pin.success.toString(),
      })
      .onConflictDoUpdate({
        target: pincodeStats.id,
        set: {
          city: pin.city,
          state: pin.state,
          rtoRate: pin.rtoRate.toString(),
          successRate: pin.success.toString(),
          updatedAt: new Date(),
        },
      });
  }

  // 6. Default Policies
  const defaultPolicies = [
    { id: 'pol-pin-273001', type: 'pincode', value: '273001', action: 'prepaid-only' },
    { id: 'pol-ch-instagram', type: 'channel', value: 'Instagram', action: 'human-review' },
  ];
  for (const pol of defaultPolicies) {
    await db
      .insert(policies)
      .values({
        id: pol.id,
        storeId: DEMO_STORE_ID,
        type: pol.type,
        value: pol.value,
        action: pol.action,
        version: 'v1.0',
        isActive: true,
      })
      .onConflictDoUpdate({
        target: policies.id,
        set: {
          type: pol.type,
          value: pol.value,
          action: pol.action,
          updatedAt: new Date(),
        },
      });
  }

  // 7. Orders + Items + Decisions + Events
  for (const order of seedOrders) {
    const p = seedProducts.find((x) => x.id === order.productId)!;
    const pin = seedPincodes.find((x) => x.code === order.pincode)!;
    const courier = seedCouriers.find((x) => x.id === order.courierId)!;
    const cust = seedCustomers.find((x) => x.id === order.customerId)!;

    const evaluation = evaluate(
      order,
      p,
      pin,
      courier,
      {
        orders: cust.orders,
        rtos: cust.rtos,
        prepaid: cust.prepaid,
      },
      DEFAULT_ENGINE_CONFIG,
    );

    await db
      .insert(orders)
      .values({
        id: order.id,
        storeId: DEMO_STORE_ID,
        customerId: order.customerId,
        courierId: order.courierId,
        pincode: order.pincode,
        totalValue: order.value,
        paymentMethod: order.payment,
        status: order.status,
        journey: order.journey || evaluation.best.name,
        score: order.score || evaluation.score,
        pRto: evaluation.pRto.toString(),
        campaign: order.campaign,
        address: order.address,
        addressComplete: order.addressComplete,
        addressVerified: order.addressVerified,
        otpPassed: order.otpPassed,
        advancePaid: order.advancePaid,
        customerName: order.customerName || cust.name,
        customerPhone: order.customerPhone || cust.phone,
      })
      .onConflictDoUpdate({
        target: orders.id,
        set: {
          totalValue: order.value,
          status: order.status,
          journey: order.journey || evaluation.best.name,
          score: order.score || evaluation.score,
          pRto: evaluation.pRto.toString(),
          updatedAt: new Date(),
        },
      });

    const itemId = `item-${order.id}-${p.id}`;
    await db
      .insert(orderItems)
      .values({
        id: itemId,
        storeId: DEMO_STORE_ID,
        orderId: order.id,
        productId: p.id,
        quantity: order.qty || 1,
        unitPrice: p.price,
        unitCogs: p.cogs,
      })
      .onConflictDoNothing();

    const decisionId = `dec-${order.id}`;
    await db
      .insert(decisions)
      .values({
        id: decisionId,
        storeId: DEMO_STORE_ID,
        orderId: order.id,
        inputsSnapshot: { order, product: p, pin, courier, customer: cust },
        score: evaluation.score,
        factorBreakdown: evaluation.factors,
        chosenJourney: evaluation.best.name,
        journeyEvaluations: evaluation.journeys,
        explanation: evaluation.explanation,
        policyVersion: 'v1.0',
      })
      .onConflictDoNothing();

    for (let idx = 0; idx < (order.timeline || []).length; idx++) {
      const evt = order.timeline[idx];
      const eventId = `evt-${order.id}-${idx}`;
      await db
        .insert(orderEvents)
        .values({
          id: eventId,
          storeId: DEMO_STORE_ID,
          orderId: order.id,
          eventType: 'timeline_event',
          label: evt.label,
          payload: { at: evt.at },
        })
        .onConflictDoNothing();
    }

    if (order.status === 'NDR raised' || order.ndrReason) {
      const ndrId = `ndr-${order.id}`;
      await db
        .insert(ndrCases)
        .values({
          id: ndrId,
          storeId: DEMO_STORE_ID,
          orderId: order.id,
          reason: order.ndrReason || 'Customer unreachable',
          rescueAction: order.rescueAction || 'WhatsApp + call + reschedule',
          rescueMessage: order.rescueMessage || 'Delivery attempt follow-up',
          includesGoodwill: false,
          status: 'open',
        })
        .onConflictDoNothing();
    }

    if (order.status === 'RTO initiated') {
      const rtoId = `rto-${order.id}`;
      await db
        .insert(rtoCases)
        .values({
          id: rtoId,
          storeId: DEMO_STORE_ID,
          orderId: order.id,
          recoveryAction: order.recoveryAction || 'Restock to nearest warehouse',
          inventoryRoute: order.inventoryRoute || 'Restock',
          recoveredValue: order.recoveredValue || 0,
          status: 'in_transit',
        })
        .onConflictDoNothing();
    }
  }

  // ==========================================
  // SEED LISTING INTELLIGENCE MODULE DATA
  // ==========================================
  console.log('Seeding Listing Intelligence listings and catalog images...');
  const lexicon = new LexiconAnalyzer();
  const listingIdMap = new Map<string, string>();

  for (const s of SEED_LISTINGS) {
    const listingId = `lst_${DEMO_STORE_ID}_${s.platform}_${s.sku}`;
    listingIdMap.set(s.sku, listingId);

    await db
      .insert(listings)
      .values({
        id: listingId,
        storeId: DEMO_STORE_ID,
        sku: s.sku,
        platform: s.platform,
        title: s.title,
        description: s.description || '',
        category: s.category || 'Apparel',
        price: s.price,
        attributes: s.attributes || {},
        sizeChartPresent: s.sizeChartPresent ?? true,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    for (let i = 0; i < s.images.length; i++) {
      const img = s.images[i];
      await db
        .insert(listingImages)
        .values({
          id: `img_${listingId}_${i}`,
          storeId: DEMO_STORE_ID,
          listingId,
          url: img.url,
          type: img.type,
          sortOrder: i,
          resolutionWidth: img.resolutionWidth || 1200,
          resolutionHeight: img.resolutionHeight || 1200,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    }
  }

  console.log('Seeding reviews and return reasons (~600 rows)...');
  const { allReviews } = generateSeedReviewsAndReturns();
  const itemsByListing = new Map<string, AnalyzedFeedbackItem[]>();

  for (let i = 0; i < allReviews.length; i++) {
    const r = allReviews[i];
    const listingId = listingIdMap.get(r.sku) || `lst_${DEMO_STORE_ID}_${r.platform}_${r.sku}`;
    const cleanText = r.text.trim();
    const textHash = createHash('sha256').update(cleanText.toLowerCase()).digest('hex').slice(0, 16);
    const date = r.date ? new Date(r.date) : new Date();

    if (r.returnReason) {
      const retId = `ret_${DEMO_STORE_ID}_${i}`;
      await db
        .insert(returnReasons)
        .values({
          id: retId,
          storeId: DEMO_STORE_ID,
          listingId,
          sku: r.sku,
          platform: r.platform,
          reportedReason: r.returnReason,
          customerComment: cleanText,
          textHash,
          reportedAt: date,
          createdAt: date,
        })
        .onConflictDoNothing();
    } else {
      const revId = `rev_${DEMO_STORE_ID}_${i}`;
      await db
        .insert(reviews)
        .values({
          id: revId,
          storeId: DEMO_STORE_ID,
          listingId,
          sku: r.sku,
          platform: r.platform,
          rating: r.rating,
          reviewText: cleanText,
          reviewDate: date,
          hasPhotos: Boolean(r.hasPhotos),
          photoUrls: r.photoUrls || [],
          textHash,
          createdAt: date,
        })
        .onConflictDoNothing();
    }

    // Text analysis
    const analysis = await lexicon.analyzeText(cleanText);
    const analysisId = `an_${DEMO_STORE_ID}_${textHash}`;
    await db
      .insert(reviewAnalysis)
      .values({
        id: analysisId,
        storeId: DEMO_STORE_ID,
        listingId,
        reviewId: r.returnReason ? null : `rev_${DEMO_STORE_ID}_${i}`,
        returnReasonId: r.returnReason ? `ret_${DEMO_STORE_ID}_${i}` : null,
        sourceType: r.returnReason ? 'return_reason' : 'review',
        textHash,
        sentiment: analysis.sentiment,
        aspects: analysis.aspects,
        causeLabel: analysis.causeLabel,
        confidence: String(analysis.confidence),
        analyzerType: 'lexicon',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    const currentList = itemsByListing.get(listingId) || [];
    currentList.push({
      id: r.returnReason ? `ret_${DEMO_STORE_ID}_${i}` : `rev_${DEMO_STORE_ID}_${i}`,
      rating: r.rating,
      causeLabel: analysis.causeLabel,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      date,
      isReturn: Boolean(r.returnReason),
    });
    itemsByListing.set(listingId, currentList);
  }

  console.log('Calculating listing scores and creating listing issues...');
  for (const s of SEED_LISTINGS) {
    const listingId = listingIdMap.get(s.sku)!;
    const items = itemsByListing.get(listingId) || [];

    // Image checks
    if (!s.sizeChartPresent && s.category === 'Apparel') {
      await db
        .insert(listingIssues)
        .values({
          id: `iss_${listingId}_size_chart`,
          storeId: DEMO_STORE_ID,
          listingId,
          issueType: 'missing_size_chart',
          severity: 'high',
          status: 'open',
          evidenceText: 'Listing has no size chart attached for an Apparel product.',
          suggestedAction: 'Upload accurate size chart with bust, waist, and length measurements in cm and inches.',
          isHumanReviewed: false,
          confidence: '0.95',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }

    for (const img of s.images) {
      if ((img.resolutionWidth && img.resolutionWidth < 800) || (img.resolutionHeight && img.resolutionHeight < 800)) {
        await db
          .insert(listingIssues)
          .values({
            id: `iss_${listingId}_res_${img.type}`,
            storeId: DEMO_STORE_ID,
            listingId,
            issueType: 'image_resolution_low',
            severity: 'medium',
            status: 'open',
            evidenceText: `Catalog image resolution is ${img.resolutionWidth}x${img.resolutionHeight}px, below the 800px threshold.`,
            suggestedAction: 'Upload high-resolution image (minimum 1200x1200px) with zoom capability.',
            isHumanReviewed: false,
            confidence: '0.90',
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
      }
    }

    const scoreResult = calculateListingScore(items);

    if (scoreResult.accuracyScore < 70 && scoreResult.dominantIssue) {
      await db
        .insert(listingIssues)
        .values({
          id: `iss_${listingId}_dominant`,
          storeId: DEMO_STORE_ID,
          listingId,
          issueType: scoreResult.dominantIssue === 'colour_mismatch'
            ? 'colour_mismatch'
            : scoreResult.dominantIssue === 'size_fit'
            ? 'size_fit_mismatch'
            : 'description_mismatch',
          severity: scoreResult.accuracyScore < 50 ? 'critical' : 'high',
          status: 'open',
          evidenceText: `Accuracy score ${scoreResult.accuracyScore}/100. High return driver: ${scoreResult.dominantIssue} (${scoreResult.listingCausedReturnCount} listing-caused returns).`,
          suggestedAction: `Revise ${scoreResult.dominantIssue.replace('_', ' ')} details, update swatches or size guide immediately.`,
          isHumanReviewed: false,
          confidence: '0.88',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }

    await db
      .insert(listingScores)
      .values({
        id: `sc_${listingId}`,
        storeId: DEMO_STORE_ID,
        listingId,
        accuracyScore: scoreResult.accuracyScore,
        dominantIssue: scoreResult.dominantIssue,
        listingCausedReturnCount: scoreResult.listingCausedReturnCount,
        totalReviewsCount: scoreResult.totalReviewsCount,
        totalReturnsCount: scoreResult.totalReturnsCount,
        estimatedLoss: scoreResult.estimatedLoss,
        estimatedSaving: scoreResult.estimatedSaving,
        riskModifier: scoreResult.riskModifier,
        calculatedAt: new Date(),
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [listingScores.id],
        set: {
          accuracyScore: scoreResult.accuracyScore,
          dominantIssue: scoreResult.dominantIssue,
          listingCausedReturnCount: scoreResult.listingCausedReturnCount,
          totalReviewsCount: scoreResult.totalReviewsCount,
          totalReturnsCount: scoreResult.totalReturnsCount,
          estimatedLoss: scoreResult.estimatedLoss,
          estimatedSaving: scoreResult.estimatedSaving,
          riskModifier: scoreResult.riskModifier,
          calculatedAt: new Date(),
        },
      });
  }

  console.log('Seeded demo store successfully with 80 orders, MP-1042, items, events, decisions, and Listing Intelligence data.');

  console.log('\n======================================================');
  console.log('LISTING INTELLIGENCE SEED SUMMARY: FLAGGED SKUS & LOSSES');
  console.log('======================================================');
  const allListingScores = await db
    .select()
    .from(listingScores)
    .where(eq(listingScores.storeId, DEMO_STORE_ID));

  const allListingRows = await db
    .select()
    .from(listings)
    .where(eq(listings.storeId, DEMO_STORE_ID));

  const listingTitleMap = new Map(allListingRows.map((l) => [l.id, l.title]));
  const listingSkuMap = new Map(allListingRows.map((l) => [l.id, l.sku]));

  const flagged = allListingScores
    .filter((s) => s.accuracyScore < 70 || s.estimatedLoss > 0)
    .sort((a, b) => b.estimatedLoss - a.estimatedLoss);

  console.log(`Total SKUs seeded: ${allListingRows.length}`);
  console.log(`Flagged SKUs requiring attention (Score < 70 or Loss > 0): ${flagged.length}\n`);

  for (const f of flagged) {
    const sku = listingSkuMap.get(f.listingId) || f.listingId;
    const title = listingTitleMap.get(f.listingId) || '';
    console.log(`• SKU: ${sku.padEnd(12)} | Score: ${String(f.accuracyScore).padStart(3)}/100 | Dominant Issue: ${(f.dominantIssue || 'None').padEnd(22)} | Listing Returns: ${String(f.listingCausedReturnCount).padStart(2)} | Est. Loss: ₹${String(f.estimatedLoss).padStart(6)} | Est. Saving: ₹${String(f.estimatedSaving).padStart(6)}`);
    console.log(`  Title: "${title}"`);
  }
  console.log('======================================================\n');
}

if (process.argv[1]?.includes('seed')) {
  runSeed()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Seed execution error:', err);
      process.exit(1);
    });
}
