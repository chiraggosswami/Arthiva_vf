import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// -------------------------------------------------------------
// 1. Stores (Tenants)
// -------------------------------------------------------------
export const stores = pgTable('stores', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').notNull().default('INR'),
  shopifySharedSecret: text('shopify_shared_secret'),
  woocommerceWebhookSecret: text('woocommerce_webhook_secret'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// -------------------------------------------------------------
// 2. Users
// -------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull().default(''),
    refreshTokenHash: text('refresh_token_hash'),
    name: text('name').notNull(),
    role: text('role').notNull().default('operator'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('users_store_created_idx').on(t.storeId, t.createdAt),
    index('users_store_email_idx').on(t.storeId, t.email),
  ],
);

// -------------------------------------------------------------
// 3. API Keys
// -------------------------------------------------------------
export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    keyHash: text('key_hash').notNull(),
    name: text('name').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('api_keys_store_created_idx').on(t.storeId, t.createdAt),
  ],
);

// -------------------------------------------------------------
// 4. Products
// -------------------------------------------------------------
export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    price: integer('price').notNull(),
    cogs: integer('cogs').notNull(),
    damageRate: numeric('damage_rate').notNull().default('0.02'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('products_store_created_idx').on(t.storeId, t.createdAt),
  ],
);

// -------------------------------------------------------------
// 5. Customers
// -------------------------------------------------------------
export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    city: text('city').notNull(),
    ordersCount: integer('orders_count').notNull().default(0),
    rtosCount: integer('rtos_count').notNull().default(0),
    prepaidCount: integer('prepaid_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('customers_store_created_idx').on(t.storeId, t.createdAt),
    index('customers_store_phone_idx').on(t.storeId, t.phone),
  ],
);

// -------------------------------------------------------------
// 6. Couriers
// -------------------------------------------------------------
export const couriers = pgTable(
  'couriers',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    successRate: numeric('success_rate').notNull().default('0.85'),
    forwardCost: integer('forward_cost').notNull().default(80),
    reverseCost: integer('reverse_cost').notNull().default(90),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('couriers_store_created_idx').on(t.storeId, t.createdAt),
  ],
);

// -------------------------------------------------------------
// 7. Pincode Stats (Per-store or national)
// -------------------------------------------------------------
export const pincodeStats = pgTable(
  'pincode_stats',
  {
    id: text('id').primaryKey(), // storeId + ':' + code
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    rtoRate: numeric('rto_rate').notNull().default('0.20'),
    successRate: numeric('success_rate').notNull().default('0.85'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pincode_stats_store_created_idx').on(t.storeId, t.createdAt),
    index('pincode_stats_store_code_idx').on(t.storeId, t.code),
  ],
);

// -------------------------------------------------------------
// 8. Orders
// -------------------------------------------------------------
export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    courierId: text('courier_id')
      .notNull()
      .references(() => couriers.id),
    pincode: text('pincode').notNull(),
    totalValue: integer('total_value').notNull(),
    paymentMethod: text('payment_method').notNull(), // COD, Prepaid, Partial COD
    status: text('status').notNull().default('Confirmed'),
    journey: text('journey').notNull().default('Full COD'),
    score: integer('score').notNull().default(50),
    pRto: numeric('p_rto').notNull().default('0.20'),
    campaign: text('campaign').notNull().default('Direct'),
    address: text('address').notNull(),
    addressComplete: boolean('address_complete').notNull().default(true),
    addressVerified: boolean('address_verified').notNull().default(false),
    otpPassed: boolean('otp_passed').notNull().default(false),
    advancePaid: boolean('advance_paid').notNull().default(false),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('orders_store_created_idx').on(t.storeId, t.createdAt),
    index('orders_store_status_idx').on(t.storeId, t.status),
    index('orders_store_customer_idx').on(t.storeId, t.customerId),
  ],
);

// -------------------------------------------------------------
// 9. Order Items
// -------------------------------------------------------------
export const orderItems = pgTable(
  'order_items',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull(),
    unitCogs: integer('unit_cogs').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('order_items_store_created_idx').on(t.storeId, t.createdAt),
    index('order_items_store_order_idx').on(t.storeId, t.orderId),
  ],
);

