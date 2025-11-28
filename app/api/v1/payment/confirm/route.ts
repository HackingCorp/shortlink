import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { transactionId, paymentMethod, amount, durationMonths, planId } = await request.json();

    console.log('🔔 Confirmation de renouvellement reçue:', {
      transactionId,
      paymentMethod,
      amount,
      durationMonths,
      planId
    });

    // Récupérer l'utilisateur depuis la session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);

    // Récupérer l'utilisateur actuel
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        planExpiresAt: true,
        planStartedAt: true,
        name: true,
        email: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    console.log('👤 Utilisateur trouvé:', {
      id: user.id,
      planActuel: user.role,
      expirationActuelle: user.planExpiresAt
    });

    const now = new Date();
    const currentExpiry = user.planExpiresAt ? new Date(user.planExpiresAt) : now;
    
    const startDate = currentExpiry > now ? currentExpiry : now;
    
    const remainingDays = currentExpiry > now 
      ? Math.floor((currentExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    console.log('📅 Calcul des dates:', {
      maintenant: now.toISOString(),
      expirationActuelle: currentExpiry.toISOString(),
      dateDeDépart: startDate.toISOString(),
      joursRestants: remainingDays
    });

    const daysAdded = durationMonths * 30; 
    const bonusDays = calculateBonusDays(durationMonths);
    const totalDaysAdded = daysAdded + bonusDays;

    const newExpiryDate = new Date(startDate);
    newExpiryDate.setDate(startDate.getDate() + totalDaysAdded); 

    const totalEffectiveDays = Math.floor((newExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    console.log('🔄 Mise à jour abonnement CORRIGÉ:', {
      startDate: startDate.toISOString(),
      durationMonths,
      daysAdded,
      bonusDays,
      totalDaysAdded,
      joursRestants: remainingDays,
      totalEffectiveDays, 
      newExpiryDate: newExpiryDate.toISOString()
    });

    // Vérification du calcul
    if (remainingDays > 0) {
      const expectedTotalDays = remainingDays + totalDaysAdded;
      console.log('🔍 VÉRIFICATION CALCUL:', {
        joursRestants: remainingDays,
        joursAjoutés: totalDaysAdded,
        totalAttendu: expectedTotalDays,
        totalCalculé: totalEffectiveDays,
        calculCorrect: expectedTotalDays === totalEffectiveDays
      });
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        planExpiresAt: newExpiryDate,
        role: planId || user.role,
        updatedAt: new Date()
      },
      select: {
        id: true,
        role: true,
        planExpiresAt: true,
        planStartedAt: true,
        updatedAt: true
      }
    });

    console.log('✅ Utilisateur mis à jour:', {
      userId: updatedUser.id,
      nouveauRole: updatedUser.role,
      nouvelleExpiration: updatedUser.planExpiresAt
    });

    // FORMATTER LA RÉPONSE
    const responseData = {
      success: true,
      message: 'Renouvellement confirmé avec succès',
      data: {
        userId: updatedUser.id,
        plan: updatedUser.role,
        oldExpiryDate: user.planExpiresAt?.toISOString() || null,
        newExpiryDate: updatedUser.planExpiresAt?.toISOString() || null,
        daysAdded: totalDaysAdded, 
        bonusDays,
        durationMonths,
        remainingDays, 
        totalEffectiveDays 
      }
    };

    console.log('📤 Réponse API:', responseData);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Erreur confirmation renouvellement:', error);
    return NextResponse.json({ 
      error: 'Erreur interne du serveur',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 });
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