// lib/planLimits.ts
import { UserRole } from '@prisma/client';

export interface PlanLimits {
  maxClicks: number | null;
  maxTeamMembers: number | null;
  maxApiKeys: number | null;
  features: string[];
}

export const getPlanLimits = (role: UserRole): PlanLimits => {
  const limits: Record<UserRole, PlanLimits> = {
    FREE: {
      maxClicks: 1000,
      maxTeamMembers: 1,
      maxApiKeys: 1,
      features: [
        'Jusqu\'à 1 000 clics/mois',
        'Liens basiques',
        'Statistiques simples',
        '1 membre d\'équipe',
        '1 clé API'
      ]
    },
    STANDARD: {
      maxClicks: 10000,
      maxTeamMembers: 5,
      maxApiKeys: null,
      features: [
        'Jusqu\'à 10 000 clics/mois',
        'Liens personnalisés',
        'Statistiques avancées',
        'QR Codes personnalisables',
        'Support par email',
        'Jusqu\'à 5 membres d\'équipe'
      ]
    },
    PRO: {
      maxClicks: 50000,
      maxTeamMembers: 15,
      maxApiKeys: 2,
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
      ]
    },
    ENTERPRISE: {
      maxClicks: null, // Illimité
      maxTeamMembers: 50,
      maxApiKeys: null, // Illimité
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
        'Clés API illimitées'
      ]
    }
  };

  return limits[role] || limits.FREE;
};

// Vérifier si un utilisateur a dépassé ses limites
export const checkPlanLimit = (
  currentUsage: number, 
  userRole: UserRole, 
  limitType: keyof PlanLimits
): { withinLimit: boolean; remaining: number | null } => {
  const limits = getPlanLimits(userRole);
  const limit = limits[limitType];

  if (limit === null) {
    return { withinLimit: true, remaining: null }; 
  }
  if(typeof limit !== 'number') {
    return { withinLimit: true, remaining: 0 };
  }

  const remaining = limit - currentUsage;
  return { 
    withinLimit: remaining > 0, 
    remaining: Math.max(0, remaining) 
  };
};