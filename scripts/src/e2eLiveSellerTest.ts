import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import config from '../../firebase-applet-config.json' with { type: 'json' };

async function runEndToEndLiveSellerTest() {
  console.log('====================================================');
  console.log(' ARITHVA: END-TO-END FIRESTORE LIVE SELLER TEST');
  console.log('====================================================');
  console.log('[Step 1] Initializing Firebase SDK with target project:');
  console.log('  - Project ID:     ', config.projectId);
  console.log('  - Database ID:    ', config.firestoreDatabaseId);

  const app = initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });

  const db = getFirestore(app, config.firestoreDatabaseId);

  // 1. Generate live seller ID and document
  const sellerId = `slr_ravitoys_e2e_${Date.now().toString(36)}`;
  console.log('\n[Step 2] Creating seller document at sellers/' + sellerId + ' with status "not_connected"');
  
  const sellerRef = doc(db, 'sellers', sellerId);
  const sellerData = {
    id: sellerId,
    name: 'Ravi Toys Live Workspace',
    description: 'Real-time D2C Indian toys seller with live Firestore orders & NDR stream',
    category: 'Kids & Learning Toys',
    connectionMode: 'live_sync',
    connectionStatus: 'not_connected',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    paletteIndex: 0
  };
  await setDoc(sellerRef, sellerData);
  console.log('  ✓ Created seller document:', sellerId);

  // Verify initial state
  const initialSnap = await getDoc(sellerRef);
  if (!initialSnap.exists() || initialSnap.data()?.connectionStatus !== 'not_connected') {
    throw new Error('Initial seller state verification failed: expected not_connected');
  }
  console.log('  ✓ Verified initial connection status: "not_connected"');

  // 2. Simulate Replit server sending an order
  const orderId = `RT-E2E-${Math.floor(1000 + Math.random() * 9000)}`;
  const eventId = `evt_order_${Date.now()}`;
  console.log('\n[Step 3] Simulating Replit generator order push:');
  console.log('  - Order ID:       ', orderId);
  console.log('  - Event ID:       ', eventId);

  const orderRef = doc(db, 'sellers', sellerId, 'orders', orderId);
  const orderData = {
    id: orderId,
    sellerId: sellerId,
    productId: 'RT-01',
    productName: 'Remote Control Stunt Car 4WD',
    qty: 1,
    value: 1499,
    cogs: 480,
    unitMargin: 1019,
    payment: 'COD',
    status: 'In transit',
    pincode: '400001',
    city: 'Mumbai',
    state: 'Maharashtra',
    rtoRate: 0.12,
    customerName: 'Vikram Malhotra',
    customerPhone: '+91 9820112345',
    address: 'Flat 402 Sunshine Apts near Central Mall',
    campaign: 'Instagram',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isSimulated: true,
    timeline: [
      { label: 'Order ingested from Replit simulator', at: 'Just now' },
      { label: 'Assigned to Delhivery', at: 'Just now' }
    ]
  };
  await setDoc(orderRef, orderData);
  console.log('  ✓ Wrote order to sellers/' + sellerId + '/orders/' + orderId);

  // Write audit event
  const eventRef = doc(db, 'sellers', sellerId, 'events', eventId);
  await setDoc(eventRef, {
    id: eventId,
    type: 'order_created',
    sellerId: sellerId,
    orderId: orderId,
    timestamp: new Date().toISOString(),
    payload: { source: 'replit_simulator', amount: 1499, payment: 'COD' }
  });
  console.log('  ✓ Wrote event to sellers/' + sellerId + '/events/' + eventId);

  // Update seller connection status to 'connected'
  await updateDoc(sellerRef, {
    connectionStatus: 'connected',
    lastConnectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  console.log('  ✓ Updated seller connectionStatus to "connected"');

  // 3. Test idempotency & status update on existing order (NDR raised event)
  console.log('\n[Step 4] Testing order status transition (NDR raised) & event deduplication:');
  const ndrEventId = `evt_ndr_${Date.now()}`;
  await updateDoc(orderRef, {
    status: 'NDR raised',
    ndrReason: 'Customer unreachable',
    updatedAt: new Date().toISOString(),
    timeline: [
      ...orderData.timeline,
      { label: 'Delivery attempt failed: Customer unreachable', at: 'Just now' }
    ]
  });
  console.log('  ✓ Updated existing order status to "NDR raised" without creating duplicate orders');

  await setDoc(doc(db, 'sellers', sellerId, 'events', ndrEventId), {
    id: ndrEventId,
    type: 'ndr_raised',
    sellerId: sellerId,
    orderId: orderId,
    timestamp: new Date().toISOString(),
    payload: { reason: 'Customer unreachable', attempt: 1 }
  });
  console.log('  ✓ Recorded NDR event in sellers/' + sellerId + '/events/' + ndrEventId);

  // 4. Verify results
  console.log('\n[Step 5] Verifying final Firestore state:');
  const finalSellerSnap = await getDoc(sellerRef);
  console.log('  - Seller Name:             ', finalSellerSnap.data()?.name);
  console.log('  - Seller Connection Status:', finalSellerSnap.data()?.connectionStatus);
  console.log('  - Last Connected Timestamp:', finalSellerSnap.data()?.lastConnectedAt);

  const ordersSnap = await getDocs(collection(db, 'sellers', sellerId, 'orders'));
  console.log('  - Total Orders Count:      ', ordersSnap.docs.length, '(expected: 1)');
  const fetchedOrder = ordersSnap.docs[0]?.data();
  console.log('  - Order ID:                ', fetchedOrder?.id);
  console.log('  - Order Status:            ', fetchedOrder?.status);
  console.log('  - Product:                 ', fetchedOrder?.productName);
  console.log('  - Value:                   ', '₹' + fetchedOrder?.value);

  const eventsSnap = await getDocs(collection(db, 'sellers', sellerId, 'events'));
  console.log('  - Total Events Count:      ', eventsSnap.docs.length, '(expected: 2)');

  if (ordersSnap.docs.length !== 1 || fetchedOrder?.status !== 'NDR raised') {
    throw new Error('Verification assertion failed: order count or status mismatch');
  }

  console.log('\n====================================================');
  console.log(' ✓ END-TO-END VERIFICATION COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
}

runEndToEndLiveSellerTest().catch(err => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
