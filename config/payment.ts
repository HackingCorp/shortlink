/**
 * Configuration des paramètres de paiement
 * Centralise les valeurs et les constantes liées au paiement
 */

// Statuts de paiement considérés comme réussis
export const SUCCESS_STATUSES = [
  'success',
  'succeeded', 
  'completed',
  'approved',
  'true'
];

// Noms de paramètres alternatifs pour la rétrocompatibilité
export const PARAM_ALIASES = {
  status: ['status', 'payment_status', 'result'],
  planId: ['plan_id', 'plan'],
  paymentRef: ['payment', 'reference', 'payment_id', 'session_id']
};

// Paramètres à supprimer lors du nettoyage de l'URL
const CLEANUP_PARAMS = [
  'session_id',
  'payment_intent',
  'payment_id',
  'token',
  'signature',
  'redirect_status',
  'payment_intent_client_secret'
];
// config/payment.ts

type OperatorKey = 'mtn-mobile-money' | 'orange-money' | 'express-union';

export interface S3PServiceConfig {
  id: string;
  name: string;
  operatorId: string;
  logo: string;
  color: string;
  description: string;
  gateway: 's3p';
  type: 'mobile' | 'card' | 'other';
  isAvailable: boolean;
  processingTime: string;
}

export const S3P_SERVICES_CONFIG: Record<OperatorKey, S3PServiceConfig> = {
  'mtn-mobile-money': {
    id: 'mtn-mobile-money',
    name: 'MTN Mobile Money',
    operatorId: 'mtn',
    logo: '/logos/mtn-momo.svg',
    color: 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800',
    description: 'Paiement via votre compte Mobile Money',
    gateway: 's3p',
    type: 'mobile',
    isAvailable: true,
    processingTime: 'Immédiat',
  },
  'orange-money': {
    id: 'orange-money',
    name: 'Orange Money',
    operatorId: 'orange',
    logo: '/logos/orange-money.svg',
    color: 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800',
    description: 'Paiement via votre compte Orange Money',
    gateway: 's3p',
    type: 'mobile',
    isAvailable: true,
    processingTime: 'Immédiat',
  },
  'express-union': {
    id: 'express-union',
    name: 'Express Union Mobile',
    operatorId: 'eu',
    logo: '/logos/express-union.svg',
    color: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
    description: 'Paiement via votre compte Express Union Mobile',
    gateway: 's3p',
    type: 'mobile',
    isAvailable: true,
    processingTime: 'Immédiat',
  },
} as const;

// Type guard to check if a key is a valid operator key
export function isOperatorKey(key: string): key is OperatorKey {
  return key in S3P_SERVICES_CONFIG;
}

/**
 * Nettoie les paramètres d'URL pour ne garder que ceux nécessaires
 */
export function cleanUrlParams(params: URLSearchParams): URLSearchParams {
  const cleanParams = new URLSearchParams();
  
  // Garder uniquement les paramètres importants
  if (params.get('plan_id') || params.get('plan')) {
    cleanParams.set('plan_id', params.get('plan_id') || params.get('plan') || '');
  }
  
  if (params.get('status')) {
    cleanParams.set('status', params.get('status') || '');
  }
  
  return cleanParams;
}

/**
 * Extrait les paramètres de paiement d'un objet URLSearchParams
 */
export function extractPaymentParams(params: URLSearchParams) {
  const getFirstMatchingParam = (names: string[]) => {
    for (const name of names) {
      const value = params.get(name);
      if (value) return value;
    }
    return null;
  };

  const status = getFirstMatchingParam(PARAM_ALIASES.status);
  const planId = getFirstMatchingParam(PARAM_ALIASES.planId);
  const paymentRef = getFirstMatchingParam(PARAM_ALIASES.paymentRef);
  
  const isSuccess = status ? SUCCESS_STATUSES.includes(status.toLowerCase()) : false;
  
  return {
    status,
    planId,
    paymentRef,
    isSuccess,
    hasPlan: !!planId,
    hasStatus: !!status
  };
}

/**
 * Nettoie l'URL en supprimant les paramètres sensibles
 */
export function cleanPaymentUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const cleanParams = cleanUrlParams(urlObj.searchParams);
    
    // Construire la nouvelle URL avec les paramètres nettoyés
    urlObj.search = cleanParams.toString();
    return urlObj.toString();
  } catch (error) {
    console.error('Erreur lors du nettoyage de l\'URL:', error);
    return url;
  }
}
