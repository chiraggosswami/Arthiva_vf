import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import config from '../../firebase-applet-config.json' with { type: 'json' };

async function main() {
  const app = initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });

  const db = getFirestore(app, config.firestoreDatabaseId);
  const sellerId = `slr_test_${Date.now()}`;
  console.log('[Test] Testing seller creation with ID:', sellerId);

  // 1. Create seller doc
  const sellerRef = doc(db, 'sellers', sellerId);
  await setDoc(sellerRef, {
    id: sellerId,
    name: 'Live Test Merchant',
    description: 'Automated end-to-end integration test seller',
    category: 'Electronics & Consumer Tech',
    connectionMode: 'live_sync',
    connectionStatus: 'not_connected',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paletteIndex: 0
  });
  console.log('[Test] 1. Created sellers/' + sellerId);

  // 2. Add an event
  const eventId = `evt_${Date.now()}`;
  const eventRef = doc(db, 'sellers', sellerId, 'events', eventId);
  await setDoc(eventRef, {
    id: eventId,
    type: 'connection_test',
    sellerId: sellerId,
    timestamp: new Date().toISOString(),
    payload: { ping: true, source: 'replit_simulator' }
  });
  console.log('[Test] 2. Created sellers/' + sellerId + '/events/' + eventId);

  // 3. Add an order
  const orderId = `ORD-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const orderRef = doc(db, 'sellers', sellerId, 'orders', orderId);
  await setDoc(orderRef, {
    id: orderId,
    sellerId: sellerId,
    productId: 'P01',
    productName: 'Smart Drone 4K',
    qty: 1,
    value: 4999,
    cogs: 1800,
    unitMargin: 3199,
    payment: 'COD',
    status: 'In transit',
    pincode: '400001',
    city: 'Mumbai',
    state: 'Maharashtra',
    customerName: 'Aarav Sharma',
    customerPhone: '+91 9820011223',
    address: 'Flat 12 Marine Drive',
    campaign: 'Instagram',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSimulated: true
  });
  console.log('[Test] 3. Created sellers/' + sellerId + '/orders/' + orderId);

  // 4. Update seller status to connected
  await setDoc(sellerRef, {
    connectionStatus: 'connected',
    lastConnectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, { merge: true });
  console.log('[Test] 4. Updated connectionStatus to connected');

  // 5. Verify reads
  const sellerSnap = await getDoc(sellerRef);
  console.log('[Test] Read seller:', sellerSnap.data()?.name, 'status:', sellerSnap.data()?.connectionStatus);

  const ordersSnap = await getDocs(collection(db, 'sellers', sellerId, 'orders'));
  console.log('[Test] Orders found:', ordersSnap.docs.length, 'first:', ordersSnap.docs[0]?.id);

  console.log('[Test] All Firestore rules and operations PASSED!');
  process.exit(0);
}

main().catch(err => {
  console.error('[Test Failure]:', err);
  process.exit(1);
});
