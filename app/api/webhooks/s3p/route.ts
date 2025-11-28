// app/api/webhooks/s3p/route.ts
// Webhook pour recevoir les notifications de paiement S3P en temps réel

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { s3pMobileWallet } from '@/lib/s3p/mobileWalletService';

// Interface pour les notifications S3P
interface S3PWebhookPayload {
  event: 'payment.succeeded' | 'payment.failed' | 'payment.cancelled' | 'payment.pending';
  data: {
    ptn: string;
    amount: number;
    currency: 'XAF';
    status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED';
    timestamp: string;
    customer: {
      name: string;
      phone: string;
      email: string;
    };
    merchant: 'ORANGE_MONEY' | 'MTN_MOMO' | 'EXPRESS_UNION';
    payItemId: string;
    trid?: string;
    tag?: string;
  };
  signature?: string;
}

// Cache pour éviter les doublons de webhooks
const processedWebhooks = new Set<string>();

// Fonction pour vérifier la signature du webhook
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  
  try {
    const hmac = crypto.createHmac('sha256', secret);
    const expectedSignature = hmac.update(payload).digest('hex');
    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Erreur vérification signature:', error);
    return false;
  }
}

// Fonction pour traiter les notifications de paiement réussi
async function handlePaymentSuccess(webhookData: S3PWebhookPayload['data']) {
  try {
    // Vérifier si le webhook a déjà été traité
    if (processedWebhooks.has(webhookData.ptn)) {
      console.log('Webhook déjà traité:', webhookData.ptn);
      return { success: true, message: 'Webhook déjà traité' };
    }

    const payment = await prisma.payment.findFirst({
      where: {
        paymentId: webhookData.ptn,
        status: { in: ['pending', 'processing'] }
      },
      include: { user: { select: { id: true, email: true, role: true } } }
    });

    if (!payment) {
      console.warn('Paiement non trouvé:', webhookData.ptn);
      return { success: false, message: 'Paiement non trouvé' };
    }

    if (payment.amount !== webhookData.amount) {
      console.error('Montant incorrect:', {
        expected: payment.amount,
        received: webhookData.amount,
        ptn: webhookData.ptn
      });
      return { success: false, message: 'Montant incorrect' };
    }

    // Mise à jour transactionnelle
    const [updatedPayment, updatedUser] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'succeeded',
          metadata: {
            ...(payment.metadata as object || {}),
            webhookReceived: true,
            webhookTimestamp: webhookData.timestamp,
            s3pData: webhookData,
            confirmedAt: new Date().toISOString()
          }
        }
      }),
      prisma.user.update({
        where: { id: payment.userId },
        data: {
          role: payment.plan,
          planStartedAt: payment.periodStart,
          planExpiresAt: payment.periodEnd,
          paymentStatus: 'active',
          paymentMethod: 's3p_mobile_money',
          subscriptionId: webhookData.ptn
        }
      })
    ]);

    // Ajouter à la liste des webhooks traités
    processedWebhooks.add(webhookData.ptn);
    
    // Nettoyer périodiquement le cache
    if (processedWebhooks.size > 1000) {
      const first = processedWebhooks.values().next().value;
      processedWebhooks.delete(first);
    }

    return { 
      success: true, 
      message: 'Paiement confirmé avec succès',
      data: { paymentId: updatedPayment.id, userId: updatedUser.id }
    };

  } catch (error) {
    console.error('Erreur traitement paiement:', error);
    return { success: false, message: 'Erreur interne du serveur' };
  }
}

// Fonction pour traiter les échecs de paiement
async function handlePaymentFailure(webhookData: S3PWebhookPayload['data']) {
  try {
    await prisma.payment.updateMany({
      where: { paymentId: webhookData.ptn },
      data: {
        status: 'failed',
        metadata: {
          webhookReceived: true,
          webhookTimestamp: webhookData.timestamp,
          s3pData: webhookData,
          failureReason: `Échec S3P: ${webhookData.status}`
        }
      }
    });
    return { success: true, message: 'Paiement marqué comme échoué' };
  } catch (error) {
    console.error('Erreur traitement échec:', error);
    return { success: false, message: 'Erreur interne' };
  }
}

// Endpoint principal
export async function POST(request: Request) {
  const startTime = Date.now();
  const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('x-s3p-signature') || '';
    const webhookSecret = process.env.S3P_WEBHOOK_SECRET || '';

    // Journalisation de base
    console.log(`[${webhookId}] Webhook reçu`, {
      method: request.method,
      contentType: headersList.get('content-type'),
      contentLength: headersList.get('content-length'),
      signature: signature ? 'présente' : 'manquante'
    });

    // Vérification de la signature
    if (webhookSecret && !verifyWebhookSignature(body, signature, webhookSecret)) {
      console.error(`[${webhookId}] Signature invalide`);
      return NextResponse.json(
        { error: 'Signature invalide' },
        { status: 401 }
      );
    }

    // Parsing du payload
    let webhookData: S3PWebhookPayload;
    try {
      webhookData = JSON.parse(body);
    } catch (error) {
      console.error(`[${webhookId}] Erreur parsing JSON:`, error);
      return NextResponse.json(
        { error: 'Format JSON invalide' },
        { status: 400 }
      );
    }

    // Validation des données requises
    if (!webhookData.data?.ptn) {
      return NextResponse.json(
        { error: 'PTN manquant dans les données' },
        { status: 400 }
      );
    }

    // Traitement selon le type d'événement
    let result;
    switch (webhookData.event) {
      case 'payment.succeeded':
        if (webhookData.data.status === 'SUCCESS') {
          result = await handlePaymentSuccess(webhookData.data);
        } else {
          console.warn(`[${webhookId}] Statut inattendu:`, webhookData.data.status);
          result = { success: false, message: 'Statut incohérent' };
        }
        break;

      case 'payment.failed':
      case 'payment.cancelled':
        result = await handlePaymentFailure(webhookData.data);
        break;

      case 'payment.pending':
        console.log(`[${webhookId}] Paiement en cours:`, webhookData.data.ptn);
        result = { success: true, message: 'Paiement en attente' };
        break;

      default:
        console.warn(`[${webhookId}] Événement non géré:`, webhookData.event);
        result = { success: false, message: 'Événement non géré' };
    }

    // Réponse
    const response = {
      success: result.success,
      message: result.message,
      webhookId,
      ptn: webhookData.data.ptn,
      timestamp: new Date().toISOString(),
      processingTime: `${Date.now() - startTime}ms`
    };

    if (!result.success) {
      console.error(`[${webhookId}] Échec du traitement:`, result.message);
      return NextResponse.json(response, { status: 422 });
    }

    return NextResponse.json(response);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error(`[${webhookId}] Erreur critique:`, error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur interne du serveur',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        webhookId
      },
      { status: 500 }
    );
  }
}

// Endpoint GET pour vérification
export async function GET() {
  const status = {
    service: 'S3P Webhook',
    status: 'active',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    endpoints: {
      POST: '/api/webhooks/s3p - Traitement des notifications S3P',
      GET: '/api/webhooks/s3p - Vérification du statut'
    }
  };

  return NextResponse.json(status);
}

// Configuration de la route
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // secondes