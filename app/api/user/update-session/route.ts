// app/api/user/update-session/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

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

    // Récupérer les informations mises à jour de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      select: {
        id: true,
        role: true,
        planExpiresAt: true,
        planStartedAt: true,
        paymentStatus: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          role: user.role,
          planExpiresAt: user.planExpiresAt?.toISOString(),
          planStartedAt: user.planStartedAt?.toISOString(),
          paymentStatus: user.paymentStatus
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la session:', error);
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