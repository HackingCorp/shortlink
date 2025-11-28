// app/api/cron/subscription-check/route.ts

import { NextResponse } from 'next/server';
import { processExpiredSubscriptions, sendRenewalNotifications } from '@/lib/subscriptionNotifications';

// Cette route sera appelée par un service cron (ex: Vercel Cron, GitHub Actions, etc.)
export async function POST(request: Request) {
  try {
    // Vérifier l'autorisation (token secret pour la sécurité)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    console.log('🕐 Début de la vérification des abonnements...');

    // 1. Traiter les abonnements expirés
    const downgradedCount = await processExpiredSubscriptions();
    
    // 2. Envoyer les notifications de renouvellement
    await sendRenewalNotifications();

    console.log('✅ Vérification des abonnements terminée');

    return NextResponse.json({
      success: true,
      message: 'Vérification des abonnements terminée',
      results: {
        downgradedUsers: downgradedCount,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur lors de la vérification des abonnements:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erreur lors de la vérification des abonnements',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

// GET pour vérifier manuellement le statut
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Obtenir des statistiques sur les abonnements
    const stats = await prisma.user.groupBy({
      by: ['role', 'paymentStatus'],
      _count: {
        _all: true
      }
    });

    // Compter les utilisateurs avec des abonnements qui expirent bientôt
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    const expiringUsers = await prisma.user.count({
      where: {
        role: {
          in: ['STANDARD', 'PRO', 'ENTERPRISE']
        },
        planExpiresAt: {
          gte: now,
          lte: sevenDaysFromNow
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        stats,
        expiringUsers,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erreur lors de la récupération des statistiques',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

// Configuration pour Vercel Cron Jobs
// Ajoutez ceci dans vercel.json :
/*
{
  "crons": [
    {
      "path": "/api/cron/subscription-check",
      "schedule": "0 9 * * *"
    }
  ]
}
*/