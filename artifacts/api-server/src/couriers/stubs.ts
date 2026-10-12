import type { CourierAdapter, CourierEventMapping, ShipmentResult, TrackingResult } from './types';
import { MockCourierAdapter } from './mock';

abstract class BaseCarrierStub implements CourierAdapter {
  abstract id: string;
  abstract name: string;
  isConnected = false; // Clearly marked not-connected

  async createShipment(_order: any): Promise<ShipmentResult> {
    throw new Error(`Carrier ${this.name} (${this.id}) is not connected. Configure API credentials in Settings > Couriers.`);
  }

  async track(_awbNumber: string): Promise<TrackingResult> {
    throw new Error(`Carrier ${this.name} (${this.id}) tracking is not connected.`);
  }

  abstract mapStatusToEvent(rawStatus: string, rawPayload: any): CourierEventMapping;
}

export class DelhiveryAdapter extends BaseCarrierStub {
  id = 'delhivery';
  name = 'Delhivery Express';

  mapStatusToEvent(rawStatus: string, rawPayload: any): CourierEventMapping {
    const s = String(rawStatus || rawPayload.status || '').toUpperCase();
    const timestamp = rawPayload.timestamp || new Date().toISOString();

    if (s === 'OFD' || s.includes('OUT FOR DELIVERY')) {
      return { milestone: 'OUT_FOR_DELIVERY', domainEvent: 'out_for_delivery', statusLabel: 'Out for delivery', timestamp, rawPayload };
    }
    if (s === 'NDR' || s.includes('UNDELIVERED') || s.includes('FAILED')) {
      return {
        milestone: 'NDR',
        domainEvent: 'ndr_raised',
        statusLabel: 'NDR raised',
        ndrReason: rawPayload.ndr_reason || rawPayload.remarks || 'Customer unavailable',
        timestamp,
        rawPayload,
      };
    }
    if (s === 'RTO' || s.includes('RETURN TO ORIGIN') || s.includes('RTO')) {
      return { milestone: 'RTO_INITIATED', domainEvent: 'rto_initiated', statusLabel: 'RTO initiated', timestamp, rawPayload };
    }
    if (s === 'DL' || s.includes('DELIVERED')) {
      return { milestone: 'DELIVERED', domainEvent: 'delivered', statusLabel: 'Delivered', timestamp, rawPayload };
    }
    return { milestone: 'IN_TRANSIT', domainEvent: 'shipped', statusLabel: 'In transit', timestamp, rawPayload };
  }
}

export class BluedartAdapter extends BaseCarrierStub {
  id = 'bluedart';
  name = 'Blue Dart Express';

  mapStatusToEvent(rawStatus: string, rawPayload: any): CourierEventMapping {
    const s = String(rawStatus || rawPayload.status || '').toUpperCase();
    const timestamp = rawPayload.timestamp || new Date().toISOString();

    if (s.includes('OUT FOR DEL')) {
      return { milestone: 'OUT_FOR_DELIVERY', domainEvent: 'out_for_delivery', statusLabel: 'Out for delivery', timestamp, rawPayload };
    }
    if (s.includes('UNDEL') || s.includes('MISSED')) {
      return {
        milestone: 'NDR',
        domainEvent: 'ndr_raised',
        statusLabel: 'NDR raised',
        ndrReason: rawPayload.reason || 'Address incomplete / unreachable',
        timestamp,
        rawPayload,
      };
    }
    if (s.includes('RTO')) {
      return { milestone: 'RTO_INITIATED', domainEvent: 'rto_initiated', statusLabel: 'RTO initiated', timestamp, rawPayload };
    }
    if (s.includes('DELIVERED')) {
      return { milestone: 'DELIVERED', domainEvent: 'delivered', statusLabel: 'Delivered', timestamp, rawPayload };
    }
    return { milestone: 'IN_TRANSIT', domainEvent: 'shipped', statusLabel: 'In transit', timestamp, rawPayload };
  }
}

export class XpressbeesAdapter extends BaseCarrierStub {
  id = 'xpressbees';
  name = 'Xpressbees Logistics';

  mapStatusToEvent(rawStatus: string, rawPayload: any): CourierEventMapping {
    const s = String(rawStatus || rawPayload.status || '').toUpperCase();
    const timestamp = rawPayload.timestamp || new Date().toISOString();

    if (s.includes('OFD')) {
      return { milestone: 'OUT_FOR_DELIVERY', domainEvent: 'out_for_delivery', statusLabel: 'Out for delivery', timestamp, rawPayload };
    }
    if (s.includes('NDR') || s.includes('FAIL')) {
      return {
        milestone: 'NDR',
        domainEvent: 'ndr_raised',
        statusLabel: 'NDR raised',
        ndrReason: rawPayload.reason || 'Customer refused / rescheduled',
        timestamp,
        rawPayload,
      };
    }
    if (s.includes('RTO')) {
      return { milestone: 'RTO_INITIATED', domainEvent: 'rto_initiated', statusLabel: 'RTO initiated', timestamp, rawPayload };
    }
    if (s.includes('DELIVERED')) {
      return { milestone: 'DELIVERED', domainEvent: 'delivered', statusLabel: 'Delivered', timestamp, rawPayload };
    }
    return { milestone: 'IN_TRANSIT', domainEvent: 'shipped', statusLabel: 'In transit', timestamp, rawPayload };
  }
}

export class ShadowfaxAdapter extends BaseCarrierStub {
  id = 'shadowfax';
  name = 'Shadowfax Technologies';

  mapStatusToEvent(rawStatus: string, rawPayload: any): CourierEventMapping {
    const s = String(rawStatus || rawPayload.status || '').toUpperCase();
    const timestamp = rawPayload.timestamp || new Date().toISOString();

    if (s.includes('OUT_FOR_DELIVERY')) {
      return { milestone: 'OUT_FOR_DELIVERY', domainEvent: 'out_for_delivery', statusLabel: 'Out for delivery', timestamp, rawPayload };
    }
    if (s.includes('REJECTED') || s.includes('FAILED') || s.includes('NDR')) {
      return {
        milestone: 'NDR',
        domainEvent: 'ndr_raised',
        statusLabel: 'NDR raised',
        ndrReason: rawPayload.reason || 'Customer unavailable',
        timestamp,
        rawPayload,
      };
    }
    if (s.includes('RTO')) {
      return { milestone: 'RTO_INITIATED', domainEvent: 'rto_initiated', statusLabel: 'RTO initiated', timestamp, rawPayload };
    }
    if (s.includes('DELIVERED')) {
      return { milestone: 'DELIVERED', domainEvent: 'delivered', statusLabel: 'Delivered', timestamp, rawPayload };
    }
    return { milestone: 'IN_TRANSIT', domainEvent: 'shipped', statusLabel: 'In transit', timestamp, rawPayload };
  }
}

export const courierRegistry: Record<string, CourierAdapter> = {
  mock: new MockCourierAdapter(),
  delhivery: new DelhiveryAdapter(),
  bluedart: new BluedartAdapter(),
  xpressbees: new XpressbeesAdapter(),
  shadowfax: new ShadowfaxAdapter(),
};
