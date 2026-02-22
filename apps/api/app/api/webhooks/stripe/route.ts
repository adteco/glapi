import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  ExternalEventReceiptRepository,
  InvoiceRepository,
  PaymentRepository,
} from '@glapi/database';
import { getStripeClient } from '../../billing/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STRIPE_PROVIDER = 'stripe';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

type StripePaymentMethod =
  | 'credit_card'
  | 'debit_card'
  | 'ach'
  | 'wire'
  | 'check'
  | 'cash'
  | 'other';

type EventResolution = {
  invoice: Awaited<ReturnType<InvoiceRepository['findByIdWithDetails']>>;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  invoiceIdHint?: string;
};

type EventProcessResult = {
  status: 'processed' | 'ignored';
  organizationId?: string | null;
  invoiceId?: string | null;
  details: Record<string, unknown>;
};

function minorToDecimalString(amountMinor: number | null | undefined): string {
  const normalized = typeof amountMinor === 'number' ? amountMinor : 0;
  return (normalized / 100).toFixed(2);
}

function mapStripePaymentMethod(paymentMethodType?: string | null): StripePaymentMethod {
  if (!paymentMethodType) {
    return 'other';
  }

  if (paymentMethodType === 'card') {
    return 'credit_card';
  }

  if (paymentMethodType === 'us_bank_account' || paymentMethodType === 'link') {
    return 'ach';
  }

  return 'other';
}

async function resolveInvoiceForStripeEvent(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository
): Promise<EventResolution> {
  const object = event.data.object as Record<string, unknown>;

  if (event.type.startsWith('checkout.session.')) {
    const session = object as Stripe.Checkout.Session;
    const metadataInvoiceId = session.metadata?.invoiceId || session.client_reference_id || undefined;
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : undefined;

    const bySession = await invoiceRepo.findByStripeCheckoutSessionId(session.id);
    if (bySession) {
      return { invoice: bySession, checkoutSessionId: session.id, paymentIntentId, invoiceIdHint: metadataInvoiceId };
    }

    if (paymentIntentId) {
      const byIntent = await invoiceRepo.findByStripePaymentIntentId(paymentIntentId);
      if (byIntent) {
        return { invoice: byIntent, checkoutSessionId: session.id, paymentIntentId, invoiceIdHint: metadataInvoiceId };
      }
    }

    if (metadataInvoiceId) {
      const byId = await invoiceRepo.findByIdWithDetails(metadataInvoiceId);
      if (byId) {
        return { invoice: byId, checkoutSessionId: session.id, paymentIntentId, invoiceIdHint: metadataInvoiceId };
      }
    }

    return { invoice: null, checkoutSessionId: session.id, paymentIntentId, invoiceIdHint: metadataInvoiceId };
  }

  if (event.type.startsWith('payment_intent.')) {
    const intent = object as Stripe.PaymentIntent;
    const metadataInvoiceId = intent.metadata?.invoiceId || undefined;

    const byIntent = await invoiceRepo.findByStripePaymentIntentId(intent.id);
    if (byIntent) {
      return { invoice: byIntent, paymentIntentId: intent.id, invoiceIdHint: metadataInvoiceId };
    }

    if (metadataInvoiceId) {
      const byId = await invoiceRepo.findByIdWithDetails(metadataInvoiceId);
      if (byId) {
        return { invoice: byId, paymentIntentId: intent.id, invoiceIdHint: metadataInvoiceId };
      }
    }

    return { invoice: null, paymentIntentId: intent.id, invoiceIdHint: metadataInvoiceId };
  }

  return { invoice: null };
}

async function updateInvoiceWebhookMetadata(
  invoiceRepo: InvoiceRepository,
  invoiceId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const current = await invoiceRepo.findById(invoiceId);
  const currentMetadata = (current?.metadata as Record<string, unknown> | null) ?? {};

  await invoiceRepo.update(invoiceId, {
    metadata: {
      ...currentMetadata,
      stripeWebhook: {
        ...(currentMetadata.stripeWebhook as Record<string, unknown> | undefined),
        ...payload,
      },
    },
  });
}

