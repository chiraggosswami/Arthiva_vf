import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebase';
import { BRAND_PALETTES, type Seller } from '../data/sellers';
import type { Order } from '../data/seed';

export interface FirestoreLiveSellerDoc {
  id: string;
  name: string;
  description: string;
  category: string;
  connectionMode: 'live_sync' | 'csv_import' | 'demo';
  connectionStatus: 'not_connected' | 'connecting' | 'connected' | 'error';
  lastConnectedAt?: string;
  createdAt: string;
  updatedAt: string;
  paletteIndex?: number;
}

export interface FirestoreLiveEvent {
  id: string;
  type: string;
  sellerId: string;
  orderId?: string;
  timestamp: string;
  payload?: any;
}

/**
 * Creates or updates a seller document in Firestore at sellers/{sellerId}
 */
export async function createLiveSellerInFirestore(seller: Seller): Promise<void> {
  if (!isFirebaseConfigured) return;

  const sellerRef = doc(db, 'sellers', seller.id);
  const payload: FirestoreLiveSellerDoc = {
    id: seller.id,
    name: seller.name,
    description: seller.description || seller.tagline,
    category: seller.category || 'D2C Consumer Retail',
    connectionMode: 'live_sync',
    connectionStatus: seller.connectionStatus || 'not_connected',
    createdAt: seller.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paletteIndex: seller.paletteIndex ?? 0,
    ...(seller.lastConnectedAt ? { lastConnectedAt: seller.lastConnectedAt } : {})
  };

  try {
    await setDoc(sellerRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sellers/${seller.id}`);
  }
}

/**
 * Deletes an unconfirmed or cancelled seller document from Firestore
 */
export async function deleteLiveSellerFromFirestore(sellerId: string): Promise<void> {
  if (!isFirebaseConfigured || !sellerId) return;
  try {
    const sellerRef = doc(db, 'sellers', sellerId);
    await deleteDoc(sellerRef);
  } catch (err) {
    console.warn(`[Firestore] Failed to delete draft seller ${sellerId}:`, err);
  }
}

/**
 * Updates a seller's connection status (not_connected | connecting | connected | error)
 */
export async function updateSellerConnectionStatus(
  sellerId: string,
  status: 'not_connected' | 'connecting' | 'connected' | 'error',
  lastConnectedAt?: string
): Promise<void> {
  if (!isFirebaseConfigured) return;

  const sellerRef = doc(db, 'sellers', sellerId);
  const updatePayload: Record<string, any> = {
    connectionStatus: status,
    updatedAt: new Date().toISOString(),
  };
  if (lastConnectedAt || status === 'connected') {
    updatePayload.lastConnectedAt = lastConnectedAt || new Date().toISOString();
  }

  try {
    await setDoc(sellerRef, updatePayload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sellers/${sellerId}`);
  }
}

/**
 * Fetches all persistent sellers stored in Firestore
 */
export async function fetchAllLiveSellersFromFirestore(): Promise<Seller[]> {
  if (!isFirebaseConfigured) return [];

  try {
    const sellersColl = collection(db, 'sellers');
    const snapshot = await getDocs(sellersColl);
    const results: Seller[] = [];

    snapshot.forEach((d) => {
      const data = d.data() as FirestoreLiveSellerDoc;
      const palette = BRAND_PALETTES[(data.paletteIndex || 0) % BRAND_PALETTES.length];
      results.push({
        id: data.id || d.id,
        name: data.name,
        category: data.category || 'D2C Consumer Retail',
        tagline: data.description?.slice(0, 50) || 'Connected Live Seller',
        description: data.description,
        accentColor: {
          primary: palette.primary,
          secondary: palette.secondary,
          highlight: palette.highlight,
          lightBg: palette.lightBg,
          border: palette.border
        },
        productIds: [],
        sampleAov: 1800,
        monthlyOrders: 0,
        isCustom: true,
        createdAt: data.createdAt,
        connectionMode: data.connectionMode || 'live_sync',
        connectionStatus: data.connectionStatus || 'not_connected',
        lastConnectedAt: data.lastConnectedAt,
        paletteIndex: data.paletteIndex ?? 0
      });
    });

    return results;
  } catch (err) {
    console.warn('[Firestore] Error fetching live sellers:', err);
    return [];
  }
}

