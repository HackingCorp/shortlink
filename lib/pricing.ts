// Configuration centralisée pour la tarification et les plans

// Prix des plans en centimes (pour éviter les problèmes de précision avec les décimales)
export const PLAN_PRICES = {
    standard: 999000,   // 9,990 FCFA en centimes
    pro: 1999000,       // 19,990 FCFA en centimes  
    enterprise: 3290000 // 32,900 FCFA en centimes
  } as const;
  
  // Durées d'abonnement disponibles
  export const BILLING_PERIODS = [
    { id: '1', name: '1 mois', months: 1, discount: 0, bonusDays: 3 },
    { id: '3', name: '3 mois', months: 3, discount: 0.05, bonusDays: 5 }, // 5% de réduction
    { id: '6', name: '6 mois', months: 6, discount: 0.10, bonusDays: 9 }, // 10% de réduction
    { id: '12', name: '1 an', months: 12, discount: 0.20, bonusDays: 14 }  // 20% de réduction
  ] as const;
  
  // Types pour la cohérence
  export type PlanId = keyof typeof PLAN_PRICES;
  export type BillingPeriodId = typeof BILLING_PERIODS[number]['id'];
  
  // Fonction utilitaire pour calculer le prix avec réduction
  export const calculateDiscountedPrice = (
    basePrice: number, 
    months: number, 
    discount: number
  ): number => {
    const totalBeforeDiscount = basePrice * months;
    const discountAmount = Math.round(totalBeforeDiscount * discount);
    return Math.round(totalBeforeDiscount - discountAmount);
  };
  
  // Fonction pour formater le prix en FCFA
  export const formatPrice = (priceInCentimes: number): string => {
    return (priceInCentimes / 100).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' FCFA';
  };
  
  // Détails complets des plans
  export const PLAN_DETAILS = {
    standard: {
      id: 'standard' as const,
      name: 'Standard',
      description: 'Pour les créateurs de contenu et les petites entreprises',
      price: PLAN_PRICES.standard,
      features: [
        'Jusqu\'à 10 000 clics/mois',
        'Liens personnalisés',
        'Statistiques avancées',
        'QR Codes personnalisables',
        'Support par email',
        'Jusqu\'à 5 membres d\'équipe'
      ],
      popular: false,
      badge: 'Populaire'
    },
    pro: {
      id: 'pro' as const,
      name: 'Pro',
      description: 'Pour les entreprises en croissance',
      price: PLAN_PRICES.pro,
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
      popular: true,
      badge: 'Meilleure offre'
    },
    enterprise: {
      id: 'enterprise' as const,
      name: 'Entreprise',
      description: 'Pour les entreprises avec des besoins avancés',
      price: PLAN_PRICES.enterprise,
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
      popular: false,
      badge: 'Sur mesure'
    }
  } as const;
  
  // Fonction pour mapper les plans aux rôles utilisateur
  export const mapPlanToUserRole = (planId: string): 'STANDARD' | 'PRO' | 'ENTERPRISE' => {
    switch (planId.toLowerCase()) {
      case 'standard':
        return 'STANDARD';
      case 'pro':
        return 'PRO';
      case 'enterprise':
        return 'ENTERPRISE';
      default:
        return 'STANDARD';
    }
  };
  
  // Fonction pour obtenir les plans disponibles selon le rôle actuel
  export const getAvailablePlans = (currentRole: string, isRenewal: boolean = false) => {
    const allPlans = Object.values(PLAN_DETAILS).map(plan => ({
      ...plan,
      isCurrent: currentRole === mapPlanToUserRole(plan.id)
    }));
  
    // Si c'est un renouvellement, montrer seulement le plan actuel
    if (isRenewal) {
      return allPlans.filter(plan => plan.isCurrent);
    }
  
    // Filtrer selon le rôle actuel
    switch(currentRole) {
      case 'FREE':
        return allPlans;
      case 'STANDARD':
        return allPlans.filter(plan => plan.id !== 'standard');
      case 'PRO':
        return allPlans.filter(plan => plan.id === 'enterprise');
      case 'ENTERPRISE':
        return allPlans.filter(plan => plan.id === 'enterprise');
      default:
        return allPlans;
    }
  };
  
  // Fonction pour calculer le prix attendu côté serveur
  export const calculateExpectedPrice = (
    planId: PlanId, 
    billingPeriodMonths: number, 
    discountPercent: number
  ) => {
    const basePrice = PLAN_PRICES[planId];
    const totalBeforeDiscount = basePrice * billingPeriodMonths;
    const discountAmount = Math.round(totalBeforeDiscount * discountPercent);
    const finalAmount = totalBeforeDiscount - discountAmount;
    
    return {
      basePrice,
      totalBeforeDiscount,
      discountAmount,
      finalAmount
    };
  };