async function reconcileSuccessfulPayment(
  event: Stripe.Event,
  resolution: EventResolution,
  paymentRepo: PaymentRepository,
  invoiceRepo: InvoiceRepository,
  input: {
    amountMinor?: number | null;
    paymentMethodType?: string | null;
  }
): Promise<EventProcessResult> {
  const invoice = resolution.invoice;
  if (!invoice) {
    return {
      status: 'ignored',
      details: { reason: 'invoice_not_found', eventType: event.type },
    };
  }

  const transactionReference =
    resolution.paymentIntentId || resolution.checkoutSessionId || `stripe-event:${event.id}`;

  const existing = await paymentRepo.findByTransactionReference(
    invoice.organizationId,
    transactionReference
  );
  if (existing?.status === 'completed') {
    return {
      status: 'processed',
      organizationId: invoice.organizationId,
      invoiceId: invoice.id,
      details: {
        deduped: true,
        paymentId: existing.id,
        transactionReference,
      },
    };
  }

  const paymentAmount =
    typeof input.amountMinor === 'number' && input.amountMinor > 0
      ? minorToDecimalString(input.amountMinor)
      : invoice.balanceDue && parseFloat(invoice.balanceDue) > 0
        ? invoice.balanceDue
        : invoice.totalAmount;

  const paymentMetadata: Record<string, unknown> = {
    source: 'stripe_webhook',
    stripe: {
      eventId: event.id,
      eventType: event.type,
      checkoutSessionId: resolution.checkoutSessionId ?? null,
      paymentIntentId: resolution.paymentIntentId ?? null,
    },
  };

  if (!existing) {
    await paymentRepo.createPayment({
      organizationId: invoice.organizationId,
      invoiceId: invoice.id,
      paymentDate: new Date().toISOString().split('T')[0],
      amount: paymentAmount,
      paymentMethod: mapStripePaymentMethod(input.paymentMethodType),
      transactionReference,
      status: 'completed',
      metadata: paymentMetadata,
    });
  } else {
    await paymentRepo.update(existing.id, {
      status: 'completed',
      paymentMethod: mapStripePaymentMethod(input.paymentMethodType),
      metadata: {
        ...(existing.metadata as Record<string, unknown> | null),
        ...paymentMetadata,
      },
    });
  }

  await updateInvoiceWebhookMetadata(invoiceRepo, invoice.id, {
    lastEventId: event.id,
    lastEventType: event.type,
    lastEventAt: new Date().toISOString(),
    paymentState: 'succeeded',
    transactionReference,
  });

  return {
    status: 'processed',
    organizationId: invoice.organizationId,
    invoiceId: invoice.id,
    details: { transactionReference, paymentAmount },
  };
}

async function reconcileFailedPayment(
  event: Stripe.Event,
  resolution: EventResolution,
  paymentRepo: PaymentRepository,
  invoiceRepo: InvoiceRepository,
  input: {
    amountMinor?: number | null;
    paymentMethodType?: string | null;
    error?: string | null;
  }
): Promise<EventProcessResult> {
  const invoice = resolution.invoice;
  if (!invoice) {
    return {
      status: 'ignored',
      details: { reason: 'invoice_not_found', eventType: event.type },
    };
  }

  const transactionReference =
    resolution.paymentIntentId || resolution.checkoutSessionId || `stripe-event:${event.id}`;

  const paymentAmount =
    typeof input.amountMinor === 'number' && input.amountMinor > 0
      ? minorToDecimalString(input.amountMinor)
      : invoice.balanceDue && parseFloat(invoice.balanceDue) > 0
        ? invoice.balanceDue
        : invoice.totalAmount;

  const existing = await paymentRepo.findByTransactionReference(
    invoice.organizationId,
    transactionReference
  );
  if (existing) {
    await paymentRepo.update(existing.id, {
      status: 'failed',
      paymentMethod: mapStripePaymentMethod(input.paymentMethodType),
      metadata: {
        ...(existing.metadata as Record<string, unknown> | null),
        source: 'stripe_webhook',
        stripe: {
          eventId: event.id,
          eventType: event.type,
          checkoutSessionId: resolution.checkoutSessionId ?? null,
          paymentIntentId: resolution.paymentIntentId ?? null,
          failureReason: input.error ?? null,
        },
      },
    });
  } else {
    await paymentRepo.createPayment({
      organizationId: invoice.organizationId,
      invoiceId: invoice.id,
      paymentDate: new Date().toISOString().split('T')[0],
      amount: paymentAmount,
      paymentMethod: mapStripePaymentMethod(input.paymentMethodType),
      transactionReference,
      status: 'failed',
      metadata: {
        source: 'stripe_webhook',
        stripe: {
          eventId: event.id,
          eventType: event.type,
          checkoutSessionId: resolution.checkoutSessionId ?? null,
          paymentIntentId: resolution.paymentIntentId ?? null,
          failureReason: input.error ?? null,
        },
      },
    });
  }

  await updateInvoiceWebhookMetadata(invoiceRepo, invoice.id, {
    lastEventId: event.id,
    lastEventType: event.type,
    lastEventAt: new Date().toISOString(),
    paymentState: 'failed',
    failureReason: input.error ?? null,
    transactionReference,
  });

  return {
    status: 'processed',
    organizationId: invoice.organizationId,
    invoiceId: invoice.id,
    details: { transactionReference, paymentAmount, error: input.error ?? null },
  };
}

