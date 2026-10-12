import { DEFAULT_ENGINE_CONFIG, evaluate } from './scoring';
import type { Courier, Customer, EnginePolicy, Order, Pin, Product } from './types';

export function getIntelligenceStats(
  orders: Order[],
  pincodes: Pin[],
  products: Product[],
  couriers: Courier[],
  customers: Customer[],
) {
  const evals = orders.map((o) => {
    const p = products.find((x) => x.id === o.productId)!;
    const pin = pincodes.find((x) => x.code === o.pincode)!;
    const c = couriers.find((x) => x.id === o.courierId)!;
    const cust = customers.find((x) => x.id === o.customerId) || customers[0];
    const ev = evaluate(o, p, pin, c, cust, DEFAULT_ENGINE_CONFIG);
    const drag = ev.marginSuccess - ev.best.ev;
    return { o, p, pin, c, cust, ev, drag, pRto: ev.pRto };
  });

  const summarize = <T>(groups: T[], match: (item: (typeof evals)[0], grp: T) => boolean) => {
    return groups
      .map((grp: any) => {
        const grpOrders = evals.filter((x) => match(x, grp));
        return {
          id: (grp.id || grp.code || grp) as string,
          name: (grp.name || (grp.city ? `${grp.city}, ${grp.state}` : grp)) as string,
          orders: grpOrders.length,
          rtoRate: grpOrders.length
            ? grpOrders.reduce((s, x) => s + x.pRto, 0) / grpOrders.length
            : grp.rtoRate || 0,
          marginDrag: Math.round(grpOrders.reduce((s, x) => s + x.drag, 0)),
        };
      })
      .filter((x) => x.orders > 0)
      .sort((a, b) => b.marginDrag - a.marginDrag);
  };

  const byPin = summarize(pincodes, (x, grp) => x.pin.code === grp.code);
  const byProduct = summarize(products, (x, grp) => x.p.id === grp.id);
  const channels = Array.from(new Set(orders.map((o) => o.campaign)));
  const byChannel = summarize(channels, (x, grp) => x.o.campaign === grp);
  const byCourier = summarize(couriers, (x, grp) => x.c.id === grp.id);

  return { byPin, byProduct, byChannel, byCourier };
}

export function generateSuggestions(stats: ReturnType<typeof getIntelligenceStats>) {
  const suggestions: Array<{
    id: string;
    text: string;
    policy: EnginePolicy;
  }> = [];

  const badPin = stats.byPin[0];
  if (badPin && badPin.rtoRate > 0.2) {
    suggestions.push({
      id: `pin-${badPin.id}`,
      text: `Move pincode ${badPin.id} (${badPin.name}) to prepaid-only: saves approx ₹${Math.round(badPin.marginDrag * 0.4)}/month`,
      policy: { id: `pin-${badPin.id}`, type: 'pincode', value: badPin.id, action: 'prepaid-only' },
    });
  }

  const badCh = stats.byChannel[0];
  if (badCh && badCh.rtoRate > 0.15) {
    suggestions.push({
      id: `ch-${badCh.id}`,
      text: `Require human review for high-risk orders from ${badCh.name}: stops ₹${Math.round(badCh.marginDrag * 0.3)} in leakage`,
      policy: { id: `ch-${badCh.id}`, type: 'channel', value: badCh.id, action: 'human-review' },
    });
  }

  return suggestions;
}
