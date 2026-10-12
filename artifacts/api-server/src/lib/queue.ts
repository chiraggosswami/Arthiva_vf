import PgBoss from 'pg-boss';
import { logger } from './logger';
import type { NormalizedOrder } from '../adapters/types';

export const QUEUES = {
  ORDER_INGEST: 'order.ingest',
  ORDER_EVALUATE: 'order.evaluate',
  SHIPMENT_EVENT: 'shipment.event',
  WORKFLOW_STEP: 'workflow.step',
  MESSAGE_SEND: 'message.send',
  PAYMENT_RECONCILE: 'payment.reconcile',
  REVIEW_ANALYZE: 'review.analyze',
  IMAGE_ANALYZE: 'image.analyze',
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

export interface OrderIngestJobData {
  storeId: string;
  source: string;
  externalId: string;
  order: NormalizedOrder;
  webhookEventId?: string;
}

export interface OrderEvaluateJobData {
  storeId: string;
  orderId: string;
  reason?: string;
}

export interface ShipmentEventJobData {
  storeId: string;
  orderId: string;
  courierId: string;
  awbNumber?: string;
  event: string;
  milestone: string;
  statusLabel: string;
  ndrReason?: string;
  city?: string;
  timestamp: string;
  rawPayload: any;
  webhookEventId?: string;
}

export interface WorkflowStepJobData {
  storeId: string;
  orderId: string;
  step:
    | 'ndr_rescue'
    | 'ndr_followup'
    | 'ndr_final_decision'
    | 'rto_recovery'
    | 'customer_reply'
    | 'whatsapp_verify'
    | 'otp_challenge'
    | 'human_review';
  metadata?: any;
}

export interface MessageSendJobData {
  storeId: string;
  orderId: string;
  channel: 'whatsapp' | 'sms' | 'email';
  template: string;
  recipient: string;
  variables: Record<string, any>;
}

export interface PaymentReconcileJobData {
  storeId: string;
  orderId: string;
  amount: number;
  paymentId?: string;
  method: string;
}

let bossInstance: PgBoss | null = null;

export async function getQueueBoss(): Promise<PgBoss | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logger.warn('DATABASE_URL not configured; pg-boss queue disabled in development');
    return null;
  }

  if (bossInstance) {
    return bossInstance;
  }

  try {
    bossInstance = new PgBoss(connectionString);
    bossInstance.on('error', (err) => {
      logger.error({ err }, 'pg-boss error');
    });

    await bossInstance.start();
    logger.info('pg-boss background job runner started');

    // Create standard queues with retry + exponential backoff + deadLetter config
    for (const q of Object.values(QUEUES)) {
      await bossInstance.createQueue(q, {
        name: q,
        policy: 'standard',
        deadLetter: `${q}.dlq`,
      } as any).catch(() => {
        // Queue may already exist
      });
    }

    return bossInstance;
  } catch (err) {
    logger.error({ err }, 'Failed to initialize pg-boss');
    return null;
  }
}

// Helper Enqueue Functions
export async function enqueueOrderIngest(data: OrderIngestJobData): Promise<string | null> {
  const boss = await getQueueBoss();
  if (!boss) return null;
  return boss.send(QUEUES.ORDER_INGEST, data, {
    retryLimit: 5,
    retryDelay: 2,
    retryBackoff: true,
  });
}

export async function enqueueOrderEvaluate(data: OrderEvaluateJobData): Promise<string | null> {
  const boss = await getQueueBoss();
  if (!boss) return null;
  return boss.send(QUEUES.ORDER_EVALUATE, data, {
    retryLimit: 5,
    retryDelay: 2,
    retryBackoff: true,
  });
}

export async function enqueueShipmentEvent(data: ShipmentEventJobData): Promise<string | null> {
  const boss = await getQueueBoss();
  if (!boss) return null;
  return boss.send(QUEUES.SHIPMENT_EVENT, data, {
    retryLimit: 5,
    retryDelay: 2,
    retryBackoff: true,
  });
}

export async function enqueueWorkflowStep(
  data: WorkflowStepJobData,
  options?: { delaySeconds?: number }
): Promise<string | null> {
  const boss = await getQueueBoss();
  if (!boss) return null;
  return boss.send(QUEUES.WORKFLOW_STEP, data, {
    retryLimit: 5,
    retryDelay: 2,
    retryBackoff: true,
    ...(options?.delaySeconds ? { startAfter: options.delaySeconds } : {}),
  });
}

export async function enqueueMessageSend(data: MessageSendJobData): Promise<string | null> {
  const boss = await getQueueBoss();
  if (!boss) return null;
  return boss.send(QUEUES.MESSAGE_SEND, data, {
    retryLimit: 5,
    retryDelay: 2,
    retryBackoff: true,
  });
}

export async function enqueuePaymentReconcile(data: PaymentReconcileJobData): Promise<string | null> {
  const boss = await getQueueBoss();
  if (!boss) return null;
  return boss.send(QUEUES.PAYMENT_RECONCILE, data, {
    retryLimit: 5,
    retryDelay: 2,
    retryBackoff: true,
  });
}

export interface ReviewAnalyzeJobData {
  storeId: string;
  batchId: string;
  items: Array<{
    id: string; // review id or return reason id
    type: 'review' | 'return_reason';
    listingId: string;
    sku: string;
    text: string;
    rating?: number;
    date?: string;
    textHash: string;
  }>;
}

export interface ImageAnalyzeJobData {
  storeId: string;
  listingId: string;
}

export async function enqueueReviewAnalyze(data: ReviewAnalyzeJobData): Promise<string | null> {
  const boss = await getQueueBoss();
  if (!boss) return null;
  return boss.send(QUEUES.REVIEW_ANALYZE, data, {
    retryLimit: 3,
    retryDelay: 2,
    retryBackoff: true,
  });
}

export async function enqueueImageAnalyze(data: ImageAnalyzeJobData): Promise<string | null> {
  const boss = await getQueueBoss();
  if (!boss) return null;
  return boss.send(QUEUES.IMAGE_ANALYZE, data, {
    retryLimit: 3,
    retryDelay: 2,
    retryBackoff: true,
  });
}

