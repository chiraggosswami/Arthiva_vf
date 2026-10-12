import {
  db,
  orders,
  orderItems,
  orderEvents,
  products,
  customers,
  pincodeStats,
  couriers,
  decisions,
  ndrCases,
  rtoCases,
  webhookEvents,
  messages,
  payments,
  eq,
  and,
} from '@workspace/db';
import {
  evaluate,
  DEFAULT_ENGINE_CONFIG,
  recommendNdrRescue,
  rankRecoveryActions,
  type NdrReason,
} from '@workspace/engine';
import { logger } from './logger';
import { getMessageProvider } from './messaging';
import { getPaymentProvider } from './payments';
import {
  getQueueBoss,
  QUEUES,
  enqueueOrderEvaluate,
  enqueueWorkflowStep,
  enqueueMessageSend,
  type OrderIngestJobData,
  type OrderEvaluateJobData,
  type ShipmentEventJobData,
  type WorkflowStepJobData,
  type MessageSendJobData,
  type PaymentReconcileJobData,
} from './queue';

export async function processOrderIngest(data: OrderIngestJobData): Promise<void> {
  const { storeId, order: normalized, webhookEventId } = data;
  logger.info({ storeId, orderId: normalized.id }, 'Processing order.ingest');

  try {
    // 1. Ensure Customer
    let [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.storeId, storeId), eq(customers.id, normalized.customer.id)));

    if (!customer) {
      const [inserted] = await db
        .insert(customers)
        .values({
          id: normalized.customer.id,
          storeId,
          name: normalized.customer.name,
          phone: normalized.customer.phone,
          city: normalized.customer.city,
        })
        .onConflictDoNothing()
        .returning();
      customer = inserted;
    }

    // 2. Ensure Pincode
    const zip = normalized.address.zip;
    let [pin] = await db
      .select()
      .from(pincodeStats)
      .where(and(eq(pincodeStats.storeId, storeId), eq(pincodeStats.code, zip)));

    if (!pin) {
      const [insertedPin] = await db
        .insert(pincodeStats)
        .values({
          id: `${storeId}:${zip}`,
          storeId,
          code: zip,
          city: normalized.address.city,
          state: normalized.address.province || 'Delhi',
          rtoRate: '0.22',
          successRate: '0.82',
        })
        .onConflictDoNothing()
        .returning();
      pin = insertedPin;
    }

    // 3. Ensure Default / First Courier
    let [courier] = await db
      .select()
      .from(couriers)
      .where(and(eq(couriers.storeId, storeId), eq(couriers.isActive, true)));

    if (!courier) {
      const [insertedCourier] = await db
        .insert(couriers)
        .values({
          id: 'shiprocket',
          storeId,
          name: 'Shiprocket',
          successRate: '0.83',
          forwardCost: 78,
          reverseCost: 92,
          isActive: true,
        })
        .onConflictDoNothing()
        .returning();
      courier = insertedCourier;
    }
    const courierId = courier?.id || 'shiprocket';

    // 4. Upsert Order
    const [existingOrder] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.id, normalized.id)));

    if (!existingOrder) {
      await db.insert(orders).values({
        id: normalized.id,
        storeId,
        customerId: normalized.customer.id,
        courierId,
        pincode: zip,
        totalValue: normalized.totalValue,
        paymentMethod: normalized.paymentMethod,
        status: 'Confirmed',
        journey: 'Full COD',
        score: 50,
        pRto: '0.20',
        campaign: normalized.campaign || 'Direct',
        address: normalized.rawAddressString,
        addressComplete: Boolean(normalized.address.address1 && normalized.address.zip),
        addressVerified: false,
        otpPassed: false,
        advancePaid: normalized.paymentMethod === 'Prepaid',
        customerName: normalized.customer.name,
        customerPhone: normalized.customer.phone,
      });

      // 5. Insert Items
      for (const item of normalized.items) {
        // Ensure Product
        let [prod] = await db
          .select()
          .from(products)
          .where(and(eq(products.storeId, storeId), eq(products.id, item.productId)));

        if (!prod) {
          const [insertedProd] = await db
            .insert(products)
            .values({
              id: item.productId,
              storeId,
              name: item.title,
              price: item.price,
              cogs: item.cogs || Math.round(item.price * 0.3),
            })
            .onConflictDoNothing()
            .returning();
          prod = insertedProd;
        }

        await db
          .insert(orderItems)
          .values({
            id: `item-${normalized.id}-${item.productId}`,
            storeId,
            orderId: normalized.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.price,
            unitCogs: item.cogs || Math.round(item.price * 0.3),
          })
          .onConflictDoNothing();
      }

      // 6. Timeline Event
      await db.insert(orderEvents).values({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        storeId,
        orderId: normalized.id,
        eventType: 'order_ingested',
        label: `Order ingested from ${normalized.source}`,
        payload: { externalId: normalized.externalId, total: normalized.totalValue },
      });
    }

    // Mark webhook event processed if present
    if (webhookEventId) {
      await db
        .update(webhookEvents)
        .set({ status: 'processed', processedAt: new Date() })
        .where(eq(webhookEvents.id, webhookEventId));
    }

    // Trigger evaluation
    await enqueueOrderEvaluate({ storeId, orderId: normalized.id, reason: 'ingest_evaluation' });
  } catch (err: any) {
    logger.error({ err, storeId, orderId: normalized.id }, 'Error processing order.ingest');
    if (webhookEventId) {
      await db
        .update(webhookEvents)
        .set({ status: 'failed', error: err?.message || 'Ingest error' })
        .where(eq(webhookEvents.id, webhookEventId));
    }
    throw err;
  }
}

