import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import router from './routes';
import webhooksRouter from './routes/webhooks';
import { logger } from './lib/logger';
import { tenantMiddleware } from './middlewares/tenant';
import { errorHandler } from './middlewares/error';

const app: Express = express();

// Security headers
app.use(helmet());

// Structured request logging with request IDs
app.use(
  pinoHttp({
    logger,
    genReqId(req) {
      return (req.headers['x-request-id'] as string) || `req_${Math.random().toString(36).slice(2, 10)}`;
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split('?')[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS allowlist configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Dev permissive fallback
    },
    credentials: true,
  }),
);

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// Webhook endpoints directly on /webhooks
app.use(tenantMiddleware);
app.use(webhooksRouter);

// Tenant & authentication middleware applied to /api
app.use('/api', router);

// Centralized error handler
app.use(errorHandler);

export default app;