// -------------------------------------------------------------
// 10. Shipments
// -------------------------------------------------------------
export const shipments = pgTable(
  'shipments',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    courierId: text('courier_id')
      .notNull()
      .references(() => couriers.id),
    awbNumber: text('awb_number').notNull(),
    trackingStatus: text('tracking_status').notNull().default('manifested'),
    forwardCost: integer('forward_cost').notNull().default(80),
    reverseCost: integer('reverse_cost').notNull().default(90),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('shipments_store_created_idx').on(t.storeId, t.createdAt),
    index('shipments_store_order_idx').on(t.storeId, t.orderId),
  ],
);

// -------------------------------------------------------------
// 11. NDR Cases
// -------------------------------------------------------------
export const ndrCases = pgTable(
  'ndr_cases',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    rescueAction: text('rescue_action').notNull(),
    rescueMessage: text('rescue_message').notNull(),
    includesGoodwill: boolean('includes_goodwill').notNull().default(false),
    status: text('status').notNull().default('open'), // open, resolved, escalated
    workflowStep: text('workflow_step').notNull().default('INITIAL_OUTREACH'), // INITIAL_OUTREACH, AWAITING_CUSTOMER_ACTION, FOLLOWUP_SCHEDULED, RESOLVED, ESCALATED_RTO
    attempts: integer('attempts').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    customerResponse: jsonb('customer_response'),
    paymentLinkId: text('payment_link_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ndr_cases_store_created_idx').on(t.storeId, t.createdAt),
    index('ndr_cases_store_order_idx').on(t.storeId, t.orderId),
  ],
);

// -------------------------------------------------------------
// 12. RTO Cases
// -------------------------------------------------------------
export const rtoCases = pgTable(
  'rto_cases',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    recoveryAction: text('recovery_action').notNull(),
    inventoryRoute: text('inventory_route').notNull(), // Return to warehouse, Restock, Refurbish, Write off
    recoveredValue: integer('recovered_value').notNull().default(0),
    status: text('status').notNull().default('in_transit'), // in_transit, received, restocked, written_off
    rootCause: text('root_cause'), // fake_attempt, customer_unreachable, address_issue, refused
    reasoning: text('reasoning'),
    optionsEvaluated: jsonb('options_evaluated'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('rto_cases_store_created_idx').on(t.storeId, t.createdAt),
    index('rto_cases_store_order_idx').on(t.storeId, t.orderId),
  ],
);

// -------------------------------------------------------------
// 13. Order Events (Append-only timeline)
// -------------------------------------------------------------
export const orderEvents = pgTable(
  'order_events',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    label: text('label').notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('order_events_store_created_idx').on(t.storeId, t.createdAt),
    index('order_events_store_order_idx').on(t.storeId, t.orderId),
  ],
);

// -------------------------------------------------------------
// 14. Decisions (Audited Engine Output)
// -------------------------------------------------------------
export const decisions = pgTable(
  'decisions',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    inputsSnapshot: jsonb('inputs_snapshot').notNull(),
    score: integer('score').notNull(),
    factorBreakdown: jsonb('factor_breakdown').notNull(),
    chosenJourney: text('chosen_journey').notNull(),
    journeyEvaluations: jsonb('journey_evaluations').notNull(),
    recommendedCourier: text('recommended_courier'),
    courierComparison: jsonb('courier_comparison'),
    explanation: text('explanation').notNull(),
    policyVersion: text('policy_version').notNull().default('v1.0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('decisions_store_created_idx').on(t.storeId, t.createdAt),
    index('decisions_store_order_idx').on(t.storeId, t.orderId),
  ],
);

// -------------------------------------------------------------
// 15. Messages
// -------------------------------------------------------------
export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(), // whatsapp, sms, ivr
    template: text('template').notNull(),
    content: text('content').notNull(),
    status: text('status').notNull().default('sent'), // sent, delivered, read, replied
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('messages_store_created_idx').on(t.storeId, t.createdAt),
    index('messages_store_order_idx').on(t.storeId, t.orderId),
  ],
);

// -------------------------------------------------------------
// 16. Payments
// -------------------------------------------------------------
export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // advance, full, refund
    amount: integer('amount').notNull(),
    status: text('status').notNull().default('completed'), // pending, completed, failed
    gateway: text('gateway').notNull().default('razorpay'),
    transactionId: text('transaction_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payments_store_created_idx').on(t.storeId, t.createdAt),
    index('payments_store_order_idx').on(t.storeId, t.orderId),
  ],
);

