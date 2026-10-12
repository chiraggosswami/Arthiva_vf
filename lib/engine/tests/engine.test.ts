import { describe, it, expect } from 'vitest';
import {
  scoreOrder,
  evaluate,
  DEFAULT_ENGINE_CONFIG,
  recommendNdrRescue,
  rankRecoveryActions,
  type Order,
  type Product,
  type Pin,
  type Courier,
  type Customer,
  type EngineConfig,
} from '../src';

describe('Engine: Scoring bounds & factor breakdown', () => {
  const dummyProduct: Product = {
    id: 'P01',
    name: 'Cedar & Fig Face Oil',
    price: 1899,
    cogs: 510,
    damageRate: 0.025,
  };

  const dummyPin: Pin = {
    code: '110001',
    city: 'New Delhi',
    state: 'Delhi',
    rtoRate: 0.13,
    success: 0.89,
  };

  const dummyCourier: Courier = {
    id: 'delhivery',
    name: 'Delhivery',
    success: 0.88,
    forward: 82,
    reverse: 96,
  };

  const dummyCustomer: Customer = {
    id: 'C001',
    name: 'Aarav Shah',
    phone: '+91 9810000000',
    city: 'Delhi',
    orders: 3,
    rtos: 0,
    prepaid: 2,
  };

  const dummyOrder: Order = {
    id: 'MP-1001',
    productId: dummyProduct.id,
    customerId: dummyCustomer.id,
    qty: 1,
    value: 1899,
    payment: 'COD',
    address: '12 Lake View Road',
    addressComplete: true,
    addressVerified: false,
    otpPassed: false,
    campaign: 'Google Search',
    pincode: dummyPin.code,
    courierId: dummyCourier.id,
    status: 'Confirmed',
    journey: 'Full COD',
    score: 50,
    created: '2026-06-01',
    advancePaid: false,
    timeline: [],
  };

  it('keeps score within [0, 100] and pRto within [0.02, 0.70]', () => {
    const res = scoreOrder(dummyOrder, dummyCustomer, dummyPin, dummyCourier, dummyProduct);
    expect(res.score).toBeGreaterThanOrEqual(0);
    expect(res.score).toBeLessThanOrEqual(100);
    expect(res.pRto).toBeGreaterThanOrEqual(0.02);
    expect(res.pRto).toBeLessThanOrEqual(0.70);
    expect(res.factors.length).toBe(7);
  });

  it('awards higher score for Prepaid and verified address', () => {
    const codRes = scoreOrder(dummyOrder, dummyCustomer, dummyPin, dummyCourier, dummyProduct);
    const prepaidOrder = { ...dummyOrder, payment: 'Prepaid' as const, addressVerified: true };
    const prepaidRes = scoreOrder(prepaidOrder, dummyCustomer, dummyPin, dummyCourier, dummyProduct);

    expect(prepaidRes.score).toBeGreaterThan(codRes.score);
    expect(prepaidRes.pRto).toBeLessThan(codRes.pRto);
  });
});

describe('Engine: EV Monotonicity Sanity Checks', () => {
  const dummyProduct: Product = {
    id: 'P01',
    name: 'Face Oil',
    price: 1500,
    cogs: 400,
    damageRate: 0.02,
  };

  const highSuccessPin: Pin = {
    code: '560001',
    city: 'Bengaluru',
    state: 'Karnataka',
    rtoRate: 0.10,
    success: 0.95,
  };

  const lowSuccessPin: Pin = {
    code: '273001',
    city: 'Gorakhpur',
    state: 'Uttar Pradesh',
    rtoRate: 0.42,
    success: 0.59,
  };

  const dummyCourier: Courier = {
    id: 'delhivery',
    name: 'Delhivery',
    success: 0.90,
    forward: 70,
    reverse: 80,
  };

  const dummyCust = { orders: 2, rtos: 0, prepaid: 1 };

  const baseOrder: Order = {
    id: 'MP-TEST',
    productId: dummyProduct.id,
    customerId: 'C01',
    qty: 1,
    value: 1500,
    payment: 'COD',
    address: '42 MG Road',
    addressComplete: true,
    addressVerified: false,
    otpPassed: false,
    campaign: 'Direct',
    pincode: '560001',
    courierId: dummyCourier.id,
    status: 'Confirmed',
    journey: 'Full COD',
    score: 60,
    created: '2026-06-01',
    advancePaid: false,
    timeline: [],
  };

  it('yields higher expected net margin for low RTO pincode compared to high RTO pincode', () => {
    const highSuccessEval = evaluate(
      { ...baseOrder, pincode: highSuccessPin.code },
      dummyProduct,
      highSuccessPin,
      dummyCourier,
      dummyCust,
      DEFAULT_ENGINE_CONFIG,
    );

    const lowSuccessEval = evaluate(
      { ...baseOrder, pincode: lowSuccessPin.code },
      dummyProduct,
      lowSuccessPin,
      dummyCourier,
      dummyCust,
      DEFAULT_ENGINE_CONFIG,
    );

    expect(highSuccessEval.best.ev).toBeGreaterThan(lowSuccessEval.best.ev);
    expect(highSuccessEval.pRto).toBeLessThan(lowSuccessEval.pRto);
  });
});

