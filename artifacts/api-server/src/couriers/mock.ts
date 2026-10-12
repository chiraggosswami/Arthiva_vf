import type { CourierAdapter, CourierEventMapping, ShipmentResult, TrackingResult, CourierMilestone } from './types';

export class MockCourierAdapter implements CourierAdapter {
  id = 'mock';
  name = 'Mock Courier (Testing & Dev)';
  isConnected = true;

  async createShipment(order: any): Promise<ShipmentResult> {
    const awbNumber = `MOCK-AWB-${Math.floor(10000000 + Math.random() * 90000000)}`;
    return {
      success: true,
      awbNumber,
      courierId: this.id,
      forwardCost: 75,
      reverseCost: 85,
      labelUrl: `https://labels.marginpilot.mock/${awbNumber}.pdf`,
    };
  }

  async track(awbNumber: string): Promise<TrackingResult> {
    return {
      awbNumber,
      status: 'IN_TRANSIT',
      location: 'Hub - Gurugram',
      activityHistory: [
        { status: 'MANIFESTED', location: 'Merchant Hub', at: new Date().toISOString() },
        { status: 'IN_TRANSIT', location: 'Hub - Gurugram', at: new Date().toISOString() },
      ],
    };
  }

  mapStatusToEvent(rawStatus: string, rawPayload: any): CourierEventMapping {
    const s = String(rawStatus || '').toUpperCase().trim();
    const timestamp = rawPayload.timestamp || new Date().toISOString();

    if (s.includes('OUT') || s.includes('OFD')) {
      return {
        milestone: 'OUT_FOR_DELIVERY',
        domainEvent: 'out_for_delivery',
        statusLabel: 'Out for delivery',
        city: rawPayload.city || 'Destination Hub',
        timestamp,
        rawPayload,
      };
    }

    if (s.includes('NDR') || s.includes('FAILED') || s.includes('UNDELIVERED')) {
      return {
        milestone: 'NDR',
        domainEvent: 'ndr_raised',
        statusLabel: 'NDR raised',
        ndrReason: rawPayload.reason || rawPayload.ndr_reason || 'Customer unreachable',
        city: rawPayload.city,
        timestamp,
        rawPayload,
      };
    }

    if (s.includes('RTO') || s.includes('RETURN')) {
      return {
        milestone: 'RTO_INITIATED',
        domainEvent: 'rto_initiated',
        statusLabel: 'RTO initiated',
        city: rawPayload.city,
        timestamp,
        rawPayload,
      };
    }

    if (s.includes('DELIVER') || s.includes('DLVD')) {
      return {
        milestone: 'DELIVERED',
        domainEvent: 'delivered',
        statusLabel: 'Delivered',
        city: rawPayload.city,
        timestamp,
        rawPayload,
      };
    }

    return {
      milestone: 'IN_TRANSIT',
      domainEvent: 'shipped',
      statusLabel: 'In transit',
      city: rawPayload.city,
      timestamp,
      rawPayload,
    };
  }
}
