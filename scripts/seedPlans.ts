// scripts/seedPlans.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const planDetails = {
  standard: {
    name: 'standard',
    displayName: 'Standard',
    price: 9990,
    period: 'monthly',
    features: [
      'Jusqu\'à 10 000 clics/mois',
      'Liens personnalisés',
      'Statistiques avancées',
      'QR Codes personnalisables',
      'Support par email',
      'Jusqu\'à 5 membres d\'équipe'
    ],
    maxClicks: 10000,
    maxTeamMembers: 5,
    maxApiKeys: null
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    price: 19990,
    period: 'monthly',
    features: [
      'Jusqu\'à 50 000 clics/mois',
      'Toutes les fonctionnalités Standard',
      'Jusqu\'à 15 membres d\'équipe',
      'API complète',
      'Support prioritaire',
      'Export de données',
      'Domaines personnalisés',
      'A/B Testing',
      '2 clés API actives'
    ],
    maxClicks: 50000,
    maxTeamMembers: 15,
    maxApiKeys: 2
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Entreprise',
    price: 32900,
    period: 'monthly',
    features: [
      'Volume illimité de liens et clics',
      'Toutes les fonctionnalités Pro',
      'Jusqu\'à 50 membres d\'équipe',
      'Gestion des rôles avancée',
      'Support prioritaire 24/7',
      'Domaines personnalisés illimités',
      'Intégrations personnalisées',
      'SLA 99.9% avec support dédié',
      'Accompagnement personnalisé',
      'Clés API illimitées',
      'Analyse avancée et rapports',
      'Migration et assistance technique',
      'Contrat de niveau de service personnalisé'
    ],
    maxClicks: null, // Illimité
    maxTeamMembers: 50,
    maxApiKeys: null // Illimité
  }
};

async function seedPlans() {
  try {
    console.log('🌱 Début de l\'insertion des plans...');

    // Vérifier si les plans existent déjà
    const existingPlans = await prisma.plan.findMany();
    
    if (existingPlans.length > 0) {
      console.log('📋 Plans déjà existants, mise à jour...');
      
      for (const [key, planData] of Object.entries(planDetails)) {
        await prisma.plan.upsert({
          where: { name: planData.name },
          update: {
            displayName: planData.displayName,
            price: planData.price,
            features: planData.features,
            maxClicks: planData.maxClicks,
            maxTeamMembers: planData.maxTeamMembers,
            maxApiKeys: planData.maxApiKeys,
            updatedAt: new Date()
          },
          create: {
            name: planData.name,
            displayName: planData.displayName,
            price: planData.price,
            features: planData.features,
            maxClicks: planData.maxClicks,
            maxTeamMembers: planData.maxTeamMembers,
            maxApiKeys: planData.maxApiKeys
          }
        });
        console.log(`✅ Plan ${planData.displayName} mis à jour`);
      }
    } else {
      console.log('📋 Création des nouveaux plans...');
      
      for (const [key, planData] of Object.entries(planDetails)) {
        await prisma.plan.create({
          data: {
            name: planData.name,
            displayName: planData.displayName,
            price: planData.price,
            features: planData.features,
            maxClicks: planData.maxClicks,
            maxTeamMembers: planData.maxTeamMembers,
            maxApiKeys: planData.maxApiKeys
          }
        });
        console.log(`✅ Plan ${planData.displayName} créé`);
      }
    }

    console.log('🎉 Tous les plans ont été insérés avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors de l\'insertion des plans:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
seedPlans();