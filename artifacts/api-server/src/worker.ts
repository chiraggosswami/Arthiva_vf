import { logger } from './lib/logger';
import { getQueueBoss, QUEUES } from './lib/queue';
import {
  processOrderIngest,
  processOrderEvaluate,
  processShipmentEvent,
  processWorkflowStep,
  processMessageSend,
  processPaymentReconcile,
} from './lib/workerHandlers';
import { pool } from '@workspace/db';

async function startWorker() {
  logger.info('Starting Margin Pilot background worker process...');
  const boss = await getQueueBoss();

  if (!boss) {
    logger.warn('Queue boss could not be initialized. Check DATABASE_URL.');
    return;
  }

  // Subscribe to queues
  await boss.work(QUEUES.ORDER_INGEST, async (jobs) => {
    for (const job of jobs) {
      await processOrderIngest(job.data as any);
    }
  });

  await boss.work(QUEUES.ORDER_EVALUATE, async (jobs) => {
    for (const job of jobs) {
      await processOrderEvaluate(job.data as any);
    }
  });

  await boss.work(QUEUES.SHIPMENT_EVENT, async (jobs) => {
    for (const job of jobs) {
      await processShipmentEvent(job.data as any);
    }
  });

  await boss.work(QUEUES.WORKFLOW_STEP, async (jobs) => {
    for (const job of jobs) {
      await processWorkflowStep(job.data as any);
    }
  });

  await boss.work(QUEUES.MESSAGE_SEND, async (jobs) => {
    for (const job of jobs) {
      await processMessageSend(job.data as any);
    }
  });

  await boss.work(QUEUES.PAYMENT_RECONCILE, async (jobs) => {
    for (const job of jobs) {
      await processPaymentReconcile(job.data as any);
    }
  });

  await boss.work(QUEUES.REVIEW_ANALYZE, async (jobs) => {
    const { runListingIntelligencePipeline } = await import('./lib/listingAnalysis/pipeline');
    for (const job of jobs) {
      const data = job.data as any;
      await runListingIntelligencePipeline(data.storeId);
    }
  });

  await boss.work(QUEUES.IMAGE_ANALYZE, async (jobs) => {
    const { runListingIntelligencePipeline } = await import('./lib/listingAnalysis/pipeline');
    for (const job of jobs) {
      const data = job.data as any;
      await runListingIntelligencePipeline(data.storeId, data.listingId);
    }
  });

  logger.info('Margin Pilot worker listening on all background queues');
}

startWorker().catch((err) => {
  logger.error({ err }, 'Fatal error starting worker');
  process.exit(1);
});

// Graceful worker shutdown
function shutdown(signal: string) {
  logger.info({ signal }, 'Worker graceful shutdown initiated');
  getQueueBoss().then((boss) => {
    if (boss) {
      boss.stop({ timeout: 10000 }).then(async () => {
        logger.info('pg-boss stopped');
        await pool.end().catch(() => {});
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });

  setTimeout(() => {
    logger.error('Worker graceful shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 12000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