// -------------------------------------------------------------
// 17. Policies (Versioned rules & journey constants)
// -------------------------------------------------------------
export const policies = pgTable(
  'policies',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    version: text('version').notNull().default('v1.0'),
    type: text('type').notNull(), // pincode, channel, value
    value: text('value').notNull(),
    action: text('action').notNull(), // prepaid-only, human-review
    config: jsonb('config').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('policies_store_created_idx').on(t.storeId, t.createdAt),
  ],
);

// Alias enginePolicies for compatibility
export const enginePolicies = policies;

// -------------------------------------------------------------
// 18. Experiments (Holdout configuration)
// -------------------------------------------------------------
export const experiments = pgTable(
  'experiments',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    holdoutPct: integer('holdout_pct').notNull().default(10), // e.g. 10% un-intervened holdout
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('experiments_store_created_idx').on(t.storeId, t.createdAt),
  ],
);

// -------------------------------------------------------------
// 19. Webhook Events (Idempotent ingestion log)
// -------------------------------------------------------------
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // 'shopify' | 'woocommerce' | 'custom' | 'courier'
    externalId: text('external_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    headers: jsonb('headers').notNull().default({}),
    status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'processed' | 'failed' | 'ignored'
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    index('webhook_events_store_created_idx').on(t.storeId, t.createdAt),
    index('webhook_events_store_status_idx').on(t.storeId, t.status),
    uniqueIndex('webhook_events_dedupe_idx').on(t.storeId, t.source, t.externalId, t.eventType),
  ],
);

export const insertWebhookEventSchema = createInsertSchema(webhookEvents);
export const selectWebhookEventSchema = createSelectSchema(webhookEvents);
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = typeof webhookEvents.$inferInsert;

// -------------------------------------------------------------
// Zod Schemas & Inferred Types
// -------------------------------------------------------------
export const insertStoreSchema = createInsertSchema(stores);
export const selectStoreSchema = createSelectSchema(stores);
export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const insertApiKeySchema = createInsertSchema(apiKeys);
export const selectApiKeySchema = createSelectSchema(apiKeys);
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

export const insertProductSchema = createInsertSchema(products);
export const selectProductSchema = createSelectSchema(products);
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export const insertCustomerSchema = createInsertSchema(customers);
export const selectCustomerSchema = createSelectSchema(customers);
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

export const insertCourierSchema = createInsertSchema(couriers);
export const selectCourierSchema = createSelectSchema(couriers);
export type Courier = typeof couriers.$inferSelect;
export type InsertCourier = typeof couriers.$inferInsert;

export const insertPincodeStatSchema = createInsertSchema(pincodeStats);
export const selectPincodeStatSchema = createSelectSchema(pincodeStats);
export type PincodeStat = typeof pincodeStats.$inferSelect;
export type InsertPincodeStat = typeof pincodeStats.$inferInsert;

export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

export const insertOrderItemSchema = createInsertSchema(orderItems);
export const selectOrderItemSchema = createSelectSchema(orderItems);
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

export const insertShipmentSchema = createInsertSchema(shipments);
export const selectShipmentSchema = createSelectSchema(shipments);
export type Shipment = typeof shipments.$inferSelect;
export type InsertShipment = typeof shipments.$inferInsert;

export const insertNdrCaseSchema = createInsertSchema(ndrCases);
export const selectNdrCaseSchema = createSelectSchema(ndrCases);
export type NdrCase = typeof ndrCases.$inferSelect;
export type InsertNdrCase = typeof ndrCases.$inferInsert;

export const insertRtoCaseSchema = createInsertSchema(rtoCases);
export const selectRtoCaseSchema = createSelectSchema(rtoCases);
export type RtoCase = typeof rtoCases.$inferSelect;
export type InsertRtoCase = typeof rtoCases.$inferInsert;

export const insertOrderEventSchema = createInsertSchema(orderEvents);
export const selectOrderEventSchema = createSelectSchema(orderEvents);
export type OrderEvent = typeof orderEvents.$inferSelect;
export type InsertOrderEvent = typeof orderEvents.$inferInsert;

export const insertDecisionSchema = createInsertSchema(decisions);
export const selectDecisionSchema = createSelectSchema(decisions);
export type Decision = typeof decisions.$inferSelect;
export type InsertDecision = typeof decisions.$inferInsert;

