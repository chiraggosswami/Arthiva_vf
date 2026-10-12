import type { NormalizedOrder, NormalizedOrderItem, OrderAdapter } from './types';

export const shopifyAdapter: OrderAdapter = {
  source: 'shopify',
  normalize(raw: any, storeId: string): NormalizedOrder {
    const externalId = String(raw.id || raw.order_number || '');
    const orderId = raw.name ? `SHOPIFY-${raw.name.replace(/[^a-zA-Z0-9_-]/g, '')}` : `SHOPIFY-${externalId}`;

    const shippingAddress = raw.shipping_address || raw.billing_address || {};
    const customer = raw.customer || {};

    const firstName = shippingAddress.first_name || customer.first_name || '';
    const lastName = shippingAddress.last_name || customer.last_name || '';
    const name = `${firstName} ${lastName}`.trim() || customer.name || 'Anonymous Customer';

    const phone = shippingAddress.phone || customer.phone || raw.phone || '+91 9999999999';
    const city = shippingAddress.city || customer.default_address?.city || 'Delhi';
    const zip = shippingAddress.zip || '110001';

    const addressParts = [
      shippingAddress.address1,
      shippingAddress.address2,
      shippingAddress.city,
      shippingAddress.province,
      shippingAddress.zip,
    ].filter(Boolean);
    const rawAddressString = addressParts.join(', ') || 'No address provided';

    const gatewayNames: string[] = Array.isArray(raw.payment_gateway_names)
      ? raw.payment_gateway_names
      : [raw.gateway || ''];
    const isCod = gatewayNames.some((g: string) => /cash|cod|manual/i.test(g));
    const paymentMethod: 'COD' | 'Prepaid' = isCod ? 'COD' : 'Prepaid';

    const lineItems = Array.isArray(raw.line_items) ? raw.line_items : [];
    const items = lineItems.map((item: any) => ({
      productId: String(item.product_id || item.variant_id || item.sku || 'P01'),
      title: item.title || item.name || 'Product',
      sku: item.sku || undefined,
      quantity: Number(item.quantity) || 1,
      price: Math.round(Number(item.price) || 0),
      cogs: Math.round((Number(item.price) || 0) * 0.3),
    }));

    const totalValue = Math.round(Number(raw.total_price || raw.current_total_price) || items.reduce((sum: number, i: NormalizedOrderItem) => sum + i.price * i.quantity, 0));

    // Attribution / campaign discovery
    const campaign =
      raw.referring_site ||
      raw.source_name ||
      raw.landing_site_ref ||
      (raw.note_attributes?.find?.((a: any) => a.name === 'utm_campaign')?.value) ||
      'Shopify Direct';

    return {
      id: orderId,
      source: 'shopify',
      externalId,
      storeId,
      customer: {
        id: customer.id ? `CUST-SHOP-${customer.id}` : `CUST-${phone.replace(/\D/g, '')}`,
        name,
        phone,
        email: customer.email || raw.email,
        city,
      },
      address: {
        address1: shippingAddress.address1 || '',
        address2: shippingAddress.address2 || '',
        city,
        province: shippingAddress.province || '',
        zip,
        country: shippingAddress.country || 'India',
      },
      rawAddressString,
      items,
      totalValue,
      paymentMethod,
      financialStatus: raw.financial_status || 'pending',
      campaign,
      createdAt: raw.created_at || new Date().toISOString(),
    };
  },
};
