// middleware/subscriptionCheck.ts

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Middleware pour vérifier le statut des abonnements
 * et rediriger vers les pages appropriées
 */
export async function subscriptionMiddleware(request: NextRequest) {
  const token = await getToken({ req: request });
  
  if (!token) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  
  // Routes protégées nécessitant un abonnement actif
  const protectedRoutes = [
    '/dashboard/links',
    '/dashboard/analytics',
    '/dashboard/api-keys',
    '/dashboard/team'
  ];

  // Vérifier si l'utilisateur accède à une route protégée
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute && token.role && token.role !== 'FREE') {
    // Vérifier si l'abonnement a expiré
    if (token.planExpiresAt) {
      const expirationDate = new Date(token.planExpiresAt as string);
      const now = new Date();
      
      if (expirationDate < now) {
        // L'abonnement a expiré, rediriger vers la page de renouvellement
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/upgrade';
        url.searchParams.set('expired', 'true');
        url.searchParams.set('mode', 'renewal');
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

// lib/subscriptionNotifications.ts

import prisma from '@/lib/prisma';

/**
 * Fonction pour envoyer des notifications de renouvellement
 */
export async function sendRenewalNotifications() {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

    // Trouver les utilisateurs dont l'abonnement expire dans 3 ou 7 jours
    const usersToNotify = await prisma.user.findMany({
      where: {
        role: {
          in: ['STANDARD', 'PRO', 'ENTERPRISE']
        },
        planExpiresAt: {
          gte: now,
          lte: sevenDaysFromNow
        },
        paymentStatus: 'PAID'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        planExpiresAt: true
      }
    });

    for (const user of usersToNotify) {
      if (!user.planExpiresAt) continue;

      const daysUntilExpiration = Math.ceil(
        (user.planExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Envoyer notification à 7 jours et 3 jours
      if (daysUntilExpiration === 7 || daysUntilExpiration === 3) {
        await sendRenewalReminderEmail(user, daysUntilExpiration);
      }
    }

    console.log(`Notifications de renouvellement envoyées à ${usersToNotify.length} utilisateurs`);
  } catch (error) {
    console.error('Erreur lors de l\'envoi des notifications de renouvellement:', error);
  }
}

/**
 * Fonction pour envoyer un email de rappel de renouvellement
 */
async function sendRenewalReminderEmail(user: any, daysRemaining: number) {
  // TODO: Implémenter l'envoi d'email
  console.log(`Email de rappel à envoyer à ${user.email} - ${daysRemaining} jours restants`);
  
  // Ici vous pouvez intégrer votre service d'email (SendGrid, Resend, etc.)
  // Exemple de contenu d'email :
  const emailContent = {
    to: user.email,
    subject: `Votre abonnement ${user.role} expire dans ${daysRemaining} jours`,
    html: `
      <h2>Bonjour ${user.name || 'cher utilisateur'},</h2>
      <p>Votre abonnement <strong>${user.role}</strong> expire dans <strong>${daysRemaining} jours</strong>.</p>
      <p>Renouvelez maintenant pour bénéficier de jours bonus de fidélité !</p>
      <a href="${process.env.NEXTAUTH_URL}/dashboard/upgrade?mode=renewal" 
         style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Renouveler maintenant
      </a>
      <p><small>Bonus disponibles : 3-14 jours gratuits selon la durée choisie</small></p>
    `
  };
}

/**
 * Fonction pour rétrograder automatiquement les utilisateurs expirés
 */
export async function processExpiredSubscriptions() {
  try {
    const now = new Date();

    // Trouver tous les utilisateurs avec des abonnements expirés
    const expiredUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['STANDARD', 'PRO', 'ENTERPRISE']
        },
        planExpiresAt: {
          lt: now
        },
        paymentStatus: {
          not: 'EXPIRED'
        }
      }
    });

    // Rétrograder chaque utilisateur expiré
    for (const user of expiredUsers) {
      await prisma.$transaction([
        // Mettre à jour l'utilisateur
        prisma.user.update({
          where: { id: user.id },
          data: {
            role: 'FREE',
            paymentStatus: 'EXPIRED',
            paymentMethod: null,
            paymentLastFour: null,
            subscriptionId: null
          }
        }),

        // Enregistrer l'événement de rétrogradation
        prisma.payment.create({
          data: {
            userId: user.id,
            amount: 0,
            currency: 'XAF',
            status: 'EXPIRED',
            paymentMethod: 'SYSTEM',
            paymentReference: `auto_downgrade_${Date.now()}`,
            plan: 'FREE',
            period: 'NONE',
            metadata: {
              previousRole: user.role,
              reason: 'Abonnement expiré - Rétrogradation automatique',
              expiredAt: user.planExpiresAt,
              processedAt: now
            }
          }
        })
      ]);

      // Envoyer un email de notification de rétrogradation
      await sendDowngradeNotificationEmail(user);
    }

    console.log(`${expiredUsers.length} utilisateurs rétrogradés automatiquement`);
    return expiredUsers.length;
  } catch (error) {
    console.error('Erreur lors du traitement des abonnements expirés:', error);
    throw error;
  }
}

/**
 * Fonction pour envoyer un email de notification de rétrogradation
 */
async function sendDowngradeNotificationEmail(user: any) {
  // TODO: Implémenter l'envoi d'email
  console.log(`Email de rétrogradation à envoyer à ${user.email}`);
  
  const emailContent = {
    to: user.email,
    subject: 'Votre abonnement a expiré',
    html: `
      <h2>Bonjour ${user.name || 'cher utilisateur'},</h2>
      <p>Votre abonnement <strong>${user.role}</strong> a expiré et votre compte a été rétrogradé au plan gratuit.</p>
      <p>Vous pouvez à tout moment renouveler votre abonnement pour retrouver toutes vos fonctionnalités.</p>
      <a href="${process.env.NEXTAUTH_URL}/dashboard/upgrade" 
         style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Renouveler maintenant
      </a>
    `
  };
}