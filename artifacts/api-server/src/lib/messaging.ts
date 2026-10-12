import { logger } from './logger';

export interface SendMessageOptions {
  storeId: string;
  orderId: string;
  recipient: string; // Phone number e.g. +91 9876543210
  templateName: string;
  variables: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface MessageResult {
  messageId: string;
  provider: 'mock' | 'whatsapp_cloud' | 'twilio';
  status: 'sent' | 'delivered' | 'failed';
  renderedContent: string;
  details?: Record<string, any>;
}

export interface InboundMessagePayload {
  storeId?: string;
  from: string;
  text: string;
  messageId?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ParsedInboundAction {
  actionType: 'CONFIRM' | 'RESCHEDULE' | 'ADDRESS_UPDATE' | 'UNKNOWN';
  orderId?: string;
  cleanedText: string;
  newAddress?: string;
  rescheduleSlot?: string;
  confidence: number;
}

export interface MessageProvider {
  readonly name: 'mock' | 'whatsapp_cloud' | 'twilio';
  sendMessage(options: SendMessageOptions): Promise<MessageResult>;
}

// ----------------------------------------------------------------------
// Template Registry with dynamic variable interpolation
// ----------------------------------------------------------------------
export const TEMPLATE_REGISTRY: Record<string, (vars: Record<string, any>) => string> = {
  ndr_reconnect_whatsapp: (v) =>
    `Hi ${v.customerName || 'there'}, our courier could not reach you for your order #${v.orderId}. Reply CONFIRM to reattempt delivery tomorrow, or reply RESCHEDULE with your preferred time slot.`,

  ndr_address_correction: (v) =>
    `Hi ${v.customerName || 'there'}, we need an updated delivery address to complete order #${v.orderId}. Please reply with your updated house number, street, or landmark (or use ${v.actionLink || 'https://track.marginpilot.in/address'}).`,

  ndr_reschedule: (v) =>
    `Hi ${v.customerName || 'there'}, we noted your delivery reschedule request for #${v.orderId}. Reply 1 for Tomorrow Morning, 2 for Tomorrow Evening, or type a custom date (e.g. 15 Oct).`,

  ndr_prepaid_conversion: (v) =>
    `Hi ${v.customerName || 'there'}, guarantee priority delivery for order #${v.orderId} and save ₹50 with prepaid payment: ${v.paymentLink || 'https://pay.marginpilot.in/quick'}. Valid for 2 hours!`,

  ndr_followup_reminder: (v) =>
    `Reminder: Delivery attempt for order #${v.orderId} is pending. Reply CONFIRM to schedule reattempt before parcel is marked for return to origin.`,

  rto_prevention_alert: (v) =>
    `Alert: Your order #${v.orderId} is at the delivery hub and will be returned to origin soon. Reply YES or pay ${v.paymentLink || 'online'} to secure delivery.`,
};

export function renderTemplate(templateName: string, variables: Record<string, any>): string {
  const templateFn = TEMPLATE_REGISTRY[templateName];
  if (templateFn) {
    return templateFn(variables);
  }
  return `Template [${templateName}]: ${JSON.stringify(variables)}`;
}

// ----------------------------------------------------------------------
// Mock Provider
// ----------------------------------------------------------------------
export class MockMessageProvider implements MessageProvider {
  readonly name = 'mock' as const;
  public sentMessages: Array<SendMessageOptions & { id: string; rendered: string; timestamp: Date }> = [];

  async sendMessage(options: SendMessageOptions): Promise<MessageResult> {
    const renderedContent = renderTemplate(options.templateName, options.variables);
    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    this.sentMessages.push({
      ...options,
      id: messageId,
      rendered: renderedContent,
      timestamp: new Date(),
    });

    logger.info(
      { provider: '[MOCK_PROVIDER]', messageId, recipient: options.recipient, template: options.templateName },
      `[MOCK_PROVIDER] Dispatched template message "${options.templateName}" to ${options.recipient}: "${renderedContent}"`
    );

    return {
      messageId,
      provider: 'mock',
      status: 'delivered',
      renderedContent,
      details: {
        channel: 'whatsapp_mock',
        deliveryAck: 'simulated_instant_delivery',
      },
    };
  }
}

// ----------------------------------------------------------------------
// WhatsApp Cloud API Provider
// ----------------------------------------------------------------------
export class WhatsAppCloudProvider implements MessageProvider {
  readonly name = 'whatsapp_cloud' as const;
  private token: string;
  private phoneNumberId: string;

  constructor(token: string, phoneNumberId: string) {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
  }

  async sendMessage(options: SendMessageOptions): Promise<MessageResult> {
    const renderedContent = renderTemplate(options.templateName, options.variables);
    logger.info(
      { provider: '[WHATSAPP_CLOUD_PROVIDER]', recipient: options.recipient, template: options.templateName },
      `[WHATSAPP_CLOUD_PROVIDER] Sending WhatsApp message to ${options.recipient}`
    );

    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: options.recipient.replace(/[^0-9]/g, ''),
          type: 'text',
          text: { body: renderedContent },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`WhatsApp API responded with ${response.status}: ${errText}`);
      }

