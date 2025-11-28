// app/api/v1/subscription/renewal-info/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { 
  calculateDaysRemaining, 
  isEligibleForLoyaltyBonus, 
  calculateRenewalOptions,
  LOYALTY_BONUS_DAYS 
} from '@/lib/renewalUtils';
type PaymentMetadata = {
  isRenewal?: boolean;
 
};
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      select: {
        id: true,
        role: true,
        planStartedAt: true,
        planExpiresAt: true,
        paymentStatus: true,
        payments: {
          where: {
            status: 'COMPLETED'
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            createdAt: true,
            plan: true,
            amount: true,
            metadata: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Calculer les informations de renouvellement
    const now = new Date();
    const daysRemaining = calculateDaysRemaining(user.planExpiresAt);
    const isEligibleForBonus = isEligibleForLoyaltyBonus(user.role, user.planExpiresAt);
    const isExpired = user.planExpiresAt ? user.planExpiresAt < now : false;
    const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;
    
    let urgencyLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (isExpired) {
      urgencyLevel = 'high';
    } else if (daysRemaining <= 3) {
      urgencyLevel = 'high';
    } else if (daysRemaining <= 7) {
      urgencyLevel = 'medium';
    } else if (daysRemaining <= 14) {
      urgencyLevel = 'low';
    }

    // Calculer les options de renouvellement
    const renewalOptions = calculateRenewalOptions(user.role, user.planExpiresAt);

    // Informations sur le dernier paiement
    const lastPayment = user.payments[0] || null;

    // Calculer les économies potentielles avec les différentes durées
    const savingsComparison = renewalOptions.map(option => ({
      duration: option.durationText,
      monthlyEquivalent: Math.round(option.totalPrice / option.durationMonths),
      totalSavings: option.savings,
      bonusDays: option.bonusDays,
      totalValue: option.totalPrice + (option.bonusDays * (option.basePrice / 30)) 
    }));
    const paymentMetadata = lastPayment?.metadata as PaymentMetadata | null;

    return NextResponse.json({
      success: true,
      data: {
        subscription: {
          role: user.role,
          planStartedAt: user.planStartedAt,
          planExpiresAt: user.planExpiresAt,
          paymentStatus: user.paymentStatus,
          daysRemaining,
          isExpired,
          isExpiringSoon,
          urgencyLevel
        },
        renewal: {
          isEligible: user.role !== 'FREE',
          isEligibleForBonus,
          options: renewalOptions,
          savingsComparison,
          recommendedDuration: '3' 
        },

        lastPayment: lastPayment ? {
          date: lastPayment.createdAt,
          amount: lastPayment.amount,
          plan: lastPayment.plan,
          wasRenewal: paymentMetadata?.isRenewal || false
        } : null,
        bonusInfo: {
          available: isEligibleForBonus,
          structure: Object.entries(LOYALTY_BONUS_DAYS).map(([duration, days]) => ({
            duration: parseInt(duration) === 1 ? '1 mois' :
                     parseInt(duration) === 3 ? '3 mois' :
                     parseInt(duration) === 6 ? '6 mois' : '1 an',
            bonusDays: days
          }))
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des informations de renouvellement:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Une erreur est survenue',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}