export async function processOrderEvaluate(data: OrderEvaluateJobData): Promise<void> {
  const { storeId, orderId } = data;
  logger.info({ storeId, orderId }, 'Processing order.evaluate');

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));
  if (!order) return;

  const [item] = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.storeId, storeId), eq(orderItems.orderId, orderId)));

  const [product] = item
    ? await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.id, item.productId)))
    : [null];

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.storeId, storeId), eq(customers.id, order.customerId)));

  const [pin] = await db
    .select()
    .from(pincodeStats)
    .where(and(eq(pincodeStats.storeId, storeId), eq(pincodeStats.code, order.pincode)));

  const allCouriers = await db
    .select()
    .from(couriers)
    .where(and(eq(couriers.storeId, storeId), eq(couriers.isActive, true)));

  const activeCourier = allCouriers.find((c) => c.id === order.courierId) || allCouriers[0];

  if (!product || !customer || !pin || !activeCourier) {
    logger.warn({ orderId }, 'Missing product/customer/pin/courier for evaluation');
    return;
  }

  const engineProduct = { ...product, damageRate: Number(product.damageRate) };
  const enginePin = { ...pin, rtoRate: Number(pin.rtoRate), success: Number(pin.successRate) };
  const engineCourier = {
    id: activeCourier.id,
    name: activeCourier.name,
    success: Number(activeCourier.successRate),
    forward: activeCourier.forwardCost,
    reverse: activeCourier.reverseCost,
  };
  const availableEngineCouriers = allCouriers.map((c) => ({
    id: c.id,
    name: c.name,
    success: Number(c.successRate),
    forward: c.forwardCost,
    reverse: c.reverseCost,
  }));

  const orderEnginePayload = {
    id: order.id,
    productId: product.id,
    customerId: customer.id,
    courierId: activeCourier.id,
    pincode: pin.code,
    qty: item?.quantity || 1,
    value: order.totalValue,
    payment: order.paymentMethod as any,
    address: order.address,
    addressComplete: order.addressComplete,
    addressVerified: order.addressVerified,
    otpPassed: order.otpPassed,
    campaign: order.campaign,
    status: order.status,
    journey: order.journey,
    score: order.score,
    created: order.createdAt.toISOString().slice(0, 10),
    advancePaid: order.advancePaid,
    timeline: [],
  };

  const evaluation = evaluate(
    orderEnginePayload,
    engineProduct,
    enginePin,
    engineCourier,
    { orders: customer.ordersCount, rtos: customer.rtosCount, prepaid: customer.prepaidCount },
    DEFAULT_ENGINE_CONFIG,
    availableEngineCouriers,
  );

  // Update order with new score & journey
  await db
    .update(orders)
    .set({
      score: evaluation.score,
      pRto: evaluation.pRto.toString(),
      journey: evaluation.best.name,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));

  // Persist decision snapshot
  const decisionId = `dec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await db.insert(decisions).values({
    id: decisionId,
    storeId,
    orderId,
    inputsSnapshot: {
      order: orderEnginePayload,
      product: engineProduct,
      pin: enginePin,
      courier: engineCourier,
    },
    score: evaluation.score,
    factorBreakdown: evaluation.factors,
    chosenJourney: evaluation.best.name,
    journeyEvaluations: evaluation.journeys,
    recommendedCourier: evaluation.courierRecommendation?.recommendedCourierId || activeCourier.id,
    courierComparison: evaluation.courierRecommendation?.comparison || [],
    explanation: evaluation.explanation,
    policyVersion: 'v1.0',
  });
}

export async function processShipmentEvent(data: ShipmentEventJobData): Promise<void> {
  const { storeId, orderId, courierId, event, statusLabel, ndrReason, webhookEventId } = data;
  logger.info({ storeId, orderId, event, statusLabel }, 'Processing shipment.event');

  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));
    if (!order) return;

    // 1. Timeline event
    await db.insert(orderEvents).values({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      storeId,
      orderId,
      eventType: event,
      label: statusLabel,
      payload: { courierId, ndrReason, rawPayload: data.rawPayload },
    });

    if (event === 'ndr_raised') {
      await db
        .update(orders)
        .set({ status: 'NDR raised', updatedAt: new Date() })
        .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));

      // Enqueue NDR rescue workflow step (or run immediately if queue disabled)
      const enqueued = await enqueueWorkflowStep({
        storeId,
        orderId,
        step: 'ndr_rescue',
        metadata: { ndrReason, courierId },
      });
      if (!enqueued) {
        await processWorkflowStep({
          storeId,
          orderId,
          step: 'ndr_rescue',
          metadata: { ndrReason, courierId },
        });
      }
    } else if (event === 'rto_initiated' || event === 'rto_received') {
      await db
        .update(orders)
        .set({ status: event === 'rto_received' ? 'RTO received' : 'RTO initiated', updatedAt: new Date() })
        .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));

      const enqueued = await enqueueWorkflowStep({
        storeId,
        orderId,
        step: 'rto_recovery',
        metadata: { courierId, event, reason: ndrReason },
      });
      if (!enqueued) {
        await processWorkflowStep({
          storeId,
          orderId,
          step: 'rto_recovery',
          metadata: { courierId, event, reason: ndrReason },
        });
      }
    } else if (event === 'delivered') {
      await db
        .update(orders)
        .set({ status: 'Delivered', updatedAt: new Date() })
        .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));

      // Resolve open NDR case if exists
      await db
        .update(ndrCases)
        .set({ status: 'resolved', workflowStep: 'RESOLVED', updatedAt: new Date() })
        .where(and(eq(ndrCases.storeId, storeId), eq(ndrCases.orderId, orderId)));
    }

    if (webhookEventId) {
      await db
        .update(webhookEvents)
        .set({ status: 'processed', processedAt: new Date() })
        .where(eq(webhookEvents.id, webhookEventId));
    }

    // Re-score order after lifecycle update
    await enqueueOrderEvaluate({ storeId, orderId, reason: `lifecycle_${event}` });
  } catch (err: any) {
    logger.error({ err, orderId }, 'Error processing shipment.event');
    if (webhookEventId) {
      await db
        .update(webhookEvents)
        .set({ status: 'failed', error: err?.message })
        .where(eq(webhookEvents.id, webhookEventId));
    }
    throw err;
  }
}

export async function processWorkflowStep(data: WorkflowStepJobData): Promise<void> {
  const { storeId, orderId, step, metadata } = data;
  logger.info({ storeId, orderId, step, metadata }, 'Processing workflow.step');

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));
  if (!order) return;

  const phone = order.customerPhone || '+91 9999999999';
  const customerName = order.customerName || 'Valued Customer';

  // -------------------------------------------------------------
  // NDR RESCUE STATE MACHINE
  // -------------------------------------------------------------
  if (step === 'ndr_rescue') {
    const rawReason = metadata?.ndrReason || 'Customer unreachable';
    // Map string to engine NdrReason union
    let ndrReason: NdrReason = 'Customer unreachable';
    const lowerReason = rawReason.toLowerCase();
    if (lowerReason.includes('address') || lowerReason.includes('incorrect') || lowerReason.includes('landmark')) {
      ndrReason = 'Address incorrect';
    } else if (lowerReason.includes('refuse') || lowerReason.includes('intent') || lowerReason.includes('cancel')) {
      ndrReason = 'Refused / low intent';
    } else if (lowerReason.includes('reschedule') || lowerReason.includes('slot') || lowerReason.includes('time')) {
      ndrReason = 'Rescheduled request';
    } else if (lowerReason.includes('delay')) {
      ndrReason = 'Delayed';
    }

    // Calculate expected margin to pass to recommendation engine
    const marginSuccess = Math.round(order.totalValue * 0.35);
    const recommendation = recommendNdrRescue(ndrReason, customerName, marginSuccess);

    // Template selection
    let templateName = 'ndr_reconnect_whatsapp';
    let paymentLinkId: string | undefined;

    if (ndrReason === 'Address incorrect') {
      templateName = 'ndr_address_correction';
    } else if (ndrReason === 'Rescheduled request') {
      templateName = 'ndr_reschedule';
    } else if (ndrReason === 'Refused / low intent') {
      templateName = 'ndr_prepaid_conversion';
      // Create prepaid conversion payment link
      const paymentProvider = getPaymentProvider();
      const paymentResult = await paymentProvider.createPaymentLink({
        storeId,
        orderId,
        amount: Math.max(1, order.totalValue - 50),
        purpose: 'prepaid_conversion',
        customerName,
        customerPhone: phone,
      });
      paymentLinkId = paymentResult.paymentLinkId;
    }

    // Check existing NDR case
    const ndrCaseId = `ndr-${orderId}`;
    const [existingNdr] = await db
      .select()
      .from(ndrCases)
      .where(and(eq(ndrCases.storeId, storeId), eq(ndrCases.orderId, orderId)));

    const attempts = (existingNdr?.attempts || 0) + 1;
    const now = new Date();
    const nextFollowup = new Date(now.getTime() + 4 * 60 * 60 * 1000); // +4h

    if (existingNdr) {
      await db
        .update(ndrCases)
        .set({
          reason: rawReason,
          rescueAction: recommendation.action,
          rescueMessage: recommendation.message,
          includesGoodwill: recommendation.includesGoodwill,
          status: 'open',
          workflowStep: 'AWAITING_CUSTOMER_ACTION',
          attempts,
          lastAttemptAt: now,
          nextAttemptAt: nextFollowup,
          paymentLinkId: paymentLinkId || existingNdr.paymentLinkId,
          updatedAt: now,
        })
        .where(eq(ndrCases.id, existingNdr.id));
    } else {
      await db.insert(ndrCases).values({
        id: ndrCaseId,
        storeId,
        orderId,
        reason: rawReason,
        rescueAction: recommendation.action,
        rescueMessage: recommendation.message,
        includesGoodwill: recommendation.includesGoodwill,
        status: 'open',
        workflowStep: 'AWAITING_CUSTOMER_ACTION',
        attempts,
        lastAttemptAt: now,
        nextAttemptAt: nextFollowup,
        paymentLinkId,
      });
    }

    // Log decision to order_events
    await db.insert(orderEvents).values({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      storeId,
      orderId,
      eventType: 'ndr_action_chosen',
      label: `NDR Rescue: ${recommendation.action}`,
      payload: {
        ndrReason,
        recommendation,
        workflowStep: 'AWAITING_CUSTOMER_ACTION',
        attempts,
        nextAttemptAt: nextFollowup.toISOString(),
      },
    });

    // Enqueue message send
    const messageJobData: MessageSendJobData = {
      storeId,
      orderId,
      channel: 'whatsapp',
      template: templateName,
      recipient: phone,
      variables: {
        customerName,
        orderId,
        actionLink: `https://track.marginpilot.in/address/${orderId}`,
        paymentLink: paymentLinkId ? `https://pay.marginpilot.in/link/${paymentLinkId}` : undefined,
      },
    };

    const enqueuedMsg = await enqueueMessageSend(messageJobData);
    if (!enqueuedMsg) {
      await processMessageSend(messageJobData);
    }

    // Schedule +4h follow-up in background queue
    await enqueueWorkflowStep(
      { storeId, orderId, step: 'ndr_followup', metadata: { attempt: 2 } },
      { delaySeconds: 4 * 3600 }
    );
  }

  // -------------------------------------------------------------
  // NDR FOLLOW-UP REMINDER
  // -------------------------------------------------------------
  else if (step === 'ndr_followup') {
    const [ndrCase] = await db
      .select()
      .from(ndrCases)
      .where(and(eq(ndrCases.storeId, storeId), eq(ndrCases.orderId, orderId)));

    if (!ndrCase || ndrCase.status !== 'open' || ndrCase.workflowStep === 'RESOLVED') {
      logger.info({ orderId }, 'NDR case already resolved or closed; skipping follow-up');
      return;
    }

    const currentAttempts = ndrCase.attempts + 1;
    const now = new Date();

    if (currentAttempts > 3) {
      // Max attempts reached without customer reply -> Escalate to RTO
      logger.info({ orderId, attempts: currentAttempts }, 'Max NDR attempts reached. Escalating to RTO.');
      await enqueueWorkflowStep({ storeId, orderId, step: 'ndr_final_decision' });
      return;
    }

    const nextAttempt = new Date(now.getTime() + 20 * 60 * 60 * 1000); // +24h total
    await db
      .update(ndrCases)
      .set({
        workflowStep: 'FOLLOWUP_SCHEDULED',
        attempts: currentAttempts,
        lastAttemptAt: now,
        nextAttemptAt: nextAttempt,
        updatedAt: now,
      })
      .where(eq(ndrCases.id, ndrCase.id));

    await db.insert(orderEvents).values({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      storeId,
      orderId,
      eventType: 'ndr_followup_sent',
      label: `NDR Follow-up Reminder #${currentAttempts}`,
      payload: { attempts: currentAttempts, nextAttemptAt: nextAttempt.toISOString() },
    });

    const msgJob: MessageSendJobData = {
      storeId,
      orderId,
      channel: 'whatsapp',
      template: 'ndr_followup_reminder',
      recipient: phone,
      variables: { customerName, orderId },
    };
    const enqueuedMsg = await enqueueMessageSend(msgJob);
    if (!enqueuedMsg) {
      await processMessageSend(msgJob);
    }

    // Schedule final decision (+24h)
    await enqueueWorkflowStep(
      { storeId, orderId, step: 'ndr_final_decision', metadata: { attempt: currentAttempts } },
      { delaySeconds: 20 * 3600 }
    );
  }

  // -------------------------------------------------------------
  // NDR FINAL DECISION / TIMEOUT ESCALATION
  // -------------------------------------------------------------
  else if (step === 'ndr_final_decision') {
    const [ndrCase] = await db
      .select()
      .from(ndrCases)
      .where(and(eq(ndrCases.storeId, storeId), eq(ndrCases.orderId, orderId)));

    if (!ndrCase || ndrCase.status !== 'open' || ndrCase.workflowStep === 'RESOLVED') {
      return;
    }

    logger.warn({ orderId }, 'No response from customer by SLA limit. Escalating NDR to RTO initiated.');
    await db
      .update(ndrCases)
      .set({
        status: 'escalated',
        workflowStep: 'ESCALATED_RTO',
        updatedAt: new Date(),
      })
      .where(eq(ndrCases.id, ndrCase.id));

    await db
      .update(orders)
      .set({ status: 'RTO initiated', updatedAt: new Date() })
      .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));

    await db.insert(orderEvents).values({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      storeId,
      orderId,
      eventType: 'ndr_escalated_to_rto',
      label: 'NDR Escalated to RTO (Customer Unresponsive)',
      payload: {
        reason: ndrCase.reason,
        attempts: ndrCase.attempts,
        escalatedAt: new Date().toISOString(),
      },
    });

    // Trigger RTO Recovery state machine
    await processWorkflowStep({
      storeId,
      orderId,
      step: 'rto_recovery',
      metadata: { reason: ndrCase.reason },
    });
  }

  // -------------------------------------------------------------
  // CUSTOMER REPLY ADVANCEMENT
  // -------------------------------------------------------------
  else if (step === 'customer_reply') {
    const replyAction = metadata?.actionType;
    logger.info({ orderId, replyAction }, 'Advancing NDR workflow from customer reply');

    const [ndrCase] = await db
      .select()
      .from(ndrCases)
      .where(and(eq(ndrCases.storeId, storeId), eq(ndrCases.orderId, orderId)));

    if (replyAction === 'CONFIRM') {
      if (ndrCase) {
        await db
          .update(ndrCases)
          .set({
            status: 'resolved',
            workflowStep: 'RESOLVED',
            customerResponse: metadata,
            updatedAt: new Date(),
          })
          .where(eq(ndrCases.id, ndrCase.id));
      }

      await db
        .update(orders)
        .set({ status: 'Out for delivery', updatedAt: new Date() })
        .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));

      await db.insert(orderEvents).values({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        storeId,
        orderId,
        eventType: 'ndr_customer_confirmed',
        label: 'Customer Confirmed Delivery: Reattempt Scheduled',
        payload: { reply: metadata.text, scheduledFor: 'Next delivery run' },
      });
    } else if (replyAction === 'RESCHEDULE') {
      if (ndrCase) {
        await db
          .update(ndrCases)
          .set({
            workflowStep: 'AWAITING_CUSTOMER_ACTION',
            customerResponse: metadata,
            updatedAt: new Date(),
          })
          .where(eq(ndrCases.id, ndrCase.id));
      }

      await db.insert(orderEvents).values({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        storeId,
        orderId,
        eventType: 'ndr_rescheduled_by_customer',
        label: `Delivery Rescheduled: ${metadata.rescheduleSlot || 'Requested Slot'}`,
        payload: { slot: metadata.rescheduleSlot, reply: metadata.text },
      });
    } else if (replyAction === 'ADDRESS_UPDATE') {
      const newAddress = metadata.newAddress || metadata.text;
      if (ndrCase) {
        await db
          .update(ndrCases)
          .set({
            status: 'resolved',
            workflowStep: 'RESOLVED',
            customerResponse: metadata,
            updatedAt: new Date(),
          })
          .where(eq(ndrCases.id, ndrCase.id));
      }

      await db
        .update(orders)
        .set({
          address: newAddress,
          addressVerified: true,
          status: 'Out for delivery',
          updatedAt: new Date(),
        })
        .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));

      await db.insert(orderEvents).values({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        storeId,
        orderId,
        eventType: 'address_corrected',
        label: 'Customer Updated Delivery Address',
        payload: { newAddress, reply: metadata.text },
      });
    }
  }

  // -------------------------------------------------------------
  // RTO RECOVERY WORKFLOW (DURABLE STATE MACHINE)
  // -------------------------------------------------------------
  else if (step === 'rto_recovery') {
    logger.info({ orderId }, 'Executing durable RTO recovery state machine');

    // Retrieve order dependencies for economic evaluation
    const [item] = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.storeId, storeId), eq(orderItems.orderId, orderId)));

    const [product] = item
      ? await db
          .select()
          .from(products)
          .where(and(eq(products.storeId, storeId), eq(products.id, item.productId)))
      : [null];

    const [pin] = await db
      .select()
      .from(pincodeStats)
      .where(and(eq(pincodeStats.storeId, storeId), eq(pincodeStats.code, order.pincode)));

    const allCouriers = await db
      .select()
      .from(couriers)
      .where(and(eq(couriers.storeId, storeId), eq(couriers.isActive, true)));

    const activeCourier = allCouriers.find((c) => c.id === order.courierId) || allCouriers[0];
    const alternateCourier = allCouriers.find((c) => c.id !== order.courierId) || activeCourier;

    const reverseCost = activeCourier ? activeCourier.reverseCost : 90;
    const cogs = item?.unitCogs || (product?.cogs ?? Math.round(order.totalValue * 0.3));
    const marginSuccess = Math.max(0, order.totalValue - cogs - (activeCourier?.forwardCost ?? 80));

    const orderEnginePayload = {
      id: order.id,
      productId: product?.id || 'prod-1',
      customerId: order.customerId,
      qty: item?.quantity || 1,
      value: order.totalValue,
      payment: order.paymentMethod as any,
      address: order.address,
      addressComplete: order.addressComplete,
      addressVerified: order.addressVerified,
      otpPassed: order.otpPassed,
      campaign: order.campaign,
      pincode: order.pincode,
      courierId: order.courierId,
      status: order.status,
      journey: order.journey,
      score: order.score,
      created: order.createdAt.toISOString().slice(0, 10),
      advancePaid: order.advancePaid,
      timeline: [],
    };

    const enginePin = {
      code: pin?.code || order.pincode,
      city: pin?.city || 'Delhi',
      state: pin?.state || 'Delhi',
      rtoRate: pin ? Number(pin.rtoRate) : 0.2,
      success: pin ? Number(pin.successRate) : 0.85,
    };

    const engineCourier = {
      id: activeCourier?.id || 'shiprocket',
      name: activeCourier?.name || 'Shiprocket',
      success: activeCourier ? Number(activeCourier.successRate) : 0.85,
      forward: activeCourier?.forwardCost ?? 80,
      reverse: activeCourier?.reverseCost ?? 90,
    };

    const engineAlternate = {
      id: alternateCourier?.id || 'delhivery',
      name: alternateCourier?.name || 'Delhivery',
      success: alternateCourier ? Number(alternateCourier.successRate) : 0.85,
      forward: alternateCourier?.forwardCost ?? 80,
      reverse: alternateCourier?.reverseCost ?? 90,
    };

    // Rank options using engine
    const rankedActions = rankRecoveryActions(
      orderEnginePayload,
      marginSuccess,
      reverseCost,
      enginePin,
      engineCourier,
      engineAlternate
    );

    const chosenAction = rankedActions[0] || {
      name: 'Restock to nearest warehouse',
      value: Math.round(order.totalValue * 0.4),
      reason: 'Preserve sellable inventory',
    };

    // Root cause classification
    const rawReason = metadata?.reason || 'Customer unreachable';
    let rootCause = 'customer_unreachable';
    if (/fake|not attempted|false/i.test(rawReason)) rootCause = 'fake_attempt';
    else if (/address|pincode|landmark/i.test(rawReason)) rootCause = 'address_issue';
    else if (/refuse|reject|denied/i.test(rawReason)) rootCause = 'refused';

    // Map inventory routing
    let inventoryRoute = 'Return to warehouse';
    if (chosenAction.name.includes('Restock')) inventoryRoute = 'Restock';
    else if (chosenAction.name.includes('Write off')) inventoryRoute = 'Write off';
    else if (chosenAction.name.includes('Reattempt') || chosenAction.name.includes('Alternate'))
      inventoryRoute = 'Restock';

    const rtoCaseId = `rto-${orderId}`;
    const [existingRto] = await db
      .select()
      .from(rtoCases)
      .where(and(eq(rtoCases.storeId, storeId), eq(rtoCases.orderId, orderId)));

    if (existingRto) {
      await db
        .update(rtoCases)
        .set({
          recoveryAction: chosenAction.name,
          inventoryRoute,
          recoveredValue: Math.max(0, chosenAction.value),
          rootCause,
          reasoning: chosenAction.reason,
          optionsEvaluated: rankedActions,
          status: 'in_transit',
          updatedAt: new Date(),
        })
        .where(eq(rtoCases.id, existingRto.id));
    } else {
      await db.insert(rtoCases).values({
        id: rtoCaseId,
        storeId,
        orderId,
        recoveryAction: chosenAction.name,
        inventoryRoute,
        recoveredValue: Math.max(0, chosenAction.value),
        rootCause,
        reasoning: chosenAction.reason,
        optionsEvaluated: rankedActions,
        status: 'in_transit',
      });
    }

    // Persist event timeline
    await db.insert(orderEvents).values({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      storeId,
      orderId,
      eventType: 'rto_recovery_decided',
      label: `RTO Recovery: ${chosenAction.name}`,
      payload: {
        chosenAction,
        rootCause,
        rankedOptions: rankedActions.map((a) => ({ name: a.name, ev: a.value, prob: a.probability })),
        reasoning: chosenAction.reason,
      },
    });

    logger.info(
      { orderId, chosen: chosenAction.name, recoveredValue: chosenAction.value },
      `RTO recovery decision recorded: ${chosenAction.name}`
    );
  }
}

