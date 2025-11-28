
const getEnv = (key: string, fallback: string = ''): string => {
  if (typeof window !== 'undefined') {
   
    return (window as any)._env_?.[key] ?? fallback;
  }
  
  const value = process.env[key] ?? fallback;
  
  if ((key === 'S3P_ACCESS_TOKEN' || key === 'S3P_ACCESS_SECRET') && !value) {
    console.error(`[CONFIG ERROR] Missing required environment variable: ${key}`);
    console.error('Available environment variables:', Object.keys(process.env).sort());
  }
  
  return value;
};

export const BILLING_DISCOUNTS = {
  1: { discount: 0, bonusDays: 3 },    
  3: { discount: 0.05, bonusDays: 5 }, 
  6: { discount: 0.10, bonusDays: 9 }, 
  12: { discount: 0.20, bonusDays: 14 } 
} as const;
export const SUBSCRIPTION_PRICES = {
  
  STANDARD: {
    monthly: 100,
    name: 'Standard',
    description: 'Pour les créateurs de contenu et les petites entreprises'
  },
  PRO: {
    monthly: 100,
    name: 'Pro', 
    description: 'Pour les entreprises en croissance'
  },
  ENTERPRISE: {
    monthly: 100,
    name: 'Entreprise',
    description: 'Pour les entreprises avec des besoins avancés'
  }
} as const;

export const calculateSubscriptionPrice = (
  planId: keyof typeof SUBSCRIPTION_PRICES,
  durationMonths: 1 | 3 | 6 | 12
): {
  basePrice: number;
  totalBeforeDiscount: number;
  discountAmount: number;
  finalAmount: number;
  bonusDays: number;
  discount: number;
} => {
  const plan = SUBSCRIPTION_PRICES[planId];
  const billing = BILLING_DISCOUNTS[durationMonths];
  
  const basePrice = plan.monthly;
  const totalBeforeDiscount = basePrice * durationMonths;
  const discountAmount = Math.round(totalBeforeDiscount * billing.discount);
  const finalAmount = totalBeforeDiscount - discountAmount;
  
  return {
    basePrice,
    totalBeforeDiscount,
    discountAmount,
    finalAmount,
    bonusDays: billing.bonusDays,
    discount: billing.discount
  };
};
export const formatPrice = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0 FCFA';
  }
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) + ' FCFA';
};


export const S3P_CONFIG = {
  
  SUBSCRIPTION_PRICES: {
    BASIC: 5000,    
    STANDARD: 10000, 
    PREMIUM: 20000,  
  },
  REQUEST_TIMEOUT: 60000,
  
  BASE_URL: process.env.S3P_BASE_URL || 'https://api.s3p.smobilpay.com/v2',
  
  API_BASE_URL: process.env.S3P_BASE_URL || 'https://api.s3p.smobilpay.com/v2',
  
  ACCESS_TOKEN: process.env.S3P_ACCESS_TOKEN || '',
  ACCESS_SECRET: process.env.S3P_ACCESS_SECRET || '',
  
  API_KEY: process.env.S3P_API_KEY || '',
  
  API_SECRET: process.env.S3P_API_SECRET || '',
  
  MERCHANT_ID: process.env.S3P_MERCHANT_ID || '',
  
  FRONTEND_BASE_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  
  TIMEOUT: 30000, 
  RETRY_DELAY: 5000, 
  MAX_RETRIES: 3,
  ENDPOINTS: {
    VERIFY: '/verify', 
    
  },
  
  WEBHOOK_SECRET: process.env.S3P_WEBHOOK_SECRET || '',
  
  DEBUG: process.env.NODE_ENV === 'development',
  
  PAYMENT_ATTEMPTS: 3,
  PAYMENT_RETRY_DELAY: 60000, 
  
  
  FEE_PERCENTAGE: 1.5, 
  FIXED_FEE: 100, 
  
  
  MIN_AMOUNT: 100, 
  MAX_AMOUNT: 500000, 
  
  
  SUPPORTED_CURRENCIES: ['XAF', 'XOF'],
  
  
  calculateSubscriptionPrice(plan: string, durationMonths: number) {
    const basePrice = this.SUBSCRIPTION_PRICES[plan as keyof typeof this.SUBSCRIPTION_PRICES] || 0;
    const totalBeforeDiscount = basePrice * durationMonths;
    
    
    let discount = 0;
    if (durationMonths >= 12) {
      discount = 0.2; 
    } else if (durationMonths >= 6) {
      discount = 0.15; 
    } else if (durationMonths >= 3) {
      discount = 0.1; 
    }
    
    const discountAmount = Math.round(totalBeforeDiscount * discount);
    const finalAmount = totalBeforeDiscount - discountAmount;
    
    const bonusDays = durationMonths >= 12 ? 7 : 0;
    
    return {
      basePrice,
      totalBeforeDiscount,
      discountAmount,
      finalAmount,
      bonusDays,
      discount: discount * 100, 
    };
  },

  services: {
    'mtn-mobile-money': 1,
    'orange-money': 2, 
    'express-union': 3
  },
  currencies: {
    XAF: 'XAF'
  },
  
  formatPrice(amount: number | undefined | null): string {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '0 FCFA';
    }
    return amount.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' FCFA';
  },
  
  
  getAvailablePlans(currentRole: string) {
    const plans = [
      {
        id: 'basic',
        name: 'Basique',
        price: this.SUBSCRIPTION_PRICES.BASIC,
        description: 'Accès aux fonctionnalités de base',
        features: [
          'Fonctionnalité 1',
          'Fonctionnalité 2',
          'Support par email'
        ],
        isCurrent: currentRole === 'BASIC',
        isUpgrade: ['FREE'].includes(currentRole),
        isDowngrade: ['STANDARD', 'PREMIUM'].includes(currentRole)
      },
      {
        id: 'standard',
        name: 'Standard',
        price: this.SUBSCRIPTION_PRICES.STANDARD,
        description: 'Accès aux fonctionnalités avancées',
        features: [
          'Toutes les fonctionnalités Basique',
          'Fonctionnalité 3',
          'Support prioritaire',
          'Analyses avancées'
        ],
        isCurrent: currentRole === 'STANDARD',
        isUpgrade: ['FREE', 'BASIC'].includes(currentRole),
        isDowngrade: ['PREMIUM'].includes(currentRole)
      },
      {
        id: 'premium',
        name: 'Premium',
        price: this.SUBSCRIPTION_PRICES.PREMIUM,
        description: 'Accès à toutes les fonctionnalités',
        features: [
          'Toutes les fonctionnalités Standard',
          'Fonctionnalité 4',
          'Support 24/7',
          'Accès anticipé aux nouvelles fonctionnalités',
          'Configuration personnalisée'
        ],
        isCurrent: currentRole === 'PREMIUM',
        isUpgrade: ['FREE', 'BASIC', 'STANDARD'].includes(currentRole),
        isDowngrade: false
      }
    ];
    
    return plans;
  }
};