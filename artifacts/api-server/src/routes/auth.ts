import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, users, stores, apiKeys, eq, and } from '@workspace/db';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyJwt,
  generateApiKey,
} from '../lib/auth';
import { SignupBody, LoginBody, RefreshTokensBody, CreateApiKeyBody } from '@workspace/api-zod';

const router: Router = Router();

// POST /auth/signup
router.post('/auth/signup', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = SignupBody.parse(req.body);
    const storeId = `store_${Math.random().toString(36).slice(2, 10)}`;
    const userId = `usr_${Math.random().toString(36).slice(2, 10)}`;

    // Create store
    await db.insert(stores).values({
      id: storeId,
      name: parsed.storeName,
      currency: 'INR',
    });

    // Hash password & create user
    const passwordHash = hashPassword(parsed.password);
    const refreshToken = signRefreshToken({ userId, storeId });
    const refreshTokenHash = hashPassword(refreshToken);

    await db.insert(users).values({
      id: userId,
      storeId,
      email: parsed.email.toLowerCase().trim(),
      passwordHash,
      refreshTokenHash,
      name: parsed.userName || parsed.email.split('@')[0],
      role: 'owner',
    });

    const accessToken = signAccessToken({
      userId,
      storeId,
      email: parsed.email.toLowerCase().trim(),
      role: 'owner',
    });

    res.status(201).json({
      accessToken,
      refreshToken,
      storeId,
      userId,
      email: parsed.email.toLowerCase().trim(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post('/auth/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = LoginBody.parse(req.body);
    const email = parsed.email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user || !user.passwordHash || !verifyPassword(parsed.password, user.passwordHash)) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          requestId: req.requestId,
        },
      });
      return;
    }

    const accessToken = signAccessToken({
      userId: user.id,
      storeId: user.storeId,
      email: user.email,
      role: user.role,
    });
    const refreshToken = signRefreshToken({ userId: user.id, storeId: user.storeId });

    await db
      .update(users)
      .set({ refreshTokenHash: hashPassword(refreshToken), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({
      accessToken,
      refreshToken,
      storeId: user.storeId,
      userId: user.id,
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh
router.post('/auth/refresh', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = RefreshTokensBody.parse(req.body);
    const decoded = verifyJwt(parsed.refreshToken);

    if (!decoded || decoded.type !== 'refresh') {
      res.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
          requestId: req.requestId,
        },
      });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId));

    if (!user || !user.refreshTokenHash || !verifyPassword(parsed.refreshToken, user.refreshTokenHash)) {
      res.status(401).json({
        error: {
          code: 'REVOKED_REFRESH_TOKEN',
          message: 'Refresh token has been revoked',
          requestId: req.requestId,
        },
      });
      return;
    }

    const newAccessToken = signAccessToken({
      userId: user.id,
      storeId: user.storeId,
      email: user.email,
      role: user.role,
    });
    const newRefreshToken = signRefreshToken({ userId: user.id, storeId: user.storeId });

    await db
      .update(users)
      .set({ refreshTokenHash: hashPassword(newRefreshToken), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      storeId: user.storeId,
      userId: user.id,
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
});

// GET /auth/api-keys
router.get('/auth/api-keys', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.storeId, req.storeId));

    res.json(
      list.map((k) => ({
        id: k.id,
        name: k.name,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : undefined,
        createdAt: k.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

// POST /auth/api-keys
router.post('/auth/api-keys', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = CreateApiKeyBody.parse(req.body);
    const { apiKey, keyHash } = generateApiKey();
    const id = `key_${Math.random().toString(36).slice(2, 10)}`;

    const [created] = await db
      .insert(apiKeys)
      .values({
        id,
        storeId: req.storeId,
        name: parsed.name,
        keyHash,
      })
      .returning();

    res.status(201).json({
      id: created.id,
      name: created.name,
      apiKey,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /auth/api-keys/:id
router.delete('/auth/api-keys/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const keyId = String(req.params.id);
    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.storeId, req.storeId), eq(apiKeys.id, keyId)));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
