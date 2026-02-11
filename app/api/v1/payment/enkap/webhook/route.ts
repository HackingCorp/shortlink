import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { transactionService } from '@/lib/s3p/transaction.service';
import { prisma } from '@/lib/prisma';
import { SUBSCRIPTION_PRICES, BILLING_DISCOUNTS } from '@/lib/s3p/config';

async function updateUserSubscription(userId: number, planId: string, durationMonths: number) {
    const planKey = planId.toUpperCase() as keyof typeof SUBSCRIPTION_PRICES;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new Error('Utilisateur non trouvé pour la mise à jour de l\'abonnement.');

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

export async function PUT(req: NextRequest) {
    const signature = req.headers.get('x-enkap-signature');
    const rawBody = await req.text();

    // Vérification de la signature Enkap (obligatoire)
    const enkapSecret = process.env.ENKAP_WEBHOOK_SECRET;
    if (!enkapSecret) {
        console.error('[E-nkap Webhook] ENKAP_WEBHOOK_SECRET non configuré - webhook rejeté');
        return NextResponse.json(
            { success: false, error: 'Configuration webhook manquante' },
            { status: 500 }
        );
    }

    if (!signature) {
        console.error('[E-nkap Webhook] Signature manquante');
        return NextResponse.json(
            { success: false, error: 'Signature manquante' },
            { status: 401 }
        );
    }

    const expectedSignature = crypto.createHmac('sha256', enkapSecret).update(rawBody).digest('hex');
    const isValidSignature = crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
    ).valueOf();

    if (!isValidSignature) {
        console.error('[E-nkap Webhook] Signature invalide');
        return NextResponse.json(
            { success: false, error: 'Signature invalide' },
            { status: 401 }
        );
    }

    try {
        const { searchParams } = new URL(req.url);
        const txid = searchParams.get('txid');
        const body = JSON.parse(rawBody);
        const { status } = body;

        if (!txid || !status) {
            return NextResponse.json(
                { success: false, error: 'ID de transaction ou statut manquant.' },
                { status: 400 }
            );
        }

        console.log(`[E-nkap Notify] Received status '${status}' for txid: ${txid}`);

        const dbTransaction = await transactionService.getTransactionByPtn(txid);

        if (!dbTransaction) {
            console.warn(`[E-nkap Notify] Transaction non trouvée pour txid: ${txid}`);
            // Répondre 200 pour que E-nkap ne réessaie pas
            return NextResponse.json(
                { success: true, message: 'Transaction non trouvée, notification ignorée.' },
                { status: 200 }
            );
        }

        const newStatus = status.toUpperCase();
        const metadata = dbTransaction.metadata as Record<string, any> || {};

        if (dbTransaction.status !== newStatus) {
            await transactionService.updateTransaction(txid, { 
                status: newStatus, 
                metadata: { 
                    ...metadata,
                    notificationReceivedAt: new Date().toISOString(),
                    lastStatus: dbTransaction.status,
                    statusUpdatedAt: new Date().toISOString()
                }
            });

            if (newStatus === 'CONFIRMED' && dbTransaction.status !== 'SUCCESS' && dbTransaction.userId) {
                console.log(`[E-nkap Notify] Mise à jour de l'abonnement pour l'utilisateur ${dbTransaction.userId}`);
                const { plan, duration } = metadata as { plan?: string, duration?: number };
                if (plan && duration) {
                    await updateUserSubscription(dbTransaction.userId, plan, duration);
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Notification traitée avec succès.',
            transactionId: txid,
            status: newStatus,
            processedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error(`[E-nkap Notify] Erreur lors du traitement de la notification:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Une erreur interne est survenue.';
        
        // Répondre avec une erreur 500 pour indiquer à E-nkap de réessayer
        return NextResponse.json(
            { 
                success: false, 
                error: errorMessage,
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

// Ajouter d'autres méthodes HTTP si nécessaire
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Allow': 'PUT, OPTIONS',
            'Content-Type': 'application/json'
        },
    });
}