export async function processMessageSend(data: MessageSendJobData): Promise<void> {
  const { storeId, orderId, channel, template, recipient, variables } = data;
  logger.info({ storeId, orderId, channel, template }, 'Processing message.send via provider');

  const provider = getMessageProvider();
  const sendResult = await provider.sendMessage({
    storeId,
    orderId,
    recipient,
    templateName: template,
    variables,
  });

  await db.insert(messages).values({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    storeId,
    orderId,
    channel,
    template,
    content: sendResult.renderedContent,
    status: sendResult.status,
  });

  await db.insert(orderEvents).values({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    storeId,
    orderId,
    eventType: 'message_dispatched',
    label: `Message Sent via [${sendResult.provider.toUpperCase()}]: ${template}`,
    payload: {
      provider: sendResult.provider,
      recipient,
      template,
      messageId: sendResult.messageId,
      content: sendResult.renderedContent,
    },
  });
}

export async function processPaymentReconcile(data: PaymentReconcileJobData): Promise<void> {
  const { storeId, orderId, amount, paymentId, method } = data;
  logger.info({ storeId, orderId, amount, method }, 'Processing payment.reconcile');

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));
  if (!order) return;

  const isFull = amount >= order.totalValue || method === 'Prepaid';

  await db.insert(payments).values({
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    storeId,
    orderId,
    amount,
    type: isFull ? 'full' : 'advance',
    status: 'completed',
    gateway: 'razorpay',
    transactionId: paymentId || `pay_ext_${Date.now()}`,
  });

  await db
    .update(orders)
    .set({
      advancePaid: true,
      paymentMethod: isFull ? 'Prepaid' : 'Partial COD',
      updatedAt: new Date(),
    })
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));

  await db.insert(orderEvents).values({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    storeId,
    orderId,
    eventType: 'payment_received',
    label: `Payment Reconciled: ₹${amount} (${isFull ? 'Full Prepaid' : 'Partial COD Advance'})`,
    payload: { amount, paymentId, method, isFull },
  });

  // Re-score order with advance payment verified
  await enqueueOrderEvaluate({ storeId, orderId, reason: 'payment_reconciled' });
}
