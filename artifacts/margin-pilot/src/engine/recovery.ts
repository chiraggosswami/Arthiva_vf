import type { Courier, Order, Pin } from '../data/seed';

export type NdrReason =
  | 'Customer unreachable'
  | 'Address incorrect'
  | 'Refused / low intent'
  | 'Rescheduled request'
  | 'Delayed';

export type RescueRecommendation = {
  action: string;
  message: string;
  includesGoodwill: boolean;
};

export function recommendNdrRescue(reason: NdrReason, customerName: string, expectedMargin: number): RescueRecommendation {
  const firstName = customerName.trim().split(/\s+/)[0] || 'there';
  switch (reason) {
    case 'Customer unreachable':
      return {
        action: 'WhatsApp + call + reschedule',
        message: `Hi ${firstName}, our courier could not reach you for your Margin Pilot order. Reply with a time that works and we’ll arrange another attempt.`,
        includesGoodwill: false,
      };
    case 'Address incorrect':
      return {
        action: 'Send address-fix link',
        message: `Hi ${firstName}, we need one more delivery detail to reach you. Please confirm your house number, street and nearest landmark using this address-fix link.`,
        includesGoodwill: false,
      };
    case 'Refused / low intent':
      return {
        action: 'Offer prepaid UPI with ₹50 off',
        message: `Hi ${firstName}, you can still receive your order with a secure prepaid UPI link. Use code SAVE50 for ₹50 off.`,
        includesGoodwill: false,
      };
    case 'Rescheduled request':
      return {
        action: 'Confirm a delivery window',
        message: `Hi ${firstName}, we’ve noted your request to reschedule. Reply with a convenient delivery window and we’ll update the courier.`,
        includesGoodwill: false,
      };
    case 'Delayed': {
      const includesGoodwill = expectedMargin > 0;
      return {
        action: includesGoodwill ? 'Send status update + ₹50 goodwill coupon' : 'Send proactive status update',
        message: includesGoodwill
          ? `Hi ${firstName}, your order is delayed in transit. We’re tracking it and will keep you updated. Here’s a ₹50 goodwill coupon for the wait.`
          : `Hi ${firstName}, your order is delayed in transit. We’re tracking it and will keep you updated as soon as the courier shares a new delivery estimate.`,
        includesGoodwill,
      };
    }
  }
}

export type RecoveryAction = {
  name: string;
  probability: number;
  cost: number;
  value: number;
  versusReverse: number;
  reason: string;
};

export function rankRecoveryActions(
  order: Order,
  marginSuccess: number,
  reverseCost: number,
  pincode: Pin,
  courier: Courier,
  alternateCourier: Courier,
): RecoveryAction[] {
  const cod = order.payment !== 'Prepaid';
  const actions: Omit<RecoveryAction, 'value' | 'versusReverse'>[] = [
    {
      name: 'Reattempt delivery',
      probability: Math.min(.95, courier.success * pincode.success + .08),
      cost: 24,
      reason: 'A fresh attempt can recover the original delivery margin.',
    },
    {
      name: 'Reconnect with customer',
      probability: Math.min(.9, .47 + (order.score / 100) * .25),
      cost: 16,
      reason: 'Confirm intent and a suitable delivery time before dispatching again.',
    },
    {
      name: 'Convert to prepaid',
      probability: Math.min(.9, .57 + (order.score / 100) * .18 + (cod ? .08 : 0)),
      cost: 14,
      reason: 'A prepaid UPI link reduces collection risk and confirms purchase intent.',
    },
    {
      name: 'Alternate delivery',
      probability: Math.min(.95, Math.max(courier.success, alternateCourier.success) * pincode.success + .06),
      cost: 42,
      reason: `Route with ${alternateCourier.name} or offer a nearby pickup point.`,
    },
    {
      name: 'Restock to nearest warehouse',
      probability: .9,
      cost: 48,
      reason: 'Return the parcel to the nearest hub and preserve sellable inventory.',
    },
    {
      name: 'Write off',
      probability: 0,
      cost: 0,
      reason: 'Stop further handling when no recovery option has positive value.',
    },
  ];

  return actions
    .map((action) => {
      const value = Math.round(action.probability * marginSuccess - action.cost);
      return { ...action, value, versusReverse: Math.round(value + reverseCost) };
    })
    .sort((a, b) => b.value - a.value);
}