/**
 * Real-time listener for a seller's metadata at sellers/{sellerId}
 */
export function listenToLiveSeller(
  sellerId: string,
  onSeller: (seller: FirestoreLiveSellerDoc) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !sellerId) {
    return () => {};
  }

  const sellerRef = doc(db, 'sellers', sellerId);
  return onSnapshot(
    sellerRef,
    (snap) => {
      if (snap.exists()) {
        onSeller(snap.data() as FirestoreLiveSellerDoc);
      }
    },
    (err) => {
      console.warn(`[Firestore] Error listening to seller ${sellerId}:`, err);
      onError?.(err);
    }
  );
}

/**
 * Real-time listener for a seller's orders at sellers/{sellerId}/orders/{orderId}
 */
export function listenToLiveOrders(
  sellerId: string,
  onOrders: (orders: Order[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !sellerId) {
    return () => {};
  }

  const ordersColl = collection(db, 'sellers', sellerId, 'orders');
  return onSnapshot(
    ordersColl,
    (snapshot) => {
      const orders: Order[] = [];
      snapshot.forEach((d) => {
        const raw = d.data();
        const ord: Order = {
          id: raw.id || d.id,
          productId: raw.productId || 'P01',
          customerId: raw.customerId || `C_${raw.id || d.id}`,
          qty: Number(raw.qty) || 1,
          value: Number(raw.value) || Number(raw.price) || 1000,
          payment: (raw.payment as any) || 'COD',
          address: raw.address || 'Address on file',
          addressComplete: raw.addressComplete ?? (raw.address && raw.address.length >= 15),
          addressVerified: Boolean(raw.addressVerified),
          otpPassed: Boolean(raw.otpPassed),
          campaign: raw.campaign || 'Direct',
          pincode: raw.pincode || '110001',
          courierId: raw.courierId || 'delhivery',
          status: raw.status || 'In transit',
          journey: raw.journey || 'Full COD',
          score: Number(raw.score) || 50,
          created: raw.created || raw.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          advancePaid: Boolean(raw.advancePaid),
          timeline: Array.isArray(raw.timeline) ? raw.timeline : [
            { label: 'Order ingested via live sync', at: 'Just now' }
          ],
          customerName: raw.customerName,
          customerPhone: raw.customerPhone,
          sellerId: sellerId,
          // Custom / rich fields
          productName: raw.productName,
          cogs: Number(raw.cogs) || Math.round((Number(raw.value) || 1000) * 0.35),
          unitMargin: Number(raw.unitMargin) || (Number(raw.value) || 1000) - (Number(raw.cogs) || 350),
          city: raw.city || 'Metro City',
          state: raw.state || 'India',
          rtoRate: typeof raw.rtoRate === 'number' ? raw.rtoRate : 0.18,
          isSimulated: Boolean(raw.isSimulated),
        };
        orders.push(ord);
      });

      onOrders(orders);
    },
    (err) => {
      console.warn(`[Firestore] Error listening to orders for seller ${sellerId}:`, err);
      onError?.(err);
    }
  );
}

/**
 * Real-time listener for a seller's operational event stream at sellers/{sellerId}/events
 */
export function listenToLiveEvents(
  sellerId: string,
  onEvents: (events: FirestoreLiveEvent[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !sellerId) {
    return () => {};
  }

  const eventsColl = collection(db, 'sellers', sellerId, 'events');
  return onSnapshot(
    eventsColl,
    (snapshot) => {
      const events: FirestoreLiveEvent[] = [];
      snapshot.forEach((d) => {
        const raw = d.data();
        events.push({
          id: raw.id || d.id,
          type: raw.type || 'unknown_event',
          sellerId: raw.sellerId || sellerId,
          orderId: raw.orderId,
          timestamp: raw.timestamp || new Date().toISOString(),
          payload: raw.payload || {}
        });
      });

      // Sort newest first
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onEvents(events);
    },
    (err) => {
      console.warn(`[Firestore] Error listening to events for seller ${sellerId}:`, err);
      onError?.(err);
    }
  );
}

/**
 * Sends a simulated verified live order and event to Firestore
 * Updates connectionStatus to 'connected' and sets lastConnectedAt
 */
export async function sendSimulatedLiveOrder(
  sellerId: string,
  customOrder?: Partial<Order>
): Promise<{ orderId: string; eventId: string }> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured for live streaming');
  }

  const nowIso = new Date().toISOString();
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const orderId = customOrder?.id || `ORD-LIVE-${randNum}`;
  const eventId = `evt_${Date.now()}_${randNum}`;

  const productsList = [
    { id: 'P01', name: 'Smart IoT Ambient Lamp', price: 2499, cogs: 820 },
    { id: 'P02', name: 'Ergonomic Memory Foam Cushion', price: 1499, cogs: 490 },
    { id: 'P03', name: 'Wireless Fast Charging Station 3-in-1', price: 2999, cogs: 950 },
    { id: 'P04', name: 'Ceramic Handcrafted Pour-over Dripper', price: 1199, cogs: 340 },
  ];
  const sampleProd = productsList[Math.floor(Math.random() * productsList.length)];

  const cities = [
    { city: 'Mumbai', state: 'Maharashtra', pin: '400001', rtoRate: 0.12 },
    { city: 'Bengaluru', state: 'Karnataka', pin: '560001', rtoRate: 0.10 },
    { city: 'Gorakhpur', state: 'Uttar Pradesh', pin: '273001', rtoRate: 0.38 },
    { city: 'Lucknow', state: 'Uttar Pradesh', pin: '226001', rtoRate: 0.24 },
    { city: 'Pune', state: 'Maharashtra', pin: '411001', rtoRate: 0.14 },
  ];
  const sampleCity = cities[Math.floor(Math.random() * cities.length)];

  const isCod = Math.random() > 0.35;
  const price = customOrder?.value || sampleProd.price;
  const cogs = (customOrder as any)?.cogs || sampleProd.cogs;

  const orderPayload = {
    id: orderId,
    sellerId,
    productId: customOrder?.productId || sampleProd.id,
    productName: (customOrder as any)?.productName || sampleProd.name,
    qty: customOrder?.qty || 1,
    value: price,
    cogs: cogs,
    unitMargin: (customOrder as any)?.unitMargin || price - cogs,
    payment: customOrder?.payment || (isCod ? 'COD' : 'Prepaid'),
    status: customOrder?.status || (sampleCity.rtoRate > 0.3 ? 'NDR raised' : 'In transit'),
    pincode: customOrder?.pincode || sampleCity.pin,
    city: (customOrder as any)?.city || sampleCity.city,
    state: (customOrder as any)?.state || sampleCity.state,
    rtoRate: sampleCity.rtoRate,
    customerName: customOrder?.customerName || 'Vikramaditya Sengupta',
    customerPhone: customOrder?.customerPhone || '+91 9830112233',
    address: customOrder?.address || 'Plot 42 Sector 18 Near Main Commercial Complex',
    addressComplete: true,
    campaign: customOrder?.campaign || (Math.random() > 0.5 ? 'Instagram' : 'Meta prospecting'),
    createdAt: nowIso,
    updatedAt: nowIso,
    isSimulated: true,
    timeline: [
      { label: 'Order ingested from Replit simulator', at: 'Just now' },
      { label: `Payment method: ${isCod ? 'COD' : 'Prepaid'}`, at: 'Just now' },
    ],
  };

  // 1. Write order doc to sellers/{sellerId}/orders/{orderId}
  try {
    const orderRef = doc(db, 'sellers', sellerId, 'orders', orderId);
    await setDoc(orderRef, orderPayload);

    // 2. Write event doc to sellers/{sellerId}/events/{eventId}
    const eventRef = doc(db, 'sellers', sellerId, 'events', eventId);
    await setDoc(eventRef, {
      id: eventId,
      type: 'order_created',
      sellerId,
      orderId,
      timestamp: nowIso,
      payload: {
        orderId,
        amount: price,
        payment: orderPayload.payment,
        source: 'replit_simulator',
        simulated: true,
      },
    });

    // 3. Mark seller as connected in Firestore
    await updateSellerConnectionStatus(sellerId, 'connected', nowIso);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sellers/${sellerId}/orders/${orderId}`);
  }

  return { orderId, eventId };
}
