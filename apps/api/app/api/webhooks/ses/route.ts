/**
 * AWS SES Webhook Handler
 *
 * Receives SNS notifications from AWS SES for email tracking events.
 * Events include: send, delivery, bounce, complaint, open, click, etc.
 *
 * Setup Requirements:
 * 1. Create an SNS topic in AWS
 * 2. Configure SES to publish events to the SNS topic
 * 3. Subscribe this endpoint to the SNS topic (HTTPS endpoint)
 * 4. Confirm the subscription when AWS sends the confirmation request
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  db,
  emailTrackingEvents,
  communicationEvents,
  emailUnsubscribes,
  emailSuppressionList,
  generateEmailHash,
  eq,
} from '@glapi/database';
import type {
  NewEmailTrackingEvent,
  EmailTrackingEventType,
  EmailBounceType,
} from '@glapi/database';

// ============================================================================
// SNS Message Types
// ============================================================================

interface SNSMessage {
  Type: 'SubscriptionConfirmation' | 'Notification' | 'UnsubscribeConfirmation';
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  Token?: string;
}

interface SESNotification {
  notificationType: 'Bounce' | 'Complaint' | 'Delivery' | 'Send' | 'Reject' | 'Open' | 'Click' | 'Rendering Failure' | 'DeliveryDelay';
  mail: SESMailObject;
  bounce?: SESBounceObject;
  complaint?: SESComplaintObject;
  delivery?: SESDeliveryObject;
  send?: SESSendObject;
  reject?: SESRejectObject;
  open?: SESOpenObject;
  click?: SESClickObject;
  failure?: SESFailureObject;
  deliveryDelay?: SESDeliveryDelayObject;
}

interface SESMailObject {
  timestamp: string;
  messageId: string;
  source: string;
  sourceArn?: string;
  sendingAccountId?: string;
  destination: string[];
  headersTruncated?: boolean;
  headers?: Array<{ name: string; value: string }>;
  commonHeaders?: {
    from?: string[];
    to?: string[];
    messageId?: string;
    subject?: string;
  };
  tags?: Record<string, string[]>;
}

interface SESBounceObject {
  bounceType: 'Undetermined' | 'Permanent' | 'Transient';
  bounceSubType: string;
  bouncedRecipients: Array<{
    emailAddress: string;
    action?: string;
    status?: string;
    diagnosticCode?: string;
  }>;
  timestamp: string;
  feedbackId: string;
  reportingMTA?: string;
}

interface SESComplaintObject {
  complainedRecipients: Array<{ emailAddress: string }>;
  timestamp: string;
  feedbackId: string;
  complaintSubType?: string;
  complaintFeedbackType?: string;
  userAgent?: string;
}

interface SESDeliveryObject {
  timestamp: string;
  processingTimeMillis: number;
  recipients: string[];
  smtpResponse?: string;
  reportingMTA?: string;
}

interface SESSendObject {
  timestamp?: string;
}

interface SESRejectObject {
  reason: string;
}

interface SESOpenObject {
  timestamp: string;
  userAgent: string;
  ipAddress: string;
}

interface SESClickObject {
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  link: string;
  linkTags?: Record<string, string[]>;
}

interface SESFailureObject {
  errorMessage: string;
  templateName?: string;
}

interface SESDeliveryDelayObject {
  timestamp: string;
  delayType: string;
  expirationTime?: string;
  delayedRecipients?: Array<{
    emailAddress: string;
    status?: string;
    diagnosticCode?: string;
  }>;
}

// ============================================================================
// Webhook Handler
// ============================================================================

export async function POST(req: Request) {
  try {
    const body = await req.text();
    let message: SNSMessage;

    // Parse the SNS message
    try {
      message = JSON.parse(body) as SNSMessage;
    } catch {
      console.error('Failed to parse SNS message:', body);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Handle different SNS message types
    switch (message.Type) {
      case 'SubscriptionConfirmation':
        return handleSubscriptionConfirmation(message);

      case 'UnsubscribeConfirmation':
        console.log('Received unsubscribe confirmation:', message.MessageId);
        return NextResponse.json({ received: true, type: 'unsubscribe' });

      case 'Notification':
        return handleNotification(message);

      default:
        console.warn('Unknown SNS message type:', (message as SNSMessage).Type);
        return NextResponse.json({ received: true, type: 'unknown' });
    }
  } catch (error) {
    console.error('SES webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Handler Functions
// ============================================================================

async function handleSubscriptionConfirmation(message: SNSMessage): Promise<Response> {
  // In production, you should verify the signature and confirm the subscription
  // by visiting the SubscribeURL
  console.log('Received SNS subscription confirmation request');
  console.log('SubscribeURL:', message.SubscribeURL);
  console.log('TopicArn:', message.TopicArn);

  // Auto-confirm the subscription (in production, verify signature first)
  if (message.SubscribeURL) {
    try {
      const response = await fetch(message.SubscribeURL);
      if (response.ok) {
        console.log('Successfully confirmed SNS subscription');
        return NextResponse.json({ received: true, confirmed: true });
      }
    } catch (error) {
      console.error('Failed to confirm SNS subscription:', error);
    }
  }

  return NextResponse.json({ received: true, type: 'subscription_confirmation' });
}

async function handleNotification(message: SNSMessage): Promise<Response> {
  // Parse the SES notification from the SNS message
  let notification: SESNotification;
  try {
    notification = JSON.parse(message.Message) as SESNotification;
  } catch {
    console.error('Failed to parse SES notification:', message.Message);
    return NextResponse.json({ error: 'Invalid SES notification' }, { status: 400 });
  }

  const sesMessageId = notification.mail.messageId;
  console.log(`Processing SES ${notification.notificationType} for message ${sesMessageId}`);

  // Find the communication event by SES message ID
  const communicationEvent = await db.query.communicationEvents.findFirst({
    where: eq(communicationEvents.sesMessageId, sesMessageId),
  });

  // Determine organization ID (from communication event or default)
  const organizationId = communicationEvent?.organizationId;

  if (!organizationId) {
    console.warn(`No organization found for SES message ${sesMessageId}, skipping tracking`);
    return NextResponse.json({ received: true, skipped: 'no_organization' });
  }

  // Process based on notification type
  switch (notification.notificationType) {
    case 'Send':
      await handleSendEvent(notification, organizationId, communicationEvent?.id);
      break;

    case 'Delivery':
      await handleDeliveryEvent(notification, organizationId, communicationEvent?.id);
      break;

    case 'Bounce':
      await handleBounceEvent(notification, organizationId, communicationEvent?.id);
      break;

    case 'Complaint':
      await handleComplaintEvent(notification, organizationId, communicationEvent?.id);
      break;

    case 'Open':
      await handleOpenEvent(notification, organizationId, communicationEvent?.id);
      break;

    case 'Click':
      await handleClickEvent(notification, organizationId, communicationEvent?.id);
      break;

    case 'Reject':
      await handleRejectEvent(notification, organizationId, communicationEvent?.id);
      break;

    case 'Rendering Failure':
      await handleRenderingFailureEvent(notification, organizationId, communicationEvent?.id);
      break;

    case 'DeliveryDelay':
      await handleDeliveryDelayEvent(notification, organizationId, communicationEvent?.id);
      break;

    default:
      console.warn(`Unknown SES notification type: ${notification.notificationType}`);
  }

  return NextResponse.json({ received: true, type: notification.notificationType });
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handleSendEvent(
  notification: SESNotification,
  organizationId: string,
  communicationEventId?: string
): Promise<void> {
  const trackingEvent = await createTrackingEvent({
    organizationId,
    communicationEventId,
    eventType: 'send',
    occurredAt: new Date(notification.send?.timestamp ?? notification.mail.timestamp),
    sesMessageId: notification.mail.messageId,
    rawPayload: notification as unknown as Record<string, unknown>,
  });

  // Update communication event status
  if (communicationEventId) {
    await db
      .update(communicationEvents)
      .set({
        status: 'sent',
        sentAt: new Date(notification.send?.timestamp ?? notification.mail.timestamp),
        updatedAt: new Date(),
      })
      .where(eq(communicationEvents.id, communicationEventId));
  }
}

async function handleDeliveryEvent(
  notification: SESNotification,
  organizationId: string,
  communicationEventId?: string
): Promise<void> {
  await createTrackingEvent({
    organizationId,
    communicationEventId,
    eventType: 'delivery',
    occurredAt: new Date(notification.delivery!.timestamp),
    sesMessageId: notification.mail.messageId,
    rawPayload: notification as unknown as Record<string, unknown>,
  });

  // Update communication event status
  if (communicationEventId) {
    await db
      .update(communicationEvents)
      .set({
        status: 'delivered',
        deliveredAt: new Date(notification.delivery!.timestamp),
        updatedAt: new Date(),
      })
      .where(eq(communicationEvents.id, communicationEventId));
  }
}

async function handleBounceEvent(
  notification: SESNotification,
  organizationId: string,
  communicationEventId?: string
): Promise<void> {
  const bounce = notification.bounce!;

  // Map SES bounce type to our enum
  const bounceTypeMap: Record<string, EmailBounceType> = {
    Permanent: 'permanent',
    Transient: 'transient',
    Undetermined: 'undetermined',
  };

  const trackingEvent = await createTrackingEvent({
    organizationId,
    communicationEventId,
    eventType: 'bounce',
    occurredAt: new Date(bounce.timestamp),
    sesMessageId: notification.mail.messageId,
    sesFeedbackId: bounce.feedbackId,
    bounceType: bounceTypeMap[bounce.bounceType] ?? 'undetermined',
    bounceSubType: bounce.bounceSubType,
    bouncedRecipients: bounce.bouncedRecipients,
    diagnosticCode: bounce.bouncedRecipients[0]?.diagnosticCode,
    rawPayload: notification as unknown as Record<string, unknown>,
  });

  // Update communication event status
  if (communicationEventId) {
    await db
      .update(communicationEvents)
      .set({
        status: 'bounced',
        bouncedAt: new Date(bounce.timestamp),
        errorCode: `bounce_${bounce.bounceType.toLowerCase()}`,
        errorMessage: bounce.bouncedRecipients[0]?.diagnosticCode,
        updatedAt: new Date(),
      })
      .where(eq(communicationEvents.id, communicationEventId));
  }

  // For permanent bounces, add to suppression list and create unsubscribe
  if (bounce.bounceType === 'Permanent') {
    for (const recipient of bounce.bouncedRecipients) {
      await addToSuppressionList(
        organizationId,
        recipient.emailAddress,
        'hard_bounce',
        'ses_bounce',
        communicationEventId,
        trackingEvent.id
      );
    }
  }
}

async function handleComplaintEvent(
  notification: SESNotification,
  organizationId: string,
  communicationEventId?: string
): Promise<void> {
  const complaint = notification.complaint!;

  const trackingEvent = await createTrackingEvent({
    organizationId,
    communicationEventId,
    eventType: 'complaint',
    occurredAt: new Date(complaint.timestamp),
    sesMessageId: notification.mail.messageId,
    sesFeedbackId: complaint.feedbackId,
    complaintFeedbackType: complaint.complaintFeedbackType,
    complainedRecipients: complaint.complainedRecipients.map((r) => r.emailAddress),
    userAgent: complaint.userAgent,
    rawPayload: notification as unknown as Record<string, unknown>,
  });

  // Update communication event status
  if (communicationEventId) {
    await db
      .update(communicationEvents)
      .set({
        status: 'complained',
        updatedAt: new Date(),
      })
      .where(eq(communicationEvents.id, communicationEventId));
  }

  // Add complained recipients to suppression list
  for (const recipient of complaint.complainedRecipients) {
    await addToSuppressionList(
      organizationId,
      recipient.emailAddress,
      'complaint',
      'ses_complaint',
      communicationEventId,
      trackingEvent.id
    );
  }
}

async function handleOpenEvent(
  notification: SESNotification,
  organizationId: string,
  communicationEventId?: string
): Promise<void> {
  const open = notification.open!;

  await createTrackingEvent({
    organizationId,
    communicationEventId,
    eventType: 'open',
    occurredAt: new Date(open.timestamp),
    sesMessageId: notification.mail.messageId,
    userAgent: open.userAgent,
    ipAddress: open.ipAddress,
    rawPayload: notification as unknown as Record<string, unknown>,
  });

  // Update communication event status (only if not already clicked)
  if (communicationEventId) {
    const currentEvent = await db.query.communicationEvents.findFirst({
      where: eq(communicationEvents.id, communicationEventId),
    });

    if (currentEvent && currentEvent.status !== 'clicked') {
      await db
        .update(communicationEvents)
        .set({
          status: 'opened',
          openedAt: currentEvent.openedAt ?? new Date(open.timestamp),
          updatedAt: new Date(),
        })
        .where(eq(communicationEvents.id, communicationEventId));
    }
  }
}

async function handleClickEvent(
  notification: SESNotification,
  organizationId: string,
  communicationEventId?: string
): Promise<void> {
  const click = notification.click!;

  await createTrackingEvent({
    organizationId,
    communicationEventId,
    eventType: 'click',
    occurredAt: new Date(click.timestamp),
    sesMessageId: notification.mail.messageId,
    clickedUrl: click.link,
    linkTags: click.linkTags
      ? Object.fromEntries(
          Object.entries(click.linkTags).map(([k, v]) => [k, v[0]])
        )
      : undefined,
    userAgent: click.userAgent,
    ipAddress: click.ipAddress,
    rawPayload: notification as unknown as Record<string, unknown>,
  });

  // Update communication event status
  if (communicationEventId) {
    await db
      .update(communicationEvents)
      .set({
        status: 'clicked',
        clickedAt: new Date(click.timestamp),
        updatedAt: new Date(),
      })
      .where(eq(communicationEvents.id, communicationEventId));
  }
}

async function handleRejectEvent(
  notification: SESNotification,
  organizationId: string,
  communicationEventId?: string
): Promise<void> {
  await createTrackingEvent({
    organizationId,
    communicationEventId,
    eventType: 'reject',
    occurredAt: new Date(notification.mail.timestamp),
    sesMessageId: notification.mail.messageId,
    diagnosticCode: notification.reject?.reason,
    rawPayload: notification as unknown as Record<string, unknown>,
  });

  // Update communication event status
  if (communicationEventId) {
    await db
      .update(communicationEvents)
      .set({
        status: 'failed',
        failedAt: new Date(),
        errorCode: 'ses_reject',
        errorMessage: notification.reject?.reason,
        updatedAt: new Date(),
      })
      .where(eq(communicationEvents.id, communicationEventId));
  }
}

async function handleRenderingFailureEvent(
  notification: SESNotification,
  organizationId: string,
  communicationEventId?: string
): Promise<void> {
  await createTrackingEvent({
    organizationId,
    communicationEventId,
    eventType: 'rendering_failure',
    occurredAt: new Date(notification.mail.timestamp),
    sesMessageId: notification.mail.messageId,
    diagnosticCode: notification.failure?.errorMessage,
    rawPayload: notification as unknown as Record<string, unknown>,
  });

  // Update communication event status
  if (communicationEventId) {
    await db
      .update(communicationEvents)
      .set({
        status: 'failed',
        failedAt: new Date(),
        errorCode: 'rendering_failure',
        errorMessage: notification.failure?.errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(communicationEvents.id, communicationEventId));
  }
}

async function handleDeliveryDelayEvent(
  notification: SESNotification,
  organizationId: string,
  communicationEventId?: string
): Promise<void> {
  const delay = notification.deliveryDelay!;

  await createTrackingEvent({
    organizationId,
    communicationEventId,
    eventType: 'delivery_delay',
    occurredAt: new Date(delay.timestamp),
    sesMessageId: notification.mail.messageId,
    bounceSubType: delay.delayType,
    bouncedRecipients: delay.delayedRecipients,
    rawPayload: notification as unknown as Record<string, unknown>,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

async function createTrackingEvent(data: {
  organizationId: string;
  communicationEventId?: string;
  eventType: EmailTrackingEventType;
  occurredAt: Date;
  sesMessageId: string;
  sesNotificationId?: string;
  sesFeedbackId?: string;
  bounceType?: EmailBounceType;
  bounceSubType?: string;
  bouncedRecipients?: Array<{
    emailAddress: string;
    action?: string;
    status?: string;
    diagnosticCode?: string;
  }>;
  diagnosticCode?: string;
  complaintFeedbackType?: string;
  complainedRecipients?: string[];
  clickedUrl?: string;
  linkTags?: Record<string, string>;
  userAgent?: string;
  ipAddress?: string;
  rawPayload?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const [trackingEvent] = await db
    .insert(emailTrackingEvents)
    .values({
      organizationId: data.organizationId,
      communicationEventId: data.communicationEventId,
      eventType: data.eventType,
      occurredAt: data.occurredAt,
      sesMessageId: data.sesMessageId,
      sesNotificationId: data.sesNotificationId,
      sesFeedbackId: data.sesFeedbackId,
      bounceType: data.bounceType,
      bounceSubType: data.bounceSubType,
      bouncedRecipients: data.bouncedRecipients,
      diagnosticCode: data.diagnosticCode,
      complaintFeedbackType: data.complaintFeedbackType,
      complainedRecipients: data.complainedRecipients,
      clickedUrl: data.clickedUrl,
      linkTags: data.linkTags,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      rawPayload: data.rawPayload,
    })
    .returning({ id: emailTrackingEvents.id });

  return trackingEvent;
}

async function addToSuppressionList(
  organizationId: string,
  email: string,
  reason: 'hard_bounce' | 'complaint',
  source: string,
  communicationEventId?: string,
  trackingEventId?: string
): Promise<void> {
  const emailHash = generateEmailHash(email);

  // Add to suppression list (permanent for bounces and complaints)
  try {
    await db
      .insert(emailSuppressionList)
      .values({
        organizationId,
        email: email.toLowerCase(),
        emailHash,
        reason,
        source,
        isPermanent: true,
      })
      .onConflictDoNothing();
  } catch (error) {
    // Ignore duplicate key errors
    console.log(`Email ${email} already in suppression list`);
  }

  // Create unsubscribe record
  try {
    await db
      .insert(emailUnsubscribes)
      .values({
        organizationId,
        email: email.toLowerCase(),
        emailHash,
        reason,
        isActive: true,
        sourceCommunicationEventId: communicationEventId,
        sourceTrackingEventId: trackingEventId,
      })
      .onConflictDoNothing();
  } catch (error) {
    // Ignore duplicate key errors
    console.log(`Unsubscribe record for ${email} already exists`);
  }
}

// ============================================================================
// GET Handler for Health Check
// ============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'SES Webhook',
    description: 'Receives SNS notifications from AWS SES for email tracking',
  });
}
