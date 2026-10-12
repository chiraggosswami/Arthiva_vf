export interface NormalizedAddress {
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  zip: string;
  country?: string;
}

export interface NormalizedCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city: string;
}

export interface NormalizedOrderItem {
  productId: string;
  title: string;
  sku?: string;
  quantity: number;
  price: number;
  cogs?: number;
}

export interface NormalizedOrder {
  id: string;
  source: 'shopify' | 'woocommerce' | 'custom';
  externalId: string;
  storeId: string;
  customer: NormalizedCustomer;
  address: NormalizedAddress;
  rawAddressString: string;
  items: NormalizedOrderItem[];
  totalValue: number;
  paymentMethod: 'COD' | 'Prepaid' | 'Partial COD';
  financialStatus: string;
  campaign?: string;
  createdAt: string;
}

export interface OrderAdapter<TRaw = any> {
  source: 'shopify' | 'woocommerce' | 'custom';
  normalize(raw: TRaw, storeId: string): NormalizedOrder;
}
