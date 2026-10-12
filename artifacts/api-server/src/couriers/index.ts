import type { CourierAdapter } from './types';
import { MockCourierAdapter } from './mock';
import { DelhiveryAdapter, BluedartAdapter, XpressbeesAdapter, ShadowfaxAdapter } from './stubs';

export * from './types';
export * from './mock';
export * from './stubs';

const adapters: Record<string, CourierAdapter> = {
  mock: new MockCourierAdapter(),
  shiprocket: new MockCourierAdapter(), // shiprocket uses mock courier for testing
  delhivery: new DelhiveryAdapter(),
  bluedart: new BluedartAdapter(),
  xpressbees: new XpressbeesAdapter(),
  shadowfax: new ShadowfaxAdapter(),
};

export function getCourierAdapter(courierId: string): CourierAdapter {
  const normalized = courierId.toLowerCase().trim();
  return adapters[normalized] || adapters.mock;
}
