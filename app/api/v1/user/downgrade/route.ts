import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Vérifier l'authentification
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      select: {
        id: true,
        role: true,
        email: true,
        planExpiresAt: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier si l'utilisateur est déjà en plan gratuit
    if (user.role === 'FREE') {
      return NextResponse.json({
        success: true,
        message: 'L\'utilisateur est déjà en plan gratuit',
        data: { user }
      });
    }

    // Mettre à jour l'utilisateur vers le plan gratuit
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'FREE',
        planStartedAt: new Date(),
        planExpiresAt: null,
        paymentStatus: 'EXPIRED',
        paymentMethod: null,
        paymentLastFour: null,
        subscriptionId: null
      },
      select: {
        id: true,
        email: true,
        role: true,
        planStartedAt: true,
        planExpiresAt: true
      }
    });

    // Enregistrer un événement de rétrogradation
    await prisma.payment.create({
      data: {
        userId: user.id,
        amount: 0,
        currency: 'XAF',
        status: 'EXPIRED',
        paymentMethod: 'SYSTEM',
        plan: 'FREE',
        periodStart: new Date(),
        periodEnd: new Date(),
        metadata: {
          previousRole: user.role,
          reason: 'Abonnement expiré - Rétrogradation automatique',
          previousPlanExpiresAt: user.planExpiresAt
        }
      }
    });

    // Envoyer un email de notification (à implémenter)
    // await sendDowngradeNotificationEmail(user.email, user.role);

    return NextResponse.json({
      success: true,
      message: 'L\'utilisateur a été rétrogradé au plan gratuit',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Erreur lors de la rétrogradation de l\'utilisateur:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Une erreur est survenue lors de la rétrogradation du compte',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

// Endpoint GET pour vérifier l'état de l'utilisateur
export async function GET(request: Request) {
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
        email: true,
        planStartedAt: true,
        planExpiresAt: true,
        paymentStatus: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier si le plan est expiré
    let isExpired = false;
    if (user.planExpiresAt && user.role !== 'FREE') {
      const expirationDate = new Date(user.planExpiresAt);
      const today = new Date();
      isExpired = expirationDate < today;
    }

    return NextResponse.json({
      success: true,
      data: {
        user,
        isExpired
      }
    });

  } catch (error) {
    console.error('Erreur lors de la vérification de l\'état de l\'utilisateur:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Une erreur est survenue lors de la vérification de l\'état du compte',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
