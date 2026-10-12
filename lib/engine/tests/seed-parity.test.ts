import { describe, it, expect } from 'vitest';
import { seedOrders, products, pincodes, couriers, customers } from '../../../artifacts/margin-pilot/src/data/seed';
import { scoreOrder, evaluate, DEFAULT_ENGINE_CONFIG } from '../src';

describe('Engine Seed Order Parity Test', () => {
  it('evaluates all 80 seed orders without runtime exceptions and maintains correct ranges', () => {
    for (const order of seedOrders) {
      const p = products.find((x) => x.id === order.productId)!;
      const pin = pincodes.find((x) => x.code === order.pincode)!;
      const courier = couriers.find((x) => x.id === order.courierId)!;
      const customer = customers.find((x) => x.id === order.customerId)!;

      const evalRes = evaluate(
        order,
        p,
        pin,
        courier,
        {
          orders: customer.orders,
          rtos: customer.rtos,
          prepaid: customer.prepaid,
        },
        DEFAULT_ENGINE_CONFIG,
      );

      expect(evalRes.score).toBeGreaterThanOrEqual(0);
      expect(evalRes.score).toBeLessThanOrEqual(100);
      expect(evalRes.pRto).toBeGreaterThanOrEqual(0.02);
      expect(evalRes.pRto).toBeLessThanOrEqual(0.70);
      expect(evalRes.journeys.length).toBeGreaterThan(0);
      expect(evalRes.best).toBeDefined();
    }
  });

  it('matches special order MP-1042 seed parameters exactly', () => {
    const mp1042 = seedOrders.find((o) => o.id === 'MP-1042')!;
    expect(mp1042).toBeDefined();
    expect(mp1042.pincode).toBe('273001');
    expect(mp1042.campaign).toBe('Instagram');
    expect(mp1042.status).toBe('Address check');
    expect(mp1042.score).toBe(38);
  });
});