describe('Engine: Journey Selection on Special Order MP-1042', () => {
  const product: Product = {
    id: 'P01',
    name: 'Cedar & Fig Face Oil',
    price: 1899,
    cogs: 510,
    damageRate: 0.025,
  };

  const gorakhpurPin: Pin = {
    code: '273001',
    city: 'Gorakhpur',
    state: 'Uttar Pradesh',
    rtoRate: 0.42,
    success: 0.59,
  };

  const courier: Courier = {
    id: 'shiprocket',
    name: 'Shiprocket',
    success: 0.83,
    forward: 78,
    reverse: 92,
  };

  const customer: Customer = {
    id: 'C004',
    name: 'Meera Kapoor',
    phone: '+91 9810000411',
    city: 'Gorakhpur',
    orders: 0,
    rtos: 0,
    prepaid: 0,
  };

  const mp1042: Order = {
    id: 'MP-1042',
    productId: 'P01',
    customerId: 'C004',
    qty: 1,
    value: 1899,
    payment: 'COD',
    address: 'House 14, lane 3, near old post office',
    addressComplete: false,
    addressVerified: false,
    otpPassed: false,
    campaign: 'Instagram',
    pincode: '273001',
    courierId: 'shiprocket',
    status: 'Address check',
    journey: 'WhatsApp address verification',
    score: 38,
    created: '2026-06-01',
    advancePaid: false,
    timeline: [
      { label: 'Order placed · Instagram', at: 'Today, 09:42' },
      { label: 'Risk check flagged incomplete address', at: 'Today, 09:42' },
      { label: 'WhatsApp verification selected', at: 'Today, 09:43' },
    ],
  };

  it('evaluates MP-1042 and recommends intervention with better EV than Full COD', () => {
    const res = evaluate(mp1042, product, gorakhpurPin, courier, customer, DEFAULT_ENGINE_CONFIG);
    const fullCodJourney = res.journeys.find((j) => j.name === 'Full COD')!;

    // Best intervention must outperform raw Full COD given high return risk
    expect(res.best.ev).toBeGreaterThan(fullCodJourney.ev);
    expect(res.best.name).toMatch(/Prepaid incentive 5% off|WhatsApp address verification|Partial COD|OTP/);
  });

  it('respects prepaid-only policy filter when configured', () => {
    const configWithPrepaidPolicy: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      policies: [
        { id: 'pol-1', type: 'pincode', value: '273001', action: 'prepaid-only' },
      ],
    };

    const res = evaluate(mp1042, product, gorakhpurPin, courier, customer, configWithPrepaidPolicy);
    expect(['Prepaid incentive 5% off', 'Partial COD 20% advance']).toContain(res.best.name);
  });
});

describe('Engine: Recovery and NDR Playbooks', () => {
  it('generates expected NDR rescue recommendations', () => {
    const rescue = recommendNdrRescue('Address incorrect', 'Aarav Shah', 500);
    expect(rescue.action).toBe('Send address-fix link');
    expect(rescue.message).toContain('Aarav');
    expect(rescue.message).toContain('address-fix link');
  });

  it('ranks recovery actions in descending order of value', () => {
    const actions = rankRecoveryActions(
      {
        id: 'MP-99',
        productId: 'P01',
        customerId: 'C01',
        qty: 1,
        value: 1899,
        payment: 'COD',
        address: 'MG Road',
        addressComplete: true,
        addressVerified: false,
        otpPassed: false,
        campaign: 'Meta',
        pincode: '110001',
        courierId: 'delhivery',
        status: 'NDR raised',
        journey: 'Full COD',
        score: 45,
        created: '2026-06-01',
        advancePaid: false,
        timeline: [],
      },
      800,
      150,
      { code: '110001', city: 'Delhi', state: 'DL', rtoRate: 0.15, success: 0.88 },
      { id: 'delhivery', name: 'Delhivery', success: 0.88, forward: 80, reverse: 95 },
      { id: 'bluedart', name: 'Blue Dart', success: 0.93, forward: 105, reverse: 120 },
    );

    expect(actions.length).toBe(6);
    for (let i = 0; i < actions.length - 1; i++) {
      expect(actions[i].value).toBeGreaterThanOrEqual(actions[i + 1].value);
    }
  });
});
