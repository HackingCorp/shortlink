import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { transactionId, durationMonths, planId } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: 'ID de transaction requis' }, { status: 400 });
    }

    const userId = parseInt(session.user.id, 10);

    // Vérifier que le paiement existe et est confirmé en base de données
    const payment = await prisma.payment.findFirst({
      where: {
        userId: userId,
        status: 'succeeded',
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

    // Récupérer l'utilisateur actuel
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        planExpiresAt: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const now = new Date();
    const currentExpiry = user.planExpiresAt ? new Date(user.planExpiresAt) : now;
    const startDate = currentExpiry > now ? currentExpiry : now;

    const months = durationMonths || 1;
    const daysAdded = months * 30;
    const bonusDays = calculateBonusDays(months);
    const totalDaysAdded = daysAdded + bonusDays;

    const newExpiryDate = new Date(startDate);
    newExpiryDate.setDate(startDate.getDate() + totalDaysAdded);

    const plan = planId || payment.plan || user.role;

    // Appliquer le renouvellement via transaction atomique
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          planExpiresAt: newExpiryDate,
          role: plan,
          paymentStatus: 'active',
          updatedAt: new Date()
        },
        select: {
          id: true,
          role: true,
          planExpiresAt: true,
          planStartedAt: true,
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

    const remainingDays = currentExpiry > now
      ? Math.floor((currentExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const totalEffectiveDays = Math.floor((newExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      success: true,
      message: 'Renouvellement confirmé avec succès',
      data: {
        userId: updatedUser.id,
        plan: updatedUser.role,
        oldExpiryDate: user.planExpiresAt?.toISOString() || null,
        newExpiryDate: updatedUser.planExpiresAt?.toISOString() || null,
        daysAdded: totalDaysAdded,
        bonusDays,
        durationMonths: months,
        remainingDays,
        totalEffectiveDays
      }
    });

  } catch (error) {
    console.error('Erreur confirmation renouvellement:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

function calculateBonusDays(durationMonths: number): number {
  const bonusStructure: { [key: number]: number } = {
    1: 3,
    3: 5,
    6: 10,
    12: 30
  };
  return bonusStructure[durationMonths] || 0;
}
