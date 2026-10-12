import type { Request, Response, NextFunction } from 'express';
import { db, apiKeys, eq } from '@workspace/db';
import { verifyJwt, hashApiKey } from '../lib/auth';

declare global {
  namespace Express {
    interface Request {
      storeId: string;
      user?: {
        id: string;
        storeId: string;
        email: string;
        role: string;
      };
      apiKey?: {
        id: string;
        name: string;
      };
      requestId: string;
    }
  }
}

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const reqId = (req.headers['x-request-id'] as string) || `req_${Math.random().toString(36).slice(2, 10)}`;
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);

  // 1. Authorization: Bearer <jwt>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyJwt(token);
    if (payload && payload.storeId) {
      req.storeId = payload.storeId;
      req.user = {
        id: payload.userId,
        storeId: payload.storeId,
        email: payload.email,
        role: payload.role,
      };
      return next();
    }
  }

  // 2. X-API-Key: <plainKey>
  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim() !== '') {
    const keyHash = hashApiKey(apiKeyHeader.trim());
    try {
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash));

      if (keyRecord) {
        req.storeId = keyRecord.storeId;
        req.apiKey = { id: keyRecord.id, name: keyRecord.name };
        // update lastUsedAt asynchronously
        db.update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, keyRecord.id))
          .catch(() => {});
        return next();
      }
    } catch {
      // fallback
    }
  }

  // 3. Optional fallback x-store-id header (for demo/development/seed requests)
  const storeIdHeader = req.headers['x-store-id'];
  if (typeof storeIdHeader === 'string' && storeIdHeader.trim() !== '') {
    req.storeId = storeIdHeader.trim();
    return next();
  }

  req.storeId = 'demo-store';
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user && !req.apiKey && req.storeId === 'demo-store') {
    // In demo mode or with valid tenant, allow operation
    return next();
  }

  if (!req.user && !req.apiKey) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Provide a valid Bearer token or X-API-Key.',
        requestId: req.requestId,
      },
    });
    return;
  }
  next();
}
