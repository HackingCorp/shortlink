import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { calculateSubscriptionPrice, SUBSCRIPTION_PRICES } from '@/lib/s3p/config';
import { enkapPaymentService } from '@/lib/enkap/paymentService';
import { transactionService } from '@/lib/s3p/transaction.service';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Non autorisé' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { 
      planId, 
      durationMonths, 
      customerName, 
      customerPhone, 
      returnUrl, 
      notificationUrl 
    } = body;

    // Validation des entrées
    if (!planId || !durationMonths || !customerName || !customerPhone) {
      return NextResponse.json(
        { success: false, error: 'Paramètres manquants' },
        { status: 400 }
      );
    }

    const planKey = planId.toUpperCase() as keyof typeof SUBSCRIPTION_PRICES;
    if (!SUBSCRIPTION_PRICES[planKey]) {
      return NextResponse.json(
        { success: false, error: 'Plan invalide' },
        { status: 400 }
      );
    }

    // Calculer le prix
    const pricing = calculateSubscriptionPrice(planKey, durationMonths);
    const amountInCents = pricing.finalAmount * 100;

    // Convertir l'ID de la session en nombre
    const userId = parseInt(session.user.id, 10);
    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: 'ID utilisateur invalide' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const merchantReference = uuidv4();
    const description = `Abonnement ${SUBSCRIPTION_PRICES[planKey].name} - ${durationMonths} mois`;
    
    const baseReturnUrl = returnUrl || `${process.env.NEXTAUTH_URL}/dashboard/upgrade/confirmation`;
    const returnUrlParams = new URLSearchParams({
      plan_id: planId.toLowerCase(),
      plan: planId.toLowerCase(),
      amount: (pricing.finalAmount || 0).toString(),
      currency: 'XAF',
      billing_period_months: durationMonths.toString(),
      discount_percent: (pricing.discount.toString() ?? 0).toString(),
      original_amount: (pricing.totalBeforeDiscount || pricing.finalAmount || 0).toString(),
      discount_amount: (pricing.discountAmount ?? 0).toString(),
      merchant_reference: merchantReference,
      customer_name: customerName,
      customer_phone: customerPhone,
      status: 'pending' // Paramètre indicatif
    });
    
    const enrichedReturnUrl = `${baseReturnUrl}&${returnUrlParams.toString()}`;

    console.log('🔗 URL de retour enrichie:', enrichedReturnUrl);

    const orderRequest = {
      merchantReference,
      customerName,
      description,
      email: user.email,
      phoneNumber: customerPhone,
      totalAmount: pricing.finalAmount,
      currency: 'XAF' as const,
      langKey: 'fr' as const,
      items: [{
        itemId: planId,
        particulars: `Abonnement ${SUBSCRIPTION_PRICES[planKey].name}`,
        quantity: 1,
        unitCost: pricing.finalAmount,
        subTotal: pricing.finalAmount,
      }],
      returnUrl: enrichedReturnUrl,
      notificationUrl: notificationUrl || `${process.env.NEXTAUTH_URL}/api/v1/payment/enkap/notify`,
    };

    console.log('📤 Requête envoyée à E-nkap:', {
      merchantReference,
      totalAmount: pricing.finalAmount,
      returnUrl: enrichedReturnUrl,
      customerEmail: user.email
    });

    // Initier le paiement via E-nkap
    const enkapResponse = await enkapPaymentService.initiatePayment(orderRequest);

    console.log('📥 Réponse reçue de E-nkap:', {
      orderTransactionId: enkapResponse.orderTransactionId,
      merchantReferenceId: enkapResponse.merchantReferenceId,
      redirectUrl: enkapResponse.redirectUrl
    });

    // 🔥 NOUVEAU : Enrichir les métadonnées avec toutes les informations de pricing
    const transactionMetadata = {
      merchantReference: enkapResponse.merchantReferenceId,
      orderTransactionId: enkapResponse.orderTransactionId,
      plan: planId,
      duration: durationMonths,
      pricing: {
        originalAmount: pricing.totalBeforeDiscount,
        finalAmount: pricing.finalAmount,
        discountAmount: pricing.discountAmount || 0,
        discountPercentage: pricing.discount.toString()|| 0,
        currency: 'XAF'
      },
      customer: {
        name: customerName,
        phone: customerPhone,
        email: user.email
      },
      urls: {
        returnUrl: enrichedReturnUrl,
        notificationUrl: notificationUrl || `${process.env.NEXTAUTH_URL}/api/v1/payment/enkap/notify`
      }
    };

    // Enregistrer la transaction dans la base de données avec métadonnées enrichies
    await transactionService.createTransaction({
      ptn: enkapResponse.orderTransactionId,
      amount: amountInCents,
      currency: 'XAF',
      merchant: 'ENKAP',
      payItemId: planId,
      customerName: customerName,
      customerEmail: user.email,
      customerPhone: customerPhone,
      metadata: transactionMetadata,
      userId: user.id,

    });

    console.log('✅ Transaction créée en base de données avec PTN:', enkapResponse.orderTransactionId);

    return NextResponse.json({ 
      success: true, 
      data: { 
        paymentUrl: enkapResponse.redirectUrl, 
        transactionId: enkapResponse.orderTransactionId,
        merchantReference: enkapResponse.merchantReferenceId,
        // Informations pour le stockage en session côté front-end
        sessionData: {
          planId: planId.toLowerCase(),
          orderTransactionId: enkapResponse.orderTransactionId,
          merchantReferenceId: enkapResponse.merchantReferenceId,
          amount: pricing.finalAmount,
          currency: 'XAF',
          billingPeriodMonths: durationMonths,
          discountPercent: pricing.discount.toString() || 0,
          originalAmount: pricing.totalBeforeDiscount,
          discountAmount: pricing.discountAmount || 0,
          customerName,
          customerPhone,
          customerEmail: user.email
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Erreur lors de l\'initiation du paiement E-nkap:', error);
    
    // Vérifier si c'est une erreur d'API E-nkap
    if (error.response?.data) {
      const { status, data } = error.response;
      console.error('Détails de l\'erreur E-nkap:', {
        status,
        errorCode: data.error?.code,
        errorMessage: data.error?.message,
        details: data.error?.details
      });
      
      return NextResponse.json(
        { 
          success: false, 
          error: data.error?.message || 'Erreur lors du traitement du paiement',
          errorCode: data.error?.code,
          details: data.error?.details
        },
        { status: status || 500 }
      );
    }
    
    
    // Gestion des erreurs réseau
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Impossible de se connecter au service de paiement. Veuillez réessayer plus tard.',
          errorCode: 'SERVICE_UNAVAILABLE'
        },
        { status: 503 }
      );
    }
    
    // Log détaillé pour les autres types d'erreurs
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Une erreur interne est survenue.';
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        errorCode: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}