import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { transactionService } from '@/lib/s3p/transaction.service';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PRICES, BILLING_DISCOUNTS } from '@/lib/s3p/config';

async function updateUserSubscription(userId: number, planId: string, durationMonths: number) {
  const planKey = planId.toUpperCase() as keyof typeof SUBSCRIPTION_PRICES;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) throw new Error('User not found for subscription update.');

  const now = new Date();
  const currentExpiry = user.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now;
  const newExpiry = new Date(currentExpiry);
  newExpiry.setMonth(newExpiry.getMonth() + durationMonths);

  const bonusDays = BILLING_DISCOUNTS[durationMonths as keyof typeof BILLING_DISCOUNTS]?.bonusDays || 0;
  newExpiry.setDate(newExpiry.getDate() + bonusDays);

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: planKey,
      planExpiresAt: newExpiry,
      planStartedAt: user.planStartedAt || now,
    },
  });
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8')
  );
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-s3p-signature');
  const rawBody = await req.text();

  // Verify webhook secret is configured
  const s3pSecret = process.env.S3P_WEBHOOK_SECRET;
  if (!s3pSecret) {
    console.error('[S3P Webhook] S3P_WEBHOOK_SECRET not configured - webhook rejected');
    return NextResponse.json(
      { success: false, error: 'Webhook configuration missing' },
      { status: 500 }
    );
  }

  // Verify signature is present
  if (!signature) {
    console.error('[S3P Webhook] Missing signature');
    return NextResponse.json(
      { success: false, error: 'Missing signature' },
      { status: 401 }
    );
  }

  // Verify HMAC-SHA256 signature
  if (!verifySignature(rawBody, signature, s3pSecret)) {
    console.error('[S3P Webhook] Invalid signature');
    return NextResponse.json(
      { success: false, error: 'Invalid signature' },
      { status: 401 }
    );
  }

  try {
    const body = JSON.parse(rawBody);
    const { ptn, status } = body;

    if (!ptn || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing transaction ID (ptn) or status.' },
        { status: 400 }
      );
    }

    console.log(`[S3P Webhook] Received status '${status}' for ptn: ${ptn}`);

    const dbTransaction = await transactionService.getTransactionByPtn(ptn);

    if (!dbTransaction) {
      console.warn(`[S3P Webhook] Transaction not found for ptn: ${ptn}`);
      // Return 200 so S3P does not retry
      return NextResponse.json(
        { success: true, message: 'Transaction not found, notification ignored.' },
        { status: 200 }
      );
    }

    const newStatus = status.toUpperCase();
    const metadata = (dbTransaction.metadata as Record<string, unknown>) || {};

    if (dbTransaction.status !== newStatus) {
      await transactionService.updateTransaction(ptn, {
        status: newStatus,
        metadata: {
          ...metadata,
          notificationReceivedAt: new Date().toISOString(),
          lastStatus: dbTransaction.status,
          statusUpdatedAt: new Date().toISOString(),
        },
      });

      // If payment confirmed/successful, update user subscription
      if (
        (newStatus === 'SUCCESS' || newStatus === 'CONFIRMED') &&
        dbTransaction.status !== 'SUCCESS' &&
        dbTransaction.userId
      ) {
        console.log(`[S3P Webhook] Updating subscription for user ${dbTransaction.userId}`);
        const { plan, duration } = metadata as { plan?: string; duration?: number };
        if (plan && duration) {
          await updateUserSubscription(dbTransaction.userId, plan, duration);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Notification processed successfully.',
      transactionId: ptn,
      status: newStatus,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[S3P Webhook] Error processing notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'An internal error occurred.';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      Allow: 'POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  });
}
