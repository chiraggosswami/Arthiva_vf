import { evaluate, DEFAULT_ENGINE_CONFIG } from './index';
import type { Order, Pin, Product, Courier } from '../data/seed';

export function getIntelligenceStats(orders: Order[], pincodes: Pin[], products: Product[], couriers: Courier[], customers: any[]) {
    const evals = orders.map(o => {
        const foundP = products.find(x => x.id === o.productId || x.name === o.productId);
        const p: Product = foundP || {
          id: o.productId || `P_${o.id}`,
          name: (o as any).productName || o.productId || 'Catalog Product',
          price: o.value || 1000,
          cogs: (o as any).cogs ?? Math.max(100, Math.round((o.value || 1000) * 0.35)),
          damageRate: 0.02,
          sellerId: o.sellerId
        };
        const foundPin = pincodes.find(x => x.code === o.pincode);
        const pin: Pin = foundPin || {
          code: o.pincode || '110001',
          city: (o as any).city || 'Metro City',
          state: (o as any).state || 'India',
          rtoRate: (o as any).rtoRate ?? 0.18,
          success: 1 - ((o as any).rtoRate ?? 0.18)
        };
        const foundCourier = couriers.find(x => x.id === o.courierId);
        const c: Courier = foundCourier || couriers[0] || {
          id: 'delhivery',
          name: 'Delhivery',
          success: 0.88,
          forward: 82,
          reverse: 96
        };
        const foundCust = customers.find(x => x.id === o.customerId);
        const cust = foundCust || {
          id: o.customerId || `C_${o.id}`,
          name: o.customerName || 'Customer',
          phone: o.customerPhone || '+91 9800000000',
          city: pin.city,
          orders: 1,
          rtos: 0,
          prepaid: o.payment === 'Prepaid' ? 1 : 0
        };
        const ev = evaluate(o, p, pin, c, cust, DEFAULT_ENGINE_CONFIG);
        const drag = ev.marginSuccess - ev.best.ev;
        return { o, p, pin, c, cust, ev, drag, pRto: ev.pRto };
    });

    const summarize = (groups: any[], match: (x: any, grp: any) => boolean) => {
        return groups.map(grp => {
            const grpOrders = evals.filter(x => match(x, grp));
            return {
                id: grp.id || grp.code || grp,
                name: grp.name || (grp.city ? `${grp.city}, ${grp.state || ''}` : grp),
                orders: grpOrders.length,
                rtoRate: grpOrders.length ? grpOrders.reduce((s, x) => s + x.pRto, 0) / grpOrders.length : (grp.rtoRate || 0),
                marginDrag: Math.round(grpOrders.reduce((s, x) => s + x.drag, 0))
            };
        }).filter(x => x.orders > 0).sort((a, b) => b.marginDrag - a.marginDrag);
    };

    const pinsToSummarize = Array.from(new Map([...pincodes, ...evals.map(e => e.pin)].map(p => [p.code, p])).values());
    const byPin = summarize(pinsToSummarize, (x, grp) => x.pin.code === grp.code);

    const prodsToSummarize = Array.from(new Map([...products, ...evals.map(e => e.p)].map(p => [p.id, p])).values());
    const byProduct = summarize(prodsToSummarize, (x, grp) => x.p.id === grp.id);

    const channels = Array.from(new Set(orders.map(o => o.campaign).filter(Boolean)));
    const byChannel = summarize(channels, (x, grp) => x.o.campaign === grp);
    const byCourier = summarize(couriers, (x, grp) => x.c.id === grp.id);

    return { byPin, byProduct, byChannel, byCourier };
}

export function generateSuggestions(stats: ReturnType<typeof getIntelligenceStats>) {
    const suggestions = [];
    const badPin = stats.byPin[0];
    if (badPin && badPin.rtoRate > 0.2) {
        suggestions.push({
            id: `pin-${badPin.id}`,
            text: `Move pincode ${badPin.id} (${badPin.name}) to prepaid-only: saves approx ₹${Math.round(badPin.marginDrag * 0.4)}/month`,
            policy: { id: `pin-${badPin.id}`, type: 'pincode', value: badPin.id, action: 'prepaid-only' as const }
        });
    }
    const badCh = stats.byChannel[0];
    if (badCh && badCh.rtoRate > 0.15) {
        suggestions.push({
            id: `ch-${badCh.id}`,
            text: `Require human review for high-risk orders from ${badCh.name}: stops ₹${Math.round(badCh.marginDrag * 0.3)} in leakage`,
            policy: { id: `ch-${badCh.id}`, type: 'channel', value: badCh.id, action: 'human-review' as const }
        });
    }
    return suggestions;
}
