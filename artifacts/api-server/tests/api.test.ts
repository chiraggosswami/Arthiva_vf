import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { setupMemoryDb } from './setupDb';

describe('Integration Tests: API Server', () => {
  beforeAll(async () => {
    await setupMemoryDb();
  });
  let storeAToken: string;
  let storeBToken: string;
  let storeAId: string;
  let storeBId: string;
  let storeAApiKey: string;

  // 1. Health and Readiness Checks
  describe('Health Probes', () => {
    it('GET /api/health responds with 200 ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /api/healthz responds with 200 ok', async () => {
      const res = await request(app).get('/api/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  // 2. Auth Flow (Signup, Login, API Key)
  describe('Authentication Flow', () => {
    const userAEmail = `merchant_a_${Date.now()}@example.com`;
    const userBEmail = `merchant_b_${Date.now()}@example.com`;
    const password = 'StrongPassword123!';

    it('signups Merchant A successfully and returns JWT tokens', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: userAEmail,
          password,
          storeName: 'Merchant A Store',
          userName: 'Alice',
        });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.storeId).toBeDefined();
      storeAToken = res.body.accessToken;
      storeAId = res.body.storeId;
    });

    it('signups Merchant B successfully with distinct storeId', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: userBEmail,
          password,
          storeName: 'Merchant B Store',
          userName: 'Bob',
        });

      expect(res.status).toBe(201);
      expect(res.body.storeId).not.toBe(storeAId);
      storeBToken = res.body.accessToken;
      storeBId = res.body.storeId;
    });

    it('authenticates login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userAEmail,
          password,
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.storeId).toBe(storeAId);
    });

    it('rejects login with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: userAEmail,
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('generates per-store API Key for Store A', async () => {
      const res = await request(app)
        .post('/api/auth/api-keys')
        .set('Authorization', `Bearer ${storeAToken}`)
        .send({ name: 'Shiprocket Webhook Key' });

      expect(res.status).toBe(201);
      expect(res.body.apiKey).toMatch(/^mp_/);
      storeAApiKey = res.body.apiKey;
    });
  });

  // 3. Multi-Tenant Isolation
  describe('Multi-Tenant Isolation', () => {
    it('isolates orders between Store A and Store B', async () => {
      // Create order in Store A
      const createRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${storeAToken}`)
        .send({
          id: `MP-STORE-A-${Date.now()}`,
          productId: 'P01',
          customerId: 'C001',
          courierId: 'shiprocket',
          pincode: '110001',
          qty: 1,
          value: 1899,
          payment: 'COD',
          address: '42 MG Road',
          campaign: 'Meta',
        });

      expect(createRes.status).toBe(201);
      const storeAOrderId = createRes.body.id;

      // Query orders with Store B token
      const storeBListRes = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${storeBToken}`);

      expect(storeBListRes.status).toBe(200);
      const foundInB = storeBListRes.body.some((o: any) => o.id === storeAOrderId);
      expect(foundInB).toBe(false);

      // Store B direct GET by ID must return 404
      const storeBGetRes = await request(app)
        .get(`/api/orders/${storeAOrderId}`)
        .set('Authorization', `Bearer ${storeBToken}`);

      expect(storeBGetRes.status).toBe(404);
    });

    it('allows API Key authentication to access Store A orders', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('X-API-Key', storeAApiKey);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // 4. Lifecycle & Evaluation Flow on MP-1042
  describe('Order MP-1042 Evaluation and Event Flow', () => {
    const mp1042Id = `MP-1042-TEST-${Date.now()}`;

    beforeAll(async () => {
      // Create seed pincode & customer for test store if needed
      await request(app)
        .post('/api/pincodes')
        .set('Authorization', `Bearer ${storeAToken}`)
        .send({
          code: '273001',
          city: 'Gorakhpur',
          state: 'Uttar Pradesh',
          rtoRate: 0.42,
          successRate: 0.59,
        });

      await request(app)
        .post('/api/couriers')
        .set('Authorization', `Bearer ${storeAToken}`)
        .send({
          id: 'shiprocket_test',
          name: 'Shiprocket',
          successRate: 0.83,
          forwardCost: 78,
          reverseCost: 92,
        });

      await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${storeAToken}`)
        .send({
          id: 'C004_test',
          name: 'Meera Kapoor',
          phone: '+91 9810000411',
          city: 'Gorakhpur',
        });

      // Create MP-1042
      await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${storeAToken}`)
        .send({
          id: mp1042Id,
          productId: 'P01',
          customerId: 'C004_test',
          courierId: 'shiprocket_test',
          pincode: '273001',
          qty: 1,
          value: 1899,
          payment: 'COD',
          address: 'House 14, lane 3, near old post office',
          campaign: 'Instagram',
        });
    });

    it('evaluates MP-1042 and persists an audited decision row', async () => {
      const evalRes = await request(app)
        .post(`/api/orders/${mp1042Id}/evaluate`)
        .set('Authorization', `Bearer ${storeAToken}`);

      expect(evalRes.status).toBe(200);
      expect(evalRes.body.score).toBeDefined();
      expect(evalRes.body.best).toBeDefined();
      expect(evalRes.body.best.ev).toBeDefined();
      expect(evalRes.body.explanation).toBeDefined();

      // Check decisions audit log
      const decRes = await request(app)
        .get(`/api/decisions?orderId=${mp1042Id}`)
        .set('Authorization', `Bearer ${storeAToken}`);

      expect(decRes.status).toBe(200);
      expect(decRes.body.length).toBeGreaterThan(0);
      expect(decRes.body[0].orderId).toBe(mp1042Id);
    });

    it('simulates address_verified event and automatically re-scores order', async () => {
      const eventRes = await request(app)
        .post(`/api/orders/${mp1042Id}/events`)
        .set('Authorization', `Bearer ${storeAToken}`)
        .send({ event: 'address_verified' });

      expect(eventRes.status).toBe(200);
      expect(eventRes.body.addressVerified).toBe(true);
      expect(eventRes.body.status).toBe('Address verified');
      // Score increases after address verification
      expect(eventRes.body.score).toBeGreaterThan(30);
    });

    it('simulates ndr_raised event and registers NDR rescue case', async () => {
      const ndrRes = await request(app)
        .post(`/api/orders/${mp1042Id}/events`)
        .set('Authorization', `Bearer ${storeAToken}`)
        .send({ event: 'ndr_raised' });

      expect(ndrRes.status).toBe(200);
      expect(ndrRes.body.status).toBe('NDR raised');

      // Verify in ndr-cases endpoint
      const listNdrRes = await request(app)
        .get('/api/ndr-cases')
        .set('Authorization', `Bearer ${storeAToken}`);

      expect(listNdrRes.status).toBe(200);
      const ndr = listNdrRes.body.find((c: any) => c.orderId === mp1042Id);
      expect(ndr).toBeDefined();
      expect(ndr.rescueAction).toBeDefined();
    });
  });

  // 5. Dashboard Summary
  describe('Executive Dashboard Summary', () => {
    it('GET /api/dashboard/summary computes profit metrics for store', async () => {
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${storeAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalOrders).toBeGreaterThan(0);
      expect(typeof res.body.expectedMargin).toBe('number');
      expect(typeof res.body.avgRtoRate).toBe('number');
      expect(typeof res.body.marginSavedVsBaseline).toBe('number');
    });
  });
});
