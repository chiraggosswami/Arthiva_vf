import type { NormalizedOrder, NormalizedOrderItem, OrderAdapter } from './types';

export const customAdapter: OrderAdapter = {
  source: 'custom',
  normalize(raw: any, storeId: string): NormalizedOrder {
    const externalId = String(raw.externalId || raw.orderId || raw.id || '');
    const orderId = raw.id?.startsWith('MP-') ? raw.id : `CUSTOM-${externalId}`;

    const customer = raw.customer || {};
    const address = raw.address || {};

    const name = customer.name || raw.customerName || 'Direct Customer';
    const phone = customer.phone || raw.customerPhone || '+91 9999999999';
    const city = typeof address === 'string' ? 'Delhi' : address.city || raw.city || 'Delhi';
    const zip = typeof address === 'string' ? raw.pincode || '110001' : address.pincode || address.zip || raw.pincode || '110001';

    const rawAddressString = typeof address === 'string'
      ? address
      : [address.line1 || address.address1, address.line2 || address.address2, city, address.state, zip].filter(Boolean).join(', ') || 'No address provided';

    const paymentMethod: 'COD' | 'Prepaid' | 'Partial COD' =
      raw.paymentMethod || raw.payment || (raw.isCod ? 'COD' : 'Prepaid');

    const rawItems = Array.isArray(raw.items) ? raw.items : [];
    const items = rawItems.length > 0
      ? rawItems.map((i: any) => ({
          productId: String(i.productId || i.id || 'P01'),
          title: i.title || i.name || 'Product',
          quantity: Number(i.quantity || i.qty) || 1,
          price: Math.round(Number(i.price || i.unitPrice) || 0),
          cogs: Math.round(Number(i.cogs || i.unitCogs) || (Number(i.price || i.unitPrice) || 0) * 0.3),
        }))
      : [
          {
            productId: String(raw.productId || 'P01'),
            title: raw.productName || 'Product',
            quantity: Number(raw.qty || raw.quantity) || 1,
            price: Math.round(Number(raw.value || raw.totalValue) || 1000),
            cogs: Math.round((Number(raw.value || raw.totalValue) || 1000) * 0.3),
          },
        ];

    const totalValue = Math.round(Number(raw.totalValue || raw.value) || items.reduce((sum: number, i: NormalizedOrderItem) => sum + i.price * i.quantity, 0));

    return {
      id: orderId,
      source: 'custom',
      externalId,
      storeId,
      customer: {
        id: customer.id || `CUST-${phone.replace(/\D/g, '')}`,
        name,
        phone,
        email: customer.email || raw.email,
        city,
      },
      address: {
        address1: typeof address === 'string' ? address : address.line1 || address.address1 || '',
        address2: typeof address === 'string' ? '' : address.line2 || address.address2 || '',
        city,
        province: typeof address === 'string' ? '' : address.state || '',
        zip,
        country: 'India',
      },
      rawAddressString,
      items,
      totalValue,
      paymentMethod,
      financialStatus: raw.financialStatus || (paymentMethod === 'Prepaid' ? 'paid' : 'pending'),
      campaign: raw.campaign || 'Custom ERP',
      createdAt: raw.createdAt || new Date().toISOString(),
    };
  },
};
