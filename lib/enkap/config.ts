// lib/enkap/config.ts
// Configuration centralisée pour l'API E-nkap

const getEnv = (key: string, fallback: string = ''): string => {
  // Sur le serveur, utilisez process.env
  const value = process.env[key] ?? fallback;

  if (!value && (key === 'ENKAP_CONSUMER_KEY' || key === 'ENKAP_CONSUMER_SECRET')) {
    console.error(`[CONFIG ERROR] Variable d'environnement manquante : ${key}`);
  }

  return value;
};

interface EnkapConfig {
  // URLs de l'API E-nkap
  TOKEN_URL: string;
  API_BASE_URL: string;
  
  // Authentification
  CONSUMER_KEY: string;
  CONSUMER_SECRET: string;
  
  // URLs de retour et de notification
  RETURN_URL: string;
  NOTIFICATION_URL: string;
  
  // Configuration des timeouts
  REQUEST_TIMEOUT: number;
  
  // Endpoints
  ENDPOINTS: {
    ORDER: string;
    ORDER_STATUS: string;
    ORDER_DETAILS: string;
    SETUP: string;
  };
}

export const ENKAP_CONFIG: EnkapConfig = {
  // URLs de l'API E-nkap (environnement de staging)
  TOKEN_URL: getEnv('ENKAP_TOKEN_URL', 'https://api.enkap-staging.maviance.info/token'),
  API_BASE_URL: getEnv('ENKAP_API_BASE_URL', 'https://api.enkap-staging.maviance.info/purchase/v1.2/api'),

  // Authentification E-nkap (OAuth2 Client Credentials)
  CONSUMER_KEY: getEnv('ENKAP_CONSUMER_KEY', ''),
  CONSUMER_SECRET: getEnv('ENKAP_CONSUMER_SECRET', ''),

  // URLs de retour et de notification
  RETURN_URL: getEnv('NEXTAUTH_URL', 'http://localhost:3000') + '/payment/callback',
  NOTIFICATION_URL: getEnv('NEXTAUTH_URL', 'http://localhost:3000') + '/api/v1/payment/enkap/notify',

  // Configuration des timeouts
  REQUEST_TIMEOUT: 45000, // 45 secondes

  // Endpoints
  ENDPOINTS: {
    ORDER: '/order',
    ORDER_STATUS: '/order/status',
    ORDER_DETAILS: '/order',
    SETUP: '/order/setup'
  }
} as const;

// Types de paiement supportés par E-nkap dans notre application
export const ENKAP_PAYMENT_METHODS = {
  VISA: {
    id: 'visa',
    name: 'Carte VISA',
    logo: '/logos/visa.svg',
    type: 'card'
  },
  MASTERCARD: {
    id: 'mastercard',
    name: 'MasterCard',
    logo: '/logos/mastercard.svg',
    type: 'card'
  },
  // Ajoutez d'autres cartes ici si nécessaire
  // Exemple pour ajouter une autre carte :
  // AMEX: {
  //   id: 'amex',
  //   name: 'American Express',
  //   logo: '/logos/amex.svg',
  //   type: 'card'
  // }
} as const;
