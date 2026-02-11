import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { plan, transactionId } = data;
    const validPlans = ['STANDARD', 'PRO', 'ENTERPRISE'] as const;
    type ValidPlan = typeof validPlans[number];

    if (!validPlans.includes(plan as ValidPlan)) {
      return NextResponse.json(
        { success: false, error: `Plan non valide. Doit être l'un des suivants: ${validPlans.join(', ')}` },
        { status: 400 }
      );
    }

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'ID de transaction requis' },
        { status: 400 }
      );
    }

    // Vérifier que le paiement existe et est confirmé en base de données
    const payment = await prisma.payment.findFirst({
      where: {
        paymentId: transactionId,
        userId: parseInt(session.user.id),
        status: 'succeeded',
        plan: plan,
      }
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Aucun paiement vérifié trouvé pour cette transaction' },
        { status: 403 }
      );
    }

    // Vérifier que ce paiement n'a pas déjà été utilisé pour un upgrade
    if (payment.metadata && typeof payment.metadata === 'object' && 'appliedAt' in payment.metadata) {
      return NextResponse.json(
        { success: false, error: 'Ce paiement a déjà été appliqué' },
        { status: 409 }
      );
    }

    // Appliquer l'upgrade avec les dates du paiement
    const updatedUser = await prisma.$transaction([
      prisma.user.update({
        where: { id: parseInt(session.user.id) },
        data: {
          role: plan,
          planStartedAt: payment.periodStart || new Date(),
          planExpiresAt: payment.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paymentStatus: 'active',
        },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
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
      data: updatedUser[0]
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du plan:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour du plan' },
      { status: 500 }
    );
  }
}
