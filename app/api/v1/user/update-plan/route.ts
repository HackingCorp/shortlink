import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { plan, transactionId, provider } = await request.json();

    // Validation du plan
    const validPlans: UserRole[] = ['STANDARD', 'PRO', 'ENTERPRISE'];
    if (!validPlans.includes(plan as UserRole)) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    if (!transactionId) {
      return NextResponse.json({ error: 'ID de transaction requis' }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    // Vérifier que le paiement existe et est confirmé en base de données
    const payment = await prisma.payment.findFirst({
      where: {
        userId: userId,
        status: 'succeeded',
        plan: plan,
        OR: [
          { paymentId: transactionId },
          { metadata: { path: ['s3pPTN'], equals: transactionId } },
          { metadata: { path: ['enkapTransactionId'], equals: transactionId } },
        ]
      }
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Aucun paiement vérifié trouvé pour cette transaction' },
        { status: 403 }
      );
    }

    // Vérifier que ce paiement n'a pas déjà été utilisé
    if (payment.metadata && typeof payment.metadata === 'object' && 'appliedAt' in payment.metadata) {
      return NextResponse.json(
        { error: 'Ce paiement a déjà été appliqué' },
        { status: 409 }
      );
    }

    // Appliquer l'upgrade via transaction atomique
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          role: plan as UserRole,
          planStartedAt: payment.periodStart || new Date(),
          planExpiresAt: payment.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paymentStatus: 'active',
          ...(provider && { paymentMethod: provider }),
          ...(transactionId && { subscriptionId: transactionId }),
          updatedAt: new Date()
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          planStartedAt: true,
          planExpiresAt: true,
        }
      }),
      // Marquer le paiement comme appliqué
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          metadata: {
            ...(typeof payment.metadata === 'object' ? payment.metadata : {}),
            appliedAt: new Date().toISOString(),
          }
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: `Plan ${plan} activé avec succès`
    });

  } catch (error) {
    console.error('Erreur mise à jour plan:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du plan' },
      { status: 500 }
    );
  }
}
