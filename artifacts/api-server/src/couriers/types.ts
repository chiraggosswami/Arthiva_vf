export type CourierMilestone =
  | 'MANIFESTED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'NDR'
  | 'DELIVERED'
  | 'RTO_INITIATED'
  | 'RTO_DELIVERED';

export interface CourierEventMapping {
  milestone: CourierMilestone;
  domainEvent: string; // 'shipped' | 'out_for_delivery' | 'ndr_raised' | 'delivered' | 'rto_initiated'
  statusLabel: string;
  ndrReason?: string;
  city?: string;
  timestamp: string;
  rawPayload: any;
}

export interface ShipmentResult {
  success: boolean;
  awbNumber: string;
  courierId: string;
  forwardCost: number;
  reverseCost: number;
  labelUrl?: string;
}

export interface TrackingResult {
  awbNumber: string;
  status: CourierMilestone;
  location?: string;
  activityHistory: Array<{ status: string; location: string; at: string }>;
}

export interface CourierAdapter {
  id: string;
  name: string;
  isConnected: boolean;
  createShipment(order: any, options?: any): Promise<ShipmentResult>;
  track(awbNumber: string): Promise<TrackingResult>;
  mapStatusToEvent(rawStatus: string, rawPayload: any): CourierEventMapping;
}
