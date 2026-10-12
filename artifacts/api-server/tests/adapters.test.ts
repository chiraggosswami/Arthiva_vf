import { describe, it, expect } from 'vitest';
import shopifyFixture from './fixtures/shopify-order.json';
import wcFixture from './fixtures/woocommerce-order.json';
import customFixture from './fixtures/custom-order.json';
import { shopifyAdapter, woocommerceAdapter, customAdapter } from '../src/adapters';

describe('Order Ingest Adapters', () => {
  it('shopifyAdapter normalizes Shopify order correctly', () => {
    const storeId = 'store_test_shopify';
    const normalized = shopifyAdapter.normalize(shopifyFixture, storeId);

    expect(normalized.source).toBe('shopify');
    expect(normalized.storeId).toBe(storeId);
    expect(normalized.id).toBe('SHOPIFY-1042');
    expect(normalized.externalId).toBe('8209841234');
    expect(normalized.customer.name).toBe('Meera Kapoor');
    expect(normalized.customer.phone).toBe('+91 9810000411');
    expect(normalized.address.zip).toBe('273001');
    expect(normalized.address.city).toBe('Gorakhpur');
    expect(normalized.paymentMethod).toBe('COD');
    expect(normalized.totalValue).toBe(1899);
    expect(normalized.items.length).toBe(1);
    expect(normalized.items[0].title).toBe('Silk Anarkali Kurta Set');
    expect(normalized.items[0].price).toBe(1899);
  });

  it('woocommerceAdapter normalizes WooCommerce order correctly', () => {
    const storeId = 'store_test_wc';
    const normalized = woocommerceAdapter.normalize(wcFixture, storeId);

    expect(normalized.source).toBe('woocommerce');
    expect(normalized.storeId).toBe(storeId);
    expect(normalized.id).toBe('WC-55412');
    expect(normalized.externalId).toBe('55412');
    expect(normalized.customer.name).toBe('Rahul Sharma');
    expect(normalized.customer.phone).toBe('+91 9820000123');
    expect(normalized.address.zip).toBe('122003');
    expect(normalized.address.city).toBe('Gurugram');
    expect(normalized.paymentMethod).toBe('COD');
    expect(normalized.totalValue).toBe(2499);
    expect(normalized.items.length).toBe(1);
    expect(normalized.items[0].title).toBe('Men Leather Formal Shoes');
  });

  it('customAdapter normalizes Custom ERP order correctly', () => {
    const storeId = 'store_test_custom';
    const normalized = customAdapter.normalize(customFixture, storeId);

    expect(normalized.source).toBe('custom');
    expect(normalized.storeId).toBe(storeId);
    expect(normalized.id).toBe('CUSTOM-ERP-ORD-9021');
    expect(normalized.externalId).toBe('ERP-ORD-9021');
    expect(normalized.customer.name).toBe('Ananya Roy');
    expect(normalized.paymentMethod).toBe('Prepaid');
    expect(normalized.totalValue).toBe(3199);
    expect(normalized.address.zip).toBe('700019');
    expect(normalized.items[0].cogs).toBe(950);
  });
});