      const json: any = await response.json();
      const messageId = json.messages?.[0]?.id || `wa_${Date.now()}`;

      return {
        messageId,
        provider: 'whatsapp_cloud',
        status: 'sent',
        renderedContent,
        details: json,
      };
    } catch (err: any) {
      logger.error({ err, recipient: options.recipient }, 'WhatsApp Cloud API call failed');
      throw err;
    }
  }
}

// ----------------------------------------------------------------------
// Twilio Provider
// ----------------------------------------------------------------------
export class TwilioMessageProvider implements MessageProvider {
  readonly name = 'twilio' as const;
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async sendMessage(options: SendMessageOptions): Promise<MessageResult> {
    const renderedContent = renderTemplate(options.templateName, options.variables);
    logger.info(
      { provider: '[TWILIO_PROVIDER]', recipient: options.recipient, template: options.templateName },
      `[TWILIO_PROVIDER] Sending Twilio WhatsApp message to ${options.recipient}`
    );

    try {
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', this.fromNumber.startsWith('whatsapp:') ? this.fromNumber : `whatsapp:${this.fromNumber}`);
      params.append('To', options.recipient.startsWith('whatsapp:') ? options.recipient : `whatsapp:${options.recipient}`);
      params.append('Body', renderedContent);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Twilio responded with ${response.status}: ${errText}`);
      }

      const json: any = await response.json();
      return {
        messageId: json.sid || `tw_${Date.now()}`,
        provider: 'twilio',
        status: 'sent',
        renderedContent,
        details: json,
      };
    } catch (err: any) {
      logger.error({ err, recipient: options.recipient }, 'Twilio API call failed');
      throw err;
    }
  }
}

// ----------------------------------------------------------------------
// Provider Factory based on environment configuration
// ----------------------------------------------------------------------
let activeProviderInstance: MessageProvider | null = null;

export function getMessageProvider(): MessageProvider {
  if (activeProviderInstance) {
    return activeProviderInstance;
  }

  const providerType = (process.env.MESSAGING_PROVIDER || 'mock').toLowerCase();

  if (providerType === 'whatsapp_cloud' && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    logger.info('[LIVE_PROVIDER] Initialized WhatsApp Cloud API provider');
    activeProviderInstance = new WhatsAppCloudProvider(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_PHONE_NUMBER_ID);
  } else if (
    providerType === 'twilio' &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  ) {
    logger.info('[LIVE_PROVIDER] Initialized Twilio WhatsApp provider');
    activeProviderInstance = new TwilioMessageProvider(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
      process.env.TWILIO_PHONE_NUMBER
    );
  } else {
    logger.info('[MOCK_PROVIDER] Initialized default MockMessageProvider (no live credentials or MESSAGING_PROVIDER=mock)');
    activeProviderInstance = new MockMessageProvider();
  }

  return activeProviderInstance;
}

export function setMessageProviderForTesting(provider: MessageProvider | null): void {
  activeProviderInstance = provider;
}

// ----------------------------------------------------------------------
// Inbound Reply NLP / Parsing Helper
// ----------------------------------------------------------------------
export function parseInboundMessage(text: string): ParsedInboundAction {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Confirm reattempt
  if (
    /^(confirm|yes|ok|okay|y|please deliver|send it|deliver tomorrow|confirm delivery)\b/i.test(trimmed) ||
    lower === '1'
  ) {
    return {
      actionType: 'CONFIRM',
      cleanedText: trimmed,
      confidence: 0.95,
    };
  }

  // 2. Reschedule
  if (
    /^(reschedule|later|tomorrow|postpone|change time|slot|deliver on|morning|evening)\b/i.test(trimmed) ||
    lower.includes('reschedule') ||
    lower === '2'
  ) {
    const slot = lower.includes('morning') ? 'Morning (9 AM - 1 PM)' : lower.includes('evening') ? 'Evening (3 PM - 7 PM)' : 'Next Business Day';
    return {
      actionType: 'RESCHEDULE',
      cleanedText: trimmed,
      rescheduleSlot: slot,
      confidence: 0.9,
    };
  }

  // 3. Address update (keywords or contains house/flat/street/road/near/behind/pin)
  if (
    /(address|flat|house|street|road|nagar|colony|near|opp|behind|floor|sector|block|pincode|\d{6})/i.test(trimmed) ||
    trimmed.length > 15
  ) {
    // If user provided a new address description
    const newAddress = trimmed.replace(/^(my address is|address is|deliver to|change address to)\s*/i, '');
    return {
      actionType: 'ADDRESS_UPDATE',
      cleanedText: trimmed,
      newAddress: newAddress.trim(),
      confidence: 0.85,
    };
  }

  return {
    actionType: 'UNKNOWN',
    cleanedText: trimmed,
    confidence: 0.3,
  };
}
