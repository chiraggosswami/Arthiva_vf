import crypto from 'node:crypto';
import { logger } from './logger';

export interface CreatePaymentLinkOptions {
  storeId: string;
  orderId: string;
  amount: number; // in INR
  purpose: 'partial_cod_advance' | 'prepaid_conversion' | 'full_prepaid';
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  description?: string;
}

export interface PaymentLinkResult {
  paymentLinkId: string;
  shortUrl: string;
  amount: number;
  currency: string;
  status: 'created' | 'paid' | 'expired';
  provider: 'mock' | 'razorpay';
  metadata?: Record<string, any>;
}

export interface PaymentProvider {
  readonly name: 'mock' | 'razorpay';
  createPaymentLink(options: CreatePaymentLinkOptions): Promise<PaymentLinkResult>;
  verifyWebhookSignature(rawBody: Buffer | string, signature: string, secret?: string): boolean;
}

// ----------------------------------------------------------------------
// Mock Payment Provider (Default in test / when keys absent)
// ----------------------------------------------------------------------
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  public links: Map<string, PaymentLinkResult> = new Map();

  async createPaymentLink(options: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
    const paymentLinkId = `plink_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const shortUrl = `https://mock-pay.marginpilot.local/pay/${paymentLinkId}?order=${options.orderId}&amt=${options.amount}`;

    const result: PaymentLinkResult = {
      paymentLinkId,
      shortUrl,
      amount: options.amount,
      currency: 'INR',
      status: 'created',
      provider: 'mock',
      metadata: {
        orderId: options.orderId,
        storeId: options.storeId,
        purpose: options.purpose,
      },
    };

    this.links.set(paymentLinkId, result);

    logger.info(
      { provider: '[MOCK_PAYMENT_PROVIDER]', paymentLinkId, orderId: options.orderId, amount: options.amount },
      `[MOCK_PROVIDER] Generated mock payment link: ${shortUrl}`
    );

    return result;
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string, secret?: string): boolean {
    const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyStr)
      .digest('hex');

    const isValid = signature === expectedSignature || signature === 'valid_mock_signature';
    logger.info(
      { provider: '[MOCK_PAYMENT_PROVIDER]', signatureValid: isValid },
      `[MOCK_PROVIDER] Webhook signature verification: ${isValid}`
    );
    return isValid;
  }
}

// ----------------------------------------------------------------------
// Razorpay Live/Test-Mode Provider
// ----------------------------------------------------------------------
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;
  private keyId: string;
  private keySecret: string;

  constructor(keyId: string, keySecret: string) {
    this.keyId = keyId;
    this.keySecret = keySecret;
  }

  async createPaymentLink(options: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
    logger.info(
      { provider: '[RAZORPAY_LIVE_PROVIDER]', orderId: options.orderId, amount: options.amount },
      `[LIVE_PROVIDER] Creating Razorpay standard payment link for order ${options.orderId}`
    );

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const amountInPaise = Math.round(options.amount * 100);

    const body = {
      amount: amountInPaise,
      currency: 'INR',
      accept_partial: false,
      reference_id: options.orderId,
      description: options.description || `Margin Pilot Payment - Order #${options.orderId} (${options.purpose})`,
      customer: {
        name: options.customerName,
        contact: options.customerPhone?.replace(/[^0-9]/g, ''),
        email: options.customerEmail,
      },
      notify: {
        sms: true,
        whatsapp: true,
      },
      reminder_enable: true,
      notes: {
        orderId: options.orderId,
        storeId: options.storeId,
        purpose: options.purpose,
      },
    };

    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Razorpay API error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    return {
      paymentLinkId: data.id,
      shortUrl: data.short_url,
      amount: options.amount,
      currency: data.currency || 'INR',
      status: 'created',
      provider: 'razorpay',
      metadata: data,
    };
  }

  verifyWebhookSignature(rawBody: Buffer | string, signature: string, secret?: string): boolean {
    const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn('RAZORPAY_WEBHOOK_SECRET missing; cannot verify live Razorpay signature');
      return false;
    }

    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyStr)
      .digest('hex');

    return signature === expectedSignature;
  }
}

// ----------------------------------------------------------------------
// Factory
// ----------------------------------------------------------------------
let activePaymentProviderInstance: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (activePaymentProviderInstance) {
    return activePaymentProviderInstance;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret) {
    logger.info('[LIVE_PROVIDER] Initialized live Razorpay payment provider');
    activePaymentProviderInstance = new RazorpayPaymentProvider(keyId, keySecret);
  } else {
    logger.info('[MOCK_PROVIDER] Initialized MockPaymentProvider (RAZORPAY_KEY_ID / SECRET not present)');
    activePaymentProviderInstance = new MockPaymentProvider();
  }

  return activePaymentProviderInstance;
}

export function setPaymentProviderForTesting(provider: PaymentProvider | null): void {
  activePaymentProviderInstance = provider;
}
