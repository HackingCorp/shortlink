import { prisma } from './prisma';
import { UserRole } from '@prisma/client';
import { sendMail } from './email';

// Délai avant expiration pour envoyer une notification (en jours)
const RENEWAL_REMINDER_DAYS = [7, 3, 1];

// Modèle de base pour les e-mails
export interface EmailTemplate {
  subject: string;
  html: string;
}

// Modèles d'e-mails
const EMAIL_TEMPLATES = {
  subscriptionExpired: (name: string): EmailTemplate => ({
    subject: 'Votre abonnement a expiré',
    html: `
      <h1>Bonjour ${name},</h1>
      <p>Votre abonnement a expiré. Vous avez été rétrogradé au plan gratuit.</p>
      <p>Pour continuer à profiter des fonctionnalités premium, veuillez renouveler votre abonnement.</p>
      <a href="${process.env.NEXTAUTH_URL}/dashboard/upgrade">Mettre à niveau maintenant</a>
    `
  }),
  
  renewalReminder: (name: string, daysLeft: number): EmailTemplate => ({
    subject: `Renouvelez votre abonnement - ${daysLeft} jour(s) restant(s)`,
    html: `
      <h1>Bonjour ${name},</h1>
      <p>Votre abonnement expire dans ${daysLeft} jour(s).</p>
      <p>Renouvelez dès maintenant pour éviter toute interruption de service.</p>
      <a href="${process.env.NEXTAUTH_URL}/dashboard/renew">Renouveler mon abonnement</a>
    `
  })
};

// Récupérer les utilisateurs dont l'abonnement expire bientôt
async function getExpiringSubscriptions(daysUntilExpiration: number) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysUntilExpiration);
  
  return await prisma.user.findMany({
    where: {
      role: { in: ['STANDARD', 'PRO', 'ENTERPRISE'] },
      planExpiresAt: {
        gte: new Date(targetDate.toISOString().split('T')[0] + 'T00:00:00.000Z'),
        lt: new Date(targetDate.toISOString().split('T')[0] + 'T23:59:59.999Z')
      }
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      planExpiresAt: true
    }
  });
}

// Envoyer des notifications de renouvellement
export async function sendRenewalNotifications() {
  console.log('Envoi des notifications de renouvellement...');
  let notificationCount = 0;
  
  for (const days of RENEWAL_REMINDER_DAYS) {
    const users = await getExpiringSubscriptions(days);
    
    for (const user of users) {
      if (!user.email) continue;
      
      const template = EMAIL_TEMPLATES.renewalReminder(
        user.name || 'utilisateur',
        days
      );
      
      try {
await sendMail({
          to: user.email,
          subject: template.subject,
          html: template.html
        });
        
        console.log(`Notification envoyée à ${user.email} (expire dans ${days} jours)`);
        notificationCount++;
      } catch (error) {
        console.error(`Erreur lors de l'envoi à ${user.email}:`, error);
      }
    }
  }
  
  console.log(`Notifications envoyées: ${notificationCount}`);
  return notificationCount;
}

// Traiter les abonnements expirés
export async function processExpiredSubscriptions() {
  console.log('Traitement des abonnements expirés...');
  const now = new Date();
  let downgradedCount = 0;
  
  // Trouver les utilisateurs dont l'abonnement est expiré
  const expiredUsers = await prisma.user.findMany({
    where: {
      role: { in: ['STANDARD', 'PRO', 'ENTERPRISE'] },
      planExpiresAt: { lt: now }
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      planExpiresAt: true
    }
  });
  
  // Mettre à jour chaque utilisateur expiré
  for (const user of expiredUsers) {
    try {
      // Mettre à jour le rôle vers FREE
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'FREE'
        }
      });
      
      // Envoyer un e-mail de notification
      if (user.email) {
        const template = EMAIL_TEMPLATES.subscriptionExpired(
          user.name || 'utilisateur'
        );
        
await sendMail({
          to: user.email,
          subject: template.subject,
          html: template.html
        });
      }
      
      console.log(`Utilisateur rétrogradé: ${user.email || user.id}`);
      downgradedCount++;
      
    } catch (error) {
      console.error(`Erreur lors du traitement de l'utilisateur ${user.id}:`, error);
    }
  }
  
  console.log(`Traitement terminé: ${downgradedCount} utilisateurs rétrogradés`);
  return downgradedCount;
}
