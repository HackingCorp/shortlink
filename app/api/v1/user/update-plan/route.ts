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

    const { plan, status, upgradedAt, transactionId, provider, durationMonths } = await request.json();

    // Validation du plan
    const validPlans: UserRole[] = ['STANDARD', 'PRO', 'ENTERPRISE'];
    if (!validPlans.includes(plan as UserRole)) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    // Récupérer la date d'expiration actuelle
    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      select: {
        planExpiresAt: true
      }
    });

    const oldExpiryDate = currentUser?.planExpiresAt;

    // Calcul de la nouvelle date d'expiration
    const planExpiresAt = new Date();
    planExpiresAt.setMonth(planExpiresAt.getMonth() + (durationMonths || 1));

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(session.user.id) },
      data: {
        role: plan as UserRole,
        planStartedAt: upgradedAt ? new Date(upgradedAt) : new Date(),
        planExpiresAt: planExpiresAt,
        ...(transactionId && { subscriptionId: transactionId }),
        ...(provider && { paymentMethod: provider }),
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        planStartedAt: true,
        planExpiresAt: true,
        paymentStatus: true
      }
    });

    console.log('✅ Plan utilisateur mis à jour:', {
      user: updatedUser,
      transactionId,
      provider,
      oldExpiryDate,
      newExpiryDate: planExpiresAt
    });

    return NextResponse.json({ 
      success: true, 
      user: updatedUser,
      oldExpiryDate: oldExpiryDate?.toISOString(),
      newExpiryDate: planExpiresAt.toISOString(),
      daysAdded: durationMonths ? durationMonths * 30 : 30, // Approximation de 30 jours par mois
      message: `Plan ${plan} activé avec succès` 
    });

  } catch (error) {
    console.error('❌ Erreur mise à jour plan:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du plan' },
      { status: 500 }
    );
  }
}