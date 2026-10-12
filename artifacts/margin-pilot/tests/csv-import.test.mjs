import assert from 'node:assert/strict';
import {
  RAVI_TOYS_SAMPLE_CSV,
  parseCsvText,
  autoDetectColumnMapping,
  parseAndValidateCsvRows,
  convertRowsToOrders,
} from '../src/engine/csvImporter.ts';
import { createSellerProfile } from '../src/data/sellers.ts';
import { DEFAULT_ENGINE_CONFIG } from '../src/engine/index.ts';

console.log('Testing Ravi Toys CSV Parsing & Engine Pipeline...');

// 1. Tokenizer test
const { headers, rows } = parseCsvText(RAVI_TOYS_SAMPLE_CSV);
assert.equal(headers.length, 11, 'Headers length should be 11');
assert.equal(rows.length, 10, 'Data rows count should be 10');
console.log('✔ Tokenizer correctly parsed 11 headers and 10 rows');

// 2. Mapping detection
const mapping = autoDetectColumnMapping(headers);
assert.equal(mapping.orderId, 'Order ID');
assert.equal(mapping.product, 'Catalog Product');
assert.equal(mapping.price, 'Price (INR)');
assert.equal(mapping.cogs, 'COGS (INR)');
assert.equal(mapping.unitMargin, 'Unit Margin (INR)');
assert.equal(mapping.customerName, 'Full Name');
assert.equal(mapping.customerPhone, 'Phone Number');
assert.equal(mapping.address, 'Street Address & Landmark');
assert.equal(mapping.compositeLocation, 'Destination Pincode, City, State, and RTO percentage');
assert.equal(mapping.payment, 'Payment Method');
assert.equal(mapping.campaign, 'Campaign Source');
console.log('✔ Auto-mapping matched all 11 Ravi Toys headers accurately');

// 3. Validation & Parsing
const parsedRows = parseAndValidateCsvRows(headers, rows, mapping, []);
assert.equal(parsedRows.length, 10);
assert.ok(parsedRows.every(r => r.status === 'valid' || r.status === 'warning'), 'All rows are usable');

const r1 = parsedRows[0];
assert.equal(r1.orderId, 'RT-8001');
assert.equal(r1.productName, 'Remote Control Stunt Car 4WD');
assert.equal(r1.price, 1499);
assert.equal(r1.cogs, 480);
assert.equal(r1.unitMargin, 1019);
assert.equal(r1.customerName, 'Vikram Malhotra');
assert.equal(r1.customerPhone, '+91 9820112345');
assert.equal(r1.pincode, '400001');
assert.equal(r1.city, 'Mumbai');
assert.equal(r1.rtoRate, 0.12);
assert.equal(r1.payment, 'COD');
assert.equal(r1.campaign, 'Instagram');
console.log('✔ Row 1 correctly parsed composite location (400001, Mumbai, 12%) and price/margin');

const r3 = parsedRows[2];
assert.equal(r3.orderId, 'RT-8003');
assert.equal(r3.pincode, '273001');
assert.equal(r3.city, 'Gorakhpur');
assert.equal(r3.rtoRate, 0.42);
console.log('✔ Row 3 correctly parsed high-risk Gorakhpur pincode (273001, 42% RTO)');

// 4. Intelligence Engine Ingestion
const seller = createSellerProfile(
  'Ravi Toys',
  'Traditional and modern Indian learning toys, puzzles, and die-cast models',
  'Kids & Learning Toys',
  0
);
assert.equal(seller.id, 'ravi-toys');

const couriers = [
  { id: 'delhivery', name: 'Delhivery', success: 0.88, forward: 82, reverse: 96 },
  { id: 'bluedart', name: 'Blue Dart', success: 0.93, forward: 108, reverse: 126 }
];

const { orders, products, pincodes, customers, summary } = convertRowsToOrders(
  seller,
  parsedRows,
  DEFAULT_ENGINE_CONFIG,
  couriers
);

assert.equal(orders.length, 10, '10 orders produced');
assert.equal(summary.validOrders, 10, '10 valid orders');
assert.equal(summary.inferenceFailures, 0, 'Zero inference failures');
assert.equal(summary.scoredOrders, 10, 'All 10 orders scored by engine');

orders.forEach(o => {
  assert.equal(o.sellerId, 'ravi-toys');
  assert.ok(typeof o.score === 'number' && o.score >= 0 && o.score <= 100, `Score is valid: ${o.score}`);
  assert.ok(Boolean(o.journey), `Journey assigned: ${o.journey}`);
});
console.log('✔ All 10 orders successfully associated with ravi-toys and scored by the engine:');
orders.forEach(o => {
  console.log(`   ${o.id}: Health Score ${o.score}/100, Recommended Journey: "${o.journey}", Payment: ${o.payment}`);
});

// 5. Duplicate Detection Test
const duplicateRowsCheck = parseAndValidateCsvRows(headers, rows, mapping, orders);
const dupCount = duplicateRowsCheck.filter(r => r.status === 'duplicate').length;
assert.equal(dupCount, 10, 'Re-validating same CSV recognizes all 10 as duplicates');
console.log('✔ Duplicate detection confirmed: all 10 orders recognized as existing duplicates');

console.log('✅ ALL RAVI TOYS CSV & INFERENCE TESTS PASSED!');