async function processStripeEvent(
  event: Stripe.Event,
  invoiceRepo: InvoiceRepository,
  paymentRepo: PaymentRepository
): Promise<EventProcessResult> {
  const resolution = await resolveInvoiceForStripeEvent(event, invoiceRepo);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') {
      return {
        status: 'ignored',
        organizationId: resolution.invoice?.organizationId ?? undefined,
        invoiceId: resolution.invoice?.id ?? undefined,
        details: {
          reason: 'checkout_session_not_paid',
          paymentStatus: session.payment_status,
        },
      };
    }

    return await reconcileSuccessfulPayment(event, resolution, paymentRepo, invoiceRepo, {
      amountMinor: session.amount_total,
      paymentMethodType: session.payment_method_types?.[0],
    });
  }

  if (event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    return await reconcileSuccessfulPayment(event, resolution, paymentRepo, invoiceRepo, {
      amountMinor: session.amount_total,
      paymentMethodType: session.payment_method_types?.[0],
    });
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session;
    return await reconcileFailedPayment(event, resolution, paymentRepo, invoiceRepo, {
      amountMinor: session.amount_total,
      paymentMethodType: session.payment_method_types?.[0],
      error: 'async_payment_failed',
    });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    return await reconcileSuccessfulPayment(event, resolution, paymentRepo, invoiceRepo, {
      amountMinor: intent.amount_received || intent.amount,
      paymentMethodType: intent.payment_method_types?.[0],
    });
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const failureMessage =
      intent.last_payment_error?.message ||
      intent.last_payment_error?.decline_code ||
      'payment_intent_failed';

    return await reconcileFailedPayment(event, resolution, paymentRepo, invoiceRepo, {
      amountMinor: intent.amount,
      paymentMethodType: intent.payment_method_types?.[0],
      error: failureMessage,
    });
  }

  return {
    status: 'ignored',
    details: {
      reason: 'event_type_not_handled',
      eventType: event.type,
    },
  };
}

export async function POST(req: Request) {
  const receiptRepo = new ExternalEventReceiptRepository();
  const invoiceRepo = new InvoiceRepository();
  const paymentRepo = new PaymentRepository();

  let receiptId: string | null = null;

  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return NextResponse.json({ message: 'Webhook secret not configured' }, { status: 500 });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ message: 'Missing Stripe signature' }, { status: 400 });
    }

    const rawBody = await req.text();
    const stripe = getStripeClient();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error('Stripe webhook signature verification failed:', error);
      return NextResponse.json({ message: 'Invalid Stripe signature' }, { status: 400 });
    }

    const eventPayload = event as unknown as Record<string, unknown>;
    const { receipt, created } = await receiptRepo.createOrGet({
      provider: STRIPE_PROVIDER,
      externalEventId: event.id,
      organizationId: null,
      eventType: event.type,
      livemode: event.livemode,
      signatureVerified: true,
      processingStatus: 'received',
      payload: eventPayload,
      metadata: {
        source: 'stripe_webhook',
      },
    });
    receiptId = receipt.id;

    if (!created && (receipt.processingStatus === 'processed' || receipt.processingStatus === 'ignored')) {
      return NextResponse.json({
        received: true,
        duplicate: true,
        eventId: event.id,
        status: receipt.processingStatus,
      });
    }

    const result = await processStripeEvent(event, invoiceRepo, paymentRepo);

    await receiptRepo.updateProcessingResult(receipt.id, {
      processingStatus: result.status,
      organizationId: result.organizationId ?? null,
      processingError: null,
      metadata: {
        ...(receipt.metadata as Record<string, unknown> | null),
        processing: result.details,
      },
    });

    return NextResponse.json({
      received: true,
      eventId: event.id,
      status: result.status,
      result: result.details,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook processing error';

    if (receiptId) {
      try {
        await receiptRepo.updateProcessingResult(receiptId, {
          processingStatus: 'failed',
          processingError: message,
          metadata: { source: 'stripe_webhook' },
        });
      } catch (updateError) {
        console.error('Failed to persist webhook failure status:', updateError);
      }
    }

    console.error('Stripe webhook processing failed:', error);
    return NextResponse.json({ message: 'Webhook processing failed' }, { status: 500 });
  }
}