export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export const insertPaymentSchema = createInsertSchema(payments);
export const selectPaymentSchema = createSelectSchema(payments);
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

export const insertPolicySchema = createInsertSchema(policies);
export const selectPolicySchema = createSelectSchema(policies);
export type Policy = typeof policies.$inferSelect;
export type InsertPolicy = typeof policies.$inferInsert;

export const insertExperimentSchema = createInsertSchema(experiments);
export const selectExperimentSchema = createSelectSchema(experiments);
export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = typeof experiments.$inferInsert;

// -------------------------------------------------------------
// 20. Listing Intelligence Tables
// -------------------------------------------------------------

// (1) listings
export const listings = pgTable(
  'listings',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    platform: text('platform').notNull(), // 'shopify' | 'amazon' | 'myntra' | 'flipkart' | 'woocommerce'
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('Apparel'),
    price: integer('price').notNull().default(0),
    attributes: jsonb('attributes').notNull().default({}),
    sizeChartPresent: boolean('size_chart_present').notNull().default(false),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('listings_store_created_idx').on(t.storeId, t.createdAt),
    index('listings_store_listing_created_idx').on(t.storeId, t.id, t.createdAt),
    index('listings_store_sku_idx').on(t.storeId, t.sku),
    uniqueIndex('listings_store_platform_sku_idx').on(t.storeId, t.platform, t.sku),
  ],
);

// (2) listing_images
export const listingImages = pgTable(
  'listing_images',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    listingId: text('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    type: text('type').notNull().default('catalog'), // 'catalog' | 'size_chart' | 'detail' | 'swatch'
    sortOrder: integer('sort_order').notNull().default(0),
    resolutionWidth: integer('resolution_width'),
    resolutionHeight: integer('resolution_height'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('listing_images_store_created_idx').on(t.storeId, t.createdAt),
    index('listing_images_store_listing_created_idx').on(t.storeId, t.listingId, t.createdAt),
  ],
);

// (3) reviews
export const reviews = pgTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    listingId: text('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    platform: text('platform').notNull(),
    externalReviewId: text('external_review_id'),
    rating: integer('rating').notNull(), // 1 to 5
    reviewText: text('review_text').notNull(),
    reviewDate: timestamp('review_date', { withTimezone: true }).notNull().defaultNow(),
    hasPhotos: boolean('has_photos').notNull().default(false),
    photoUrls: jsonb('photo_urls').notNull().default([]),
    textHash: text('text_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('reviews_store_created_idx').on(t.storeId, t.createdAt),
    index('reviews_store_listing_created_idx').on(t.storeId, t.listingId, t.createdAt),
    index('reviews_store_sku_idx').on(t.storeId, t.sku),
    index('reviews_text_hash_idx').on(t.storeId, t.textHash),
  ],
);

// (4) return_reasons
export const returnReasons = pgTable(
  'return_reasons',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    listingId: text('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    platform: text('platform').notNull(),
    orderId: text('order_id'),
    reportedReason: text('reported_reason').notNull(),
    customerComment: text('customer_comment').notNull().default(''),
    textHash: text('text_hash').notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('return_reasons_store_created_idx').on(t.storeId, t.createdAt),
    index('return_reasons_store_listing_created_idx').on(t.storeId, t.listingId, t.createdAt),
    index('return_reasons_store_sku_idx').on(t.storeId, t.sku),
  ],
);

// (5) review_analysis
export const reviewAnalysis = pgTable(
  'review_analysis',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    listingId: text('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    reviewId: text('review_id')
      .references(() => reviews.id, { onDelete: 'cascade' }),
    returnReasonId: text('return_reason_id')
      .references(() => returnReasons.id, { onDelete: 'cascade' }),
    sourceType: text('source_type').notNull(), // 'review' | 'return_reason'
    sentiment: text('sentiment').notNull(), // 'positive' | 'negative' | 'neutral'
    aspects: jsonb('aspects').notNull().default([]), // [{ aspect: string, polarity: 'positive' | 'negative' | 'neutral' }]
    causeLabel: text('cause_label').notNull(), // 'size_fit' | 'colour_mismatch' | 'description_mismatch' | 'image_mismatch' | 'quality' | 'damaged' | 'delivery' | 'expectation_gap' | 'price' | 'other'
    confidence: numeric('confidence').notNull().default('0.85'),
    analyzerType: text('analyzer_type').notNull(), // 'lexicon' | 'llm'
    textHash: text('text_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('review_analysis_store_created_idx').on(t.storeId, t.createdAt),
    index('review_analysis_store_listing_created_idx').on(t.storeId, t.listingId, t.createdAt),
    index('review_analysis_store_cause_idx').on(t.storeId, t.causeLabel),
    index('review_analysis_hash_idx').on(t.storeId, t.textHash),
  ],
);

// (6) listing_issues
export const listingIssues = pgTable(
  'listing_issues',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    listingId: text('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    issueType: text('issue_type').notNull(), // 'size_fit' | 'colour_mismatch' | 'description_mismatch' | 'image_mismatch' | 'missing_size_chart' | 'low_resolution' | 'customer_photo_contradiction'
    severity: text('severity').notNull().default('medium'), // 'critical' | 'high' | 'medium' | 'low'
    status: text('status').notNull().default('open'), // 'open' | 'acknowledged' | 'resolved' | 'ignored'
    evidenceText: text('evidence_text').notNull(),
    confidence: numeric('confidence').notNull().default('0.85'),
    suggestedAction: text('suggested_action').notNull(),
    isHumanReviewed: boolean('is_human_reviewed').notNull().default(false),
    resolutionNotes: text('resolution_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('listing_issues_store_created_idx').on(t.storeId, t.createdAt),
    index('listing_issues_store_listing_created_idx').on(t.storeId, t.listingId, t.createdAt),
    index('listing_issues_store_status_idx').on(t.storeId, t.status),
  ],
);

// (7) listing_scores
export const listingScores = pgTable(
  'listing_scores',
  {
    id: text('id').primaryKey(),
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    listingId: text('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    accuracyScore: integer('accuracy_score').notNull(), // 0 - 100
    listingCausedReturnCount: integer('listing_caused_return_count').notNull().default(0),
    totalReviewsCount: integer('total_reviews_count').notNull().default(0),
    totalReturnsCount: integer('total_returns_count').notNull().default(0),
    estimatedLoss: integer('estimated_loss').notNull().default(0),
    estimatedSaving: integer('estimated_saving').notNull().default(0),
    dominantIssue: text('dominant_issue'),
    riskModifier: integer('risk_modifier').notNull().default(0), // Points adjustment to order score (-15 to +5)
    assumptions: jsonb('assumptions').notNull().default({}),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('listing_scores_store_created_idx').on(t.storeId, t.createdAt),
    index('listing_scores_store_listing_created_idx').on(t.storeId, t.listingId, t.createdAt),
  ],
);

// Schemas & Types for Listing Intelligence
export const insertListingSchema = createInsertSchema(listings);
export const selectListingSchema = createSelectSchema(listings);
export type Listing = typeof listings.$inferSelect;
export type InsertListing = typeof listings.$inferInsert;

export const insertListingImageSchema = createInsertSchema(listingImages);
export const selectListingImageSchema = createSelectSchema(listingImages);
export type ListingImage = typeof listingImages.$inferSelect;
export type InsertListingImage = typeof listingImages.$inferInsert;

export const insertReviewSchema = createInsertSchema(reviews);
export const selectReviewSchema = createSelectSchema(reviews);
export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

export const insertReturnReasonSchema = createInsertSchema(returnReasons);
export const selectReturnReasonSchema = createSelectSchema(returnReasons);
export type ReturnReason = typeof returnReasons.$inferSelect;
export type InsertReturnReason = typeof returnReasons.$inferInsert;

export const insertReviewAnalysisSchema = createInsertSchema(reviewAnalysis);
export const selectReviewAnalysisSchema = createSelectSchema(reviewAnalysis);
export type ReviewAnalysis = typeof reviewAnalysis.$inferSelect;
export type InsertReviewAnalysis = typeof reviewAnalysis.$inferInsert;

export const insertListingIssueSchema = createInsertSchema(listingIssues);
export const selectListingIssueSchema = createSelectSchema(listingIssues);
export type ListingIssue = typeof listingIssues.$inferSelect;
export type InsertListingIssue = typeof listingIssues.$inferInsert;

export const insertListingScoreSchema = createInsertSchema(listingScores);
export const selectListingScoreSchema = createSelectSchema(listingScores);
export type ListingScore = typeof listingScores.$inferSelect;
export type InsertListingScore = typeof listingScores.$inferInsert;