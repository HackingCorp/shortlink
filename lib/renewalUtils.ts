// lib/renewalUtils.ts

import { UserRole } from '@prisma/client';
import { 
  SUBSCRIPTION_PRICES, 
  BILLING_DISCOUNTS,
  calculateSubscriptionPrice as calculatePrice
} from './s3p/config';

// Configuration des bonus de fidélité
export const LOYALTY_BONUS_DAYS = {
  '1': BILLING_DISCOUNTS[1].bonusDays,   // Jours bonus pour 1 mois
  '3': BILLING_DISCOUNTS[3].bonusDays,   // Jours bonus pour 3 mois
  '6': BILLING_DISCOUNTS[6].bonusDays,   // Jours bonus pour 6 mois
  '12': BILLING_DISCOUNTS[12].bonusDays  // Jours bonus pour 12 mois
} as const;

// Prix des plans en FCFA
export const PLAN_PRICES = {
  standard: SUBSCRIPTION_PRICES.STANDARD.monthly,
  pro: SUBSCRIPTION_PRICES.PRO.monthly,
  enterprise: SUBSCRIPTION_PRICES.ENTERPRISE.monthly
} as const;

// Réductions par durée
export const DURATION_DISCOUNTS = {
  '1': BILLING_DISCOUNTS[1].discount,   // Réduction pour 1 mois
  '3': BILLING_DISCOUNTS[3].discount,   // Réduction pour 3 mois
  '6': BILLING_DISCOUNTS[6].discount,   // Réduction pour 6 mois
  '12': BILLING_DISCOUNTS[12].discount  // Réduction pour 12 mois
} as const;

export type DurationKey = keyof typeof LOYALTY_BONUS_DAYS;
export type PlanKey = keyof typeof PLAN_PRICES;

/**
 * Calcule le prix total avec réduction
 */
export const calculateTotalPrice = (basePrice: number, durationMonths: number, discount: number): number => {
  const planKey = basePrice === SUBSCRIPTION_PRICES.STANDARD.monthly ? 'STANDARD' :
                 basePrice === SUBSCRIPTION_PRICES.PRO.monthly ? 'PRO' : 'ENTERPRISE';
  
  const priceInfo = calculatePrice(
    planKey as 'STANDARD' | 'PRO' | 'ENTERPRISE',
    durationMonths as 1 | 3 | 6 | 12
  );
  
  return priceInfo.finalAmount;
};

/**
 * Calcule la nouvelle date d'expiration avec bonus de fidélité
 */
export const calculateNewExpirationDate = (
  currentExpiresAt: Date | null,
  durationMonths: number,
  bonusDays: number,
  isEarlyRenewal: boolean
): Date => {
  const now = new Date();
  let startDate: Date;

  if (currentExpiresAt && currentExpiresAt > now) {
    // L'abonnement est encore actif, on prolonge à partir de la date d'expiration
    startDate = new Date(currentExpiresAt);
  } else {
    // L'abonnement a expiré ou n'existe pas, on commence maintenant
    startDate = now;
  }

  // Ajouter la durée de l'abonnement
  const newExpiresAt = new Date(startDate);
  newExpiresAt.setMonth(newExpiresAt.getMonth() + durationMonths);

  // Ajouter le bonus de fidélité si c'est un renouvellement anticipé
  if (isEarlyRenewal && bonusDays > 0) {
    newExpiresAt.setDate(newExpiresAt.getDate() + bonusDays);
  }

  return newExpiresAt;
};

/**
 * Calcule les jours restants jusqu'à l'expiration
 */
export const calculateDaysRemaining = (expiresAt: Date | null): number => {
  if (!expiresAt) return 0;
  
  const now = new Date();
  const diffTime = expiresAt.getTime() - now.getTime();
  
  if (diffTime <= 0) return 0;
  
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Détermine si l'utilisateur est éligible pour un bonus de fidélité
 * (Toujours vrai sauf pour les utilisateurs gratuits)
 */
export const isEligibleForLoyaltyBonus = (
  currentRole: UserRole,
  planExpiresAt: Date | null
): boolean => {
  if (currentRole === 'FREE') return false;
  return true;
};

/**
 * Obtient les informations d'un plan par son ID
 */
export const getPlanInfo = (planId: PlanKey) => {
  const planMap = {
    standard: {
      name: SUBSCRIPTION_PRICES.STANDARD.name,
      description: SUBSCRIPTION_PRICES.STANDARD.description
    },
    pro: {
      name: SUBSCRIPTION_PRICES.PRO.name,
      description: SUBSCRIPTION_PRICES.PRO.description
    },
    enterprise: {
      name: SUBSCRIPTION_PRICES.ENTERPRISE.name,
      description: SUBSCRIPTION_PRICES.ENTERPRISE.description
    }
  };

  return {
    id: planId,
    name: planMap[planId].name,
    description: planMap[planId].description,
    basePrice: PLAN_PRICES[planId],
    role: planId.toUpperCase() as UserRole
  };
};

/**
 * Calcule toutes les options de renouvellement disponibles
 * (Toujours disponible pour tous les utilisateurs payants)
 */
export const calculateRenewalOptions = (
  currentRole: UserRole,
  planExpiresAt: Date | null
) => {
  if (currentRole === 'FREE') return [];

  const planKey = currentRole.toLowerCase() as PlanKey;
  const basePrice = PLAN_PRICES[planKey];
  // Toujours considérer comme un renouvellement anticipé pour le bonus
  const isEarlyRenewal = true;

  return Object.entries(LOYALTY_BONUS_DAYS).map(([duration, bonusDays]) => {
    const durationMonths = parseInt(duration);
    const discount = DURATION_DISCOUNTS[duration as DurationKey];
    const totalPrice = calculateTotalPrice(basePrice, durationMonths, discount);
    const savings = Math.round((basePrice * durationMonths) - totalPrice);

    return {
      duration,
      durationMonths,
      basePrice,
      discount,
      totalPrice,
      bonusDays: isEarlyRenewal ? bonusDays : 0, // Toujours donner le bonus
      savings,
      durationText: durationMonths === 1 ? '1 mois' :
                   durationMonths === 3 ? '3 mois' :
                   durationMonths === 6 ? '6 mois' : '1 an',
      isRecommended: durationMonths === 3 // Recommander 3 mois par défaut
    };
  });
};

/**
 * Formate une date en français
 */
export const formatDateFr = (date: Date): string => {
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

/**
 * Convertit un planId en UserRole
 */
export const mapPlanToUserRole = (planId: string): UserRole => {
  switch (planId.toLowerCase()) {
    case 'standard': return 'STANDARD';
    case 'pro': return 'PRO';
    case 'enterprise': return 'ENTERPRISE';
    default: return 'STANDARD';
  }
};