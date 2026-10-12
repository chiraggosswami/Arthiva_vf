import type { NormalizedOrder, NormalizedOrderItem, OrderAdapter } from './types';

export const woocommerceAdapter: OrderAdapter = {
  source: 'woocommerce',
  normalize(raw: any, storeId: string): NormalizedOrder {
    const externalId = String(raw.id || raw.number || '');
    const orderId = `WC-${externalId}`;

    const shipping = raw.shipping || raw.billing || {};
    const billing = raw.billing || {};

    const firstName = shipping.first_name || billing.first_name || '';
    const lastName = shipping.last_name || billing.last_name || '';
    const name = `${firstName} ${lastName}`.trim() || 'WooCommerce Customer';

    const phone = billing.phone || shipping.phone || '+91 9999999999';
    const city = shipping.city || billing.city || 'Delhi';
    const zip = shipping.postcode || billing.postcode || '110001';

    const addressParts = [
      shipping.address_1 || billing.address_1,
      shipping.address_2 || billing.address_2,
      city,
      shipping.state || billing.state,
      zip,
    ].filter(Boolean);
    const rawAddressString = addressParts.join(', ') || 'No address provided';

    const paymentMethodTitle = (raw.payment_method_title || raw.payment_method || '').toLowerCase();
    const isCod = /cod|cash on delivery|cheque/i.test(paymentMethodTitle);
    const paymentMethod: 'COD' | 'Prepaid' = isCod ? 'COD' : 'Prepaid';

    const lineItems = Array.isArray(raw.line_items) ? raw.line_items : [];
    const items = lineItems.map((item: any) => ({
      productId: String(item.product_id || item.variation_id || item.sku || 'P01'),
      title: item.name || 'Product',
      sku: item.sku || undefined,
      quantity: Number(item.quantity) || 1,
      price: Math.round(Number(item.total || item.price) / (Number(item.quantity) || 1)),
      cogs: Math.round((Number(item.total || item.price) / (Number(item.quantity) || 1)) * 0.3),
    }));

    const totalValue = Math.round(Number(raw.total) || items.reduce((sum: number, i: NormalizedOrderItem) => sum + i.price * i.quantity, 0));

    return {
      id: orderId,
      source: 'woocommerce',
      externalId,
      storeId,
      customer: {
        id: raw.customer_id && raw.customer_id !== 0 ? `CUST-WC-${raw.customer_id}` : `CUST-${phone.replace(/\D/g, '')}`,
        name,
        phone,
        email: billing.email || raw.email,
        city,
      },
      address: {
        address1: shipping.address_1 || billing.address_1 || '',
        address2: shipping.address_2 || billing.address_2 || '',
        city,
        province: shipping.state || billing.state || '',
        zip,
        country: shipping.country || billing.country || 'India',
      },
      rawAddressString,
      items,
      totalValue,
      paymentMethod,
      financialStatus: raw.status || 'processing',
      campaign: 'WooCommerce Store',
      createdAt: raw.date_created || new Date().toISOString(),
    };
  },
};
