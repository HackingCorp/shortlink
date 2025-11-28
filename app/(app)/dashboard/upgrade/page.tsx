'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotifications } from '@/context/NotificationContext';
import { 
  CheckCircle2, 
  ArrowLeft, 
  Smartphone, 
  CreditCard, 
  Phone, 
  User, 
  Building, 
  Shield, 
  Clock,
  Smartphone as MobileIcon,
  CreditCard as CardIcon
} from 'lucide-react';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useNotification } from '@/hooks/useNotification';
import { handleS3PCashout } from '@/lib/s3p/mobileWalletService';
import { SUBSCRIPTION_PRICES, calculateSubscriptionPrice, formatPrice, BILLING_DISCOUNTS } from '@/lib/s3p/config';
import { toast } from 'react-hot-toast';
interface PaymentMethod {
  id: string;
  name: string;
  logo: string;
  color: string;
  description: string;
  gateway: 's3p' | 'enkap';
  type: 'mobile' | 'card' | 'other';
  isAvailable?: boolean;
  processingTime?: string;
}

interface PlanInfo {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  isCurrent: boolean;
  popular: boolean;
  badge?: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  subscription?: {
    plan: string;
    expiresAt: string | null;
    status: string;
  };
}
type PaymentStatus = 'idle' | 'pending' | 'processing' | 'success' | 'failed';
type PaymentStep = 'plan' | 'method' | 'details' | 'processing';
const S3P_SERVICES_CONFIG = {
  'orange-money': {
    serviceId: '30053',
    merchant: 'CMORANGEOM',
    payItemId: 'S-112-949-CMORANGEOM-30053-2006125105-1',
    name: 'Orange Money'
  },
  'express-union': {
    serviceId: '90010',
    merchant: 'EUCASHOUT',
    payItemId: 'S-112-949-EUCASHOUT-90010-900080-1',
    name: 'Express Union Mobile'
  },
  'mtn-mobile-money': {
    serviceId: ' 20053',
    merchant: 'MTNMOMO',
    payItemId: 'S-112-949-MTNMOMO-20053-200050001-1',
    name: 'MTN Mobile Money'
  }
} as const;

type OperatorKey = keyof typeof S3P_SERVICES_CONFIG;
const ALL_PAYMENT_METHODS: PaymentMethod[] = [
  // Mobile Money - S3P
  {
    id: 'mtn-mobile-money',
    name: 'MTN Mobile Money',
    logo: '/logos/mtn-momo.svg',
    color: 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800',
    description: 'Paiement via votre compte Mobile Money',
    gateway: 's3p',
    type: 'mobile',
    isAvailable: true,
    processingTime: 'Immédiat'
  },
  {
    id: 'orange-money',
    name: 'Orange Money',
    logo: '/logos/orange-money.svg',
    color: 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800',
    description: 'Paiement via votre compte Orange Money',
    gateway: 's3p',
    type: 'mobile',
    isAvailable: true,
    processingTime: 'Immédiat'
  },
  {
    id: 'express-union',
    name: 'Express Union Mobile',
    logo: '/logos/express-union.svg',
    color: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
    description: 'Paiement via votre compte Express Union Mobile',
    gateway: 's3p',
    type: 'mobile',
    isAvailable: true,
    processingTime: 'Immédiat'
  },
    // Mobile Money - ENKAP (nouveaux)
    {
      id: 'mtn-mobile-money-enkap',
      name: 'MTN Mobile Money',
      logo: '/logos/mtn-momo.svg',
      color: 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700',
      description: 'Paiement sécurisé via MTN Mobile Money',
      gateway: 'enkap',
      type: 'mobile',
      isAvailable: true,
      processingTime: 'Immédiat'
    },
    {
      id: 'orange-money-enkap',
      name: 'Orange Money',
      logo: '/logos/orange-money.svg',
      color: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
      description: 'Paiement sécurisé via Orange Money',
      gateway: 'enkap',
      type: 'mobile',
      isAvailable: true,
      processingTime: 'Immédiat'
    },
    {
      id: 'express-union-enkap',
      name: 'Express Union Mobile',
      logo: '/logos/express-union.svg',
      color: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
      description: 'Paiement sécurisé via Express Union Mobile',
      gateway: 'enkap',
      type: 'mobile',
      isAvailable: true,
      processingTime: 'Immédiat'
    },
  {
    id: 'carte-bancaire',
    name: 'Carte bancaire',
    logo: '/logos/credit-card.svg',
    color: 'bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800',
    description: 'Paiement sécurisé par carte VISA, Mastercard ou autre',
    gateway: 'enkap',
    type: 'card',
    isAvailable: true,
    processingTime: '2-3 minutes'
  }
];

const BILLING_PERIODS = [
  { id: '1', name: '1 mois', months: 1, description: 'Facturation mensuelle' },
  { id: '3', name: '3 mois', months: 3, description: 'Économisez 10%' },
  { id: '6', name: '6 mois', months: 6, description: 'Économisez 15%' },
  { id: '12', name: '1 an', months: 12, description: 'Économisez 25%' }
];

const calculateDaysRemaining = (expiresAt: string | null): number => {
  if (!expiresAt) return 0;
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffTime = expires.getTime() - now.getTime();
  return diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;
};

const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('237')) return cleaned;
  if (cleaned.startsWith('6') || cleaned.startsWith('2')) return `237${cleaned}`;
  return cleaned;
};

const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 9 && cleaned.length <= 12;
};

const getAvailablePlans = (currentRole: string, isRenewal: boolean = false): PlanInfo[] => {
  const allPlans: PlanInfo[] = Object.entries(SUBSCRIPTION_PRICES).map(([key, plan]) => ({
    id: key.toLowerCase(),
    name: plan.name,
    price: plan.monthly,
    description: plan.description,
    features: getFeaturesByPlan(key.toLowerCase()),
    isCurrent: currentRole === key,
    popular: key === 'PRO',
    badge: key === 'PRO' ? 'Populaire' : key === 'ENTERPRISE' ? 'Premium' : undefined
  }));

  if (isRenewal) {
    return allPlans.filter(plan => plan.isCurrent);
  }

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

const getFeaturesByPlan = (planId: string): string[] => {
  const features = {
    standard: [
      'Jusqu\'à 10 000 clics/mois',
      'Liens personnalisés',
      'Statistiques avancées',
      'QR Codes personnalisables',
      'Support par email',
      'Jusqu\'à 5 membres d\'équipe'
    ],
    pro: [
      'Jusqu\'à 50 000 clics/mois',
      'Toutes les fonctionnalités Standard',
      'Jusqu\'à 15 membres d\'équipe',
      'API complète',
      'Support prioritaire',
      'Export de données',
      'Domaines personnalisés',
      'A/B Testing'
    ],
    enterprise: [
      'Volume illimité de liens et clics',
      'Toutes les fonctionnalités Pro',
      'Jusqu\'à 50 membres d\'équipe',
      'Gestion des rôles avancée',
      'Support prioritaire 24/7',
      'Domaines personnalisés illimités',
      'Intégrations personnalisées',
      'SLA 99.9% avec support dédié'
    ]
  };
  return features[planId as keyof typeof features] || [];
};

const LoadingSpinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className="flex justify-center items-center">
      <div className={`animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 ${sizeClasses[size]}`}></div>
    </div>
  );
};

// Enhanced Plan Card Component
const PlanCard = ({ 
  plan, 
  currentPeriod, 
  onSelect, 
  isSelected = false 
}: { 
  plan: PlanInfo; 
  currentPeriod: any; 
  onSelect: () => void;
  isSelected?: boolean;
}) => {
  const planKey = plan.id.toUpperCase() as keyof typeof SUBSCRIPTION_PRICES;
  const pricing = calculateSubscriptionPrice(planKey, currentPeriod.months as 1 | 3 | 6 | 12) || {
    baseAmount: 0,
    finalAmount: 0,
    discount: 0,
    discountAmount: 0,
    bonusDays: 0
  };

  return (
    <div className={`relative rounded-2xl border-2 transition-all duration-300 hover:shadow-xl group ${
      plan.popular 
        ? 'border-indigo-500 transform scale-[1.02] shadow-lg bg-gradient-to-b from-white to-indigo-50' 
        : isSelected
        ? 'border-indigo-400 bg-indigo-50'
        : 'border-gray-200 bg-white hover:border-indigo-300'
    }`}>
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
            {plan.badge}
          </span>
        </div>
      )}
      
      <div className="p-8">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
          <p className="text-gray-600 mb-4">{plan.description}</p>
          
          <div className="mb-4">
            <div className="text-4xl font-extrabold text-gray-900 mb-1">
              {pricing?.finalAmount !== undefined ? formatPrice(pricing.finalAmount) : '0 FCFA'}
              <span className="text-lg font-medium text-gray-500 ml-1">
                / {currentPeriod?.name?.toLowerCase() || 'mois'}
              </span>
            </div>
            
            {pricing?.discount > 0 && (
              <div className="flex items-center justify-center space-x-2">
                <span className="text-sm text-gray-400 line-through">
                  {formatPrice(pricing?.basePrice)}
                </span>
                <span className="text-sm font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  Économisez {formatPrice(pricing?.discountAmount)}
                </span>
              </div>
            )}
          </div>
        </div>

        <ul className="space-y-3 mb-8 text-sm">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
              <span className="text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={onSelect}
          className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 ${
            plan.popular
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          {plan.isCurrent ? 'Renouveler ce plan' : 'Choisir ce plan'}
        </button>
      </div>
    </div>
  );
};

const PaymentMethodCard = ({ 
  method, 
  onSelect,
  disabled = false 
}: { 
  method: PaymentMethod; 
  onSelect: () => void;
  disabled?: boolean;
}) => (
  <button
    onClick={onSelect}
    disabled={disabled || !method.isAvailable}
    className={`group relative rounded-2xl p-6 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${method.color} ${
      disabled ? 'cursor-not-allowed' : 'cursor-pointer'
    }`}
  >
    {!method.isAvailable && (
      <div className="absolute inset-0 bg-gray-900 bg-opacity-50 rounded-2xl flex items-center justify-center">
        <span className="text-white font-medium">Bientôt disponible</span>
      </div>
    )}
    
    <div className="flex flex-col items-center text-center">
      <div className="h-16 w-16 mb-4 flex items-center justify-center bg-white bg-opacity-20 rounded-xl">
        <img src={method.logo} alt={method.name} className="h-10 w-auto object-contain" />
      </div>
      
      <h3 className="text-lg font-bold text-white mb-2">{method.name}</h3>
      <p className="text-sm text-white opacity-90 mb-2">{method.description}</p>
      
      {method.processingTime && (
        <div className="flex items-center text-xs text-white opacity-75">
          <Clock className="h-3 w-3 mr-1" />
          {method.processingTime}
        </div>
      )}
    </div>
  </button>
);

// Main Component
export default function UpgradePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <Suspense fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      }>
        <UpgradeContent />
      </Suspense>
    </main>
  );
}

function UpgradeContent() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dismissNotification } = useNotifications();
  // State management
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1');
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('plan');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isPlanExpired = searchParams.get('expired') === 'true';
  const isRenewalMode = searchParams.get('mode') === 'renewal';

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    
    if ((selectedMethod?.type === 'mobile' || selectedMethod?.type === 'other')) {
      if (!customerName.trim()) {
        newErrors.customerName = 'Le nom est requis';
      }
      
      if (!customerPhone.trim()) {
        newErrors.customerPhone = 'Le numéro de téléphone est requis';
      } else if (!validatePhoneNumber(customerPhone)) {
        newErrors.customerPhone = 'Numéro de téléphone invalide';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [customerName, customerPhone, selectedMethod]);

  // Effects
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!session?.user) return;
      
      try {
        const response = await fetch('/api/user/profile');
        const data = await response.json();
        
        if (data.success) {
          setUserInfo(data.data.user);
          setCustomerName(data.data.user.name || session.user.name || '');
        }
      } catch (error) {
        console.error('Erreur lors du chargement des informations utilisateur:', error);
        toast.error('Erreur lors du chargement des informations utilisateur');
      }
    };
    
    fetchUserInfo();
  }, [session]);

  const { error: notifyError, success: notifySuccess, loading: notifyLoading } = useNotification();

  useEffect(() => {
    if (isPlanExpired) {
      notifyError(
        'Votre abonnement a expiré. Veuillez renouveler pour continuer.',
        { autoClose: 10000 }
      );
    }
  }, [isPlanExpired, notifyError]);

const handlePayment = async (method: PaymentMethod) => {
  if (!selectedPlan) {
    notifyError('Veuillez sélectionner un plan avant de continuer');
    return;
  }

  // VALIDATION
  const phoneToUse = customerPhone;
  const formattedPhone = formatPhoneNumber(phoneToUse);
  
  if ((method.type === 'mobile' || method.gateway === 's3p') && (!phoneToUse || !validatePhoneNumber(phoneToUse))) {
    setErrors(prev => ({ ...prev, phone: 'Veuillez entrer un numéro de téléphone valide' }));
    notifyError('Numéro de téléphone invalide');
    return;
  }

  // CALCUL DU MONTANT
  const pricing = calculateSubscriptionPrice(
    selectedPlan.toUpperCase() as keyof typeof SUBSCRIPTION_PRICES, 
    currentPeriod.months as 1 | 3 | 6 | 12
  );

  const loadingId = notifyLoading('Traitement de votre paiement en cours...');
  setIsProcessing(true);

  try {
    const basePaymentData = {
      planId: selectedPlan,
      durationMonths: parseInt(selectedPeriod),
      customerName: customerName || session?.user?.name || '',
      customerPhone: formattedPhone,
      customerEmail: session?.user?.email || '',
      paymentMethod: method.id,
      amount: pricing.finalAmount,
      currency: 'XAF'
    };

    let result;

    const savePaymentData = (paymentData: any) => {
      localStorage.setItem('lastPayment', JSON.stringify({
        transactionId: paymentData.ptn || paymentData.transactionId,
        paymentMethod: paymentData.paymentMethod,
        amount: paymentData.amount,
        currency: paymentData.currency,
        planName: selectedPlan,
        duration: currentPeriod.name,
        durationMonths: currentPeriod.months,
        customerEmail: session?.user?.email,
        customerName: session?.user?.name,
        timestamp: new Date().toISOString()
      }));
    };
if (method.gateway === 's3p') {
  // PAIEMENT S3P (Mobile Money) - 3 ÉTAPES
  console.log('[Payment] Début paiement S3P pour:', method.name);
  const operatorConfig = S3P_SERVICES_CONFIG[method.id as OperatorKey];
  if (!operatorConfig) {
    throw new Error(`Configuration non trouvée pour l'opérateur: ${method.id}`);
  }

  // ÉTAPE 1: Récupérer les packages
  const s3pPackageParams = {
    step: 'getPackages' as const,
    serviceId: Number(operatorConfig.serviceId), 
    amount: pricing.finalAmount,
    currency: 'XAF',
    customer: {
      id: session?.user?.id || 'unknown',
      name: customerName || session?.user?.name || '',
      email: session?.user?.email || '',
      phone: formattedPhone,
    }
  };

  console.log('[Payment S3P] Étape 1 - Récupération packages:', s3pPackageParams);
  const packagesResult = await handleS3PCashout(s3pPackageParams);

  if (!packagesResult.success) {
    throw new Error(packagesResult.error || 'Échec de la récupération des packages S3P');
  }

  if (!packagesResult.data?.packages || packagesResult.data.packages.length === 0) {
    throw new Error('Aucun package de paiement disponible pour cet opérateur');
  }

  const packageInfo = packagesResult.data.packages[0];
  console.log('[Payment S3P] Package sélectionné:', packageInfo);

  // ÉTAPE 2: Créer un devis
  const quoteParams = {
    step: 'createQuote' as const,
    serviceId: operatorConfig.payItemId,
    amount: pricing.finalAmount,
    currency: 'XAF',
    customer: {
      id: session?.user?.id || 'unknown',
      name: customerName || session?.user?.name || '',
      email: session?.user?.email || '',
      phone: formattedPhone,
    }
  };

  console.log('[Payment S3P] Étape 2 - Création devis:', quoteParams);
  const quoteResult = await handleS3PCashout(quoteParams);

  if (!quoteResult.success) {
    console.error('[Payment S3P] Erreur création devis:', quoteResult.error);
    throw new Error(quoteResult.error || 'Échec de la création du devis');
  }

  let quoteId = quoteResult.data?.quoteId || quoteResult.quoteId;
  console.log('[Payment S3P] QuoteId final:', quoteId);

  // ÉTAPE 3: Collecter le paiement
  const collectParams = {
    step: 'collect' as const,
    quoteId: quoteId, 
    serviceNumber: formattedPhone,
    transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount: pricing.finalAmount,
    currency: 'XAF',
    serviceId: operatorConfig.payItemId,
    customer: {
      id: formattedPhone,
      name: customerName || session?.user?.name || 'Client', 
      email: session?.user?.email || '',
      phone: formattedPhone,
    }
  };

  console.log('[Payment S3P] Étape 3 - Collecte paiement:', collectParams);
  
  result = await handleS3PCashout(collectParams);

  console.log('[Payment S3P] Réponse finale:', result);

} else if (method.gateway === 'enkap') {
  
  console.log('[Payment] Début paiement Enkap ');

  const enkapParams = {
    ...basePaymentData,
    returnUrl: `${window.location.origin}/dashboard/upgrade/confirmation?status=success`,
    cancelUrl: `${window.location.origin}/dashboard/upgrade?status=cancelled`,
    notificationUrl: `${window.location.origin}/api/v1/payment/enkap/webhook`,
  };

  console.log('[Payment Enkap] Données envoyées:', enkapParams);
  
  const response = await fetch('/api/v1/payment/enkap/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(enkapParams),
  });

  const data = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Échec de l\'initialisation du paiement Enkap');
  }

  result = data;
  console.log('[Payment Enkap] Réponse:', result);
}
    if (method.gateway === 's3p') {
      // GESTION RÉPONSE S3P
      if (result.data?.ptn) {
        savePaymentData({
          ptn: result.data.ptn,
          paymentMethod: method.id,
          amount: pricing.finalAmount,
          currency: 'XAF'
        });
        // Succès - transaction créée
        notifySuccess('Paiement Mobile Money initié. Vérification en cours...');
        setPaymentStep('processing');
        await verifyS3PPaymentStatus(result.data.ptn);
        
      } else if (result.data?.paymentUrl) {
        notifySuccess('Redirection vers la passerelle de paiement...');
        window.location.href = result.data.paymentUrl;
        
      } else if (result.data?.status === 'PENDING') {
        notifySuccess('Paiement en attente de confirmation...');
        setPaymentStep('processing');
        
      } else {
        console.warn('[Payment S3P] Structure de réponse inattendue:', result);
        throw new Error('Réponse inattendue du service S3P');
      }

    } else if (method.gateway === 'enkap') {
      // GESTION RÉPONSE ENKAP
      if (result.paymentUrl || result.data?.paymentUrl) {
        savePaymentData({
          paymentMethod: method.id,
          amount: pricing.finalAmount,
          currency: 'XAF',
        });
        notifySuccess('Redirection vers la plateforme de paiement sécurisée...');
        window.location.href = result.paymentUrl || result.data.paymentUrl;
        
      } else if (result.status === 'PENDING' || result.status === 'success') {
        notifySuccess('Paiement en cours de traitement...');
        window.location.href = `${window.location.origin}/dashboard/upgrade/confirmation?status=pending`;
        
      } else {
        console.warn('[Payment Enkap] Structure de réponse inattendue:', result);
        throw new Error('Réponse inattendue du service Enkap');
      }
    }
    
  } catch (error) {
    console.error('Erreur lors du traitement du paiement:', error);
    
    let errorMessage = error instanceof Error ? error.message : 'Erreur inattendue';
    
    if (method.gateway === 's3p' ) {
      if (errorMessage.includes('Service not found') || errorMessage.includes('40602')) {
        errorMessage = `L'opérateur ${method.name} n'est pas disponible. Veuillez choisir un autre moyen de paiement.`;
      } else if (errorMessage.includes('quote') || errorMessage.includes('devis')) {
        errorMessage = 'Erreur lors de la préparation du paiement. Veuillez réessayer.';
      }
    } else if (method.gateway === 'enkap') {
      
        errorMessage = 'Erreur lors  du paiement. Vérifiez les informations et réessayez.';
      
    }
    
    notifyError(errorMessage, { title: 'Erreur de paiement' });
    setPaymentStep('details');
  } finally {
    setIsProcessing(false);
    if (typeof loadingId === 'string') {
     
      dismissNotification(loadingId);
    }
  }
};

  // Dans votre page.tsx - Version améliorée
const verifyS3PPaymentStatus = async (transactionId: string, attempts = 0) => {
  try {
    const response = await fetch(`/api/v1/payment/s3p/verify?transactionId=${transactionId}`);
    
    if (!response.ok) {
      // Si c'est une erreur 404, la transaction n'est pas encore trouvée (normale au début)
      if (response.status === 404) {
        console.log('[S3P Verify] Transaction non trouvée (encore en traitement)');
        
        if (attempts < 60) { // Maximum 60 tentatives (3 minutes)
          setTimeout(() => verifyS3PPaymentStatus(transactionId, attempts + 1), 3000);
          return;
        } else {
          notifyError('Délai de vérification dépassé. Le paiement est peut-être toujours en cours.');
          setPaymentStep('details');
          return;
        }
      }
      
      throw new Error(`Erreur ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    
    console.log('[S3P Verify] Statut:', data.status, 'Tentative:', attempts + 1);
    
    switch (data.status) {
      case 'SUCCESS':
        notifySuccess('Paiement confirmé !');
        
        router.push('/dashboard/upgrade/confirmation?status=success&transactionId=' + transactionId);
        break;
        
      case 'PENDING':
        if (attempts < 60) {
          setTimeout(() => verifyS3PPaymentStatus(transactionId, attempts + 1), 3000);
        } else {
          notifyError('Paiement toujours en attente après 3 minutes. Vérifiez manuellement.');
          setPaymentStep('details');
        }
        break;
        
      case 'FAILED':
      case 'CANCELLED':
        notifyError(`Paiement ${data.status.toLowerCase()}. Veuillez réessayer.`);
        setPaymentStep('details');
        break;
        
      default:
        console.warn('[S3P Verify] Statut inconnu:', data.status);
        if (attempts < 60) {
          setTimeout(() => verifyS3PPaymentStatus(transactionId, attempts + 1), 3000);
        } else {
          notifyError('Impossible de déterminer le statut du paiement.');
          setPaymentStep('details');
        }
    }
    
  } catch (error) {
    console.error('Erreur de vérification S3P:', error);
    
    if (attempts < 60) {
      setTimeout(() => verifyS3PPaymentStatus(transactionId, attempts + 1), 3000);
    } else {
      notifyError('Erreur de vérification du paiement.');
      setPaymentStep('details');
    }
  }
};
  
  // Fonction de vérification du statut
  const verifyPaymentStatus = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/v1/payment/s3p/verify?transactionId=${transactionId}`);
      const data = await response.json();
      
      if (data.status === 'SUCCESS') {
        notifySuccess('Paiement confirmé !');
        router.push('/dashboard/upgrade/confirmation?status=success');
      } else if (data.status === 'PENDING') {
       
        setTimeout(() => verifyPaymentStatus(transactionId), 5000);
      } else {
        notifyError('Paiement échoué');
        setPaymentStep('details');
      }
    } catch (error) {
      console.error('Erreur de vérification:', error);
    }
  };
  const currentPeriod = BILLING_PERIODS.find(p => p.id === selectedPeriod) || BILLING_PERIODS[0];
  const availablePlans = getAvailablePlans(session?.user?.role || 'FREE', isRenewalMode);

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mb-6">
            <Shield className="h-8 w-8 text-white" />
          </div>
          
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl lg:text-6xl mb-4">
            {isRenewalMode ? 'Renouveler votre abonnement' : 'Choisissez votre forfait'}
          </h1>
          
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600 leading-relaxed">
            Payez facilement avec Mobile Money, Carte Bancaire ou en agence.
            <br />
            <span className="text-indigo-600 font-medium">Paiement sécurisé et instantané.</span>
          </p>
        </div>

        {/* Plan Selection Step */}
        {paymentStep === 'plan' && (
          <>
            <div className="mb-12 flex justify-center">
              <div className="bg-white p-2 rounded-2xl shadow-lg border border-gray-100 inline-flex">
                {BILLING_PERIODS.map((period) => {
                  const discount = BILLING_DISCOUNTS[period.months as keyof typeof BILLING_DISCOUNTS];
                  return (
                    <button
                      key={period.id}
                      type="button"
                      onClick={() => setSelectedPeriod(period.id)}
                      className={`px-6 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                        selectedPeriod === period.id
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md transform scale-105'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-semibold">{period.name}</div>
                        {discount.discount > 0 && (
                          <div className="text-xs opacity-90">
                            {Math.round(discount.discount * 100)}% off
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
              {availablePlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  currentPeriod={currentPeriod}
                  onSelect={() => {
                    setSelectedPlan(plan.id);
                    setPaymentStep('method');
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Payment Method Selection Step */}
{paymentStep === 'method' && selectedPlan && (
  <div className="max-w-5xl mx-auto">
    <div className="flex items-center mb-8">
      <button
        onClick={() => setPaymentStep('plan')}
        className="text-gray-600 hover:text-gray-900 mr-4 p-3 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Retour à la sélection de plan"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
      <h2 className="text-3xl font-bold text-gray-900">
        Choisissez votre moyen de paiement
      </h2>
    </div>

    {/* Mobile Money Section - S3P */}
    <div className="mb-12">
      <div className="flex items-center mb-6">
        <Smartphone className="h-6 w-6 text-indigo-600 mr-3" />
        <h3 className="text-xl font-semibold text-gray-800">Mobile Money s3p</h3>
        <span className="ml-3 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
          Instantané
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ALL_PAYMENT_METHODS
          .filter(m => m.gateway === 's3p' && m.type === 'mobile')
          .map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              onSelect={() => {
                setSelectedMethod(method);
                setPaymentStep('details');
              }}
            />
          ))}
      </div>
    </div>
    {/* Paiements par Carte - ENKAP */}
    <div className="mb-12">
      <div className="flex items-center mb-6">
        <Smartphone className="h-6 w-6 text-indigo-600 mr-3" />
        <h3 className="text-xl font-semibold text-gray-800">Mobile Money Enkap</h3>
        <span className="ml-3 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
          Instantané
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ALL_PAYMENT_METHODS
          .filter(m => m.gateway === 'enkap' && m.type === 'mobile')
          .map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              onSelect={() => {
                setSelectedMethod(method);
                setPaymentStep('details');
              }}
            />
          ))}
      </div>
    </div>


    <div className="mb-12">
      <div className="flex items-center mb-6">
        <CreditCard className="h-6 w-6 text-green-600 mr-3" />
        <h3 className="text-xl font-semibold text-gray-800">Paiements par Carte</h3>
        <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
          Sécurisé
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ALL_PAYMENT_METHODS
          .filter(m => m.gateway === 'enkap'&& m.type === 'card' )
          .map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              onSelect={() => {
                setSelectedMethod(method);
                setPaymentStep('details');
              }}
            />
          ))}
      </div>
    </div>

    {/* Autres moyens de paiement - Section optionnelle pour d'autres gateways */}
    <div className="mb-12">
      <div className="flex items-center mb-6">
        <Building className="h-6 w-6 text-purple-600 mr-3" />
        <h3 className="text-xl font-semibold text-gray-800">Autres moyens de paiement</h3>
        <span className="ml-3 px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
          En agence
        </span>
      </div>
      
      <div className="bg-gray-50 rounded-2xl p-8 text-center">
        <p className="text-gray-600 mb-4">
          Paiement en espèces dans nos agences partenaires
        </p>
        <button className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-300 transition-colors">
          Voir les agences
        </button>
      </div>
    </div>
  </div>
)}


        {/* Payment Details Step */}
        {paymentStep === 'details' && selectedPlan && selectedMethod && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              {/* Payment Method Header */}
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mr-4">
                    <img 
                      src={selectedMethod.logo} 
                      alt={selectedMethod.name} 
                      className="h-8 w-auto object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Paiement via {selectedMethod.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedMethod.description}
                    </p>
                  </div>
                </div>
                <button
  onClick={() => handlePayment(selectedMethod)}
  disabled={isLoading}
  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-indigo-700 hover:to-purple-700 transform transition-all duration-200 hover:scale-105 focus:ring-4 focus:ring-indigo-200"
>
  {isLoading ? (
    <div className="flex items-center justify-center">
      <LoadingSpinner size="sm" />
      <span className="ml-2">Traitement en cours...</span>
    </div>
  ) : selectedMethod.gateway === 'enkap' ? (
    `Payer par carte avec ${selectedMethod.name}`
  ) : (
    `Payer avec ${selectedMethod.name}`
  )}
</button>
              </div>


              {/* Affiche les champs pour tous les paiements E-nkap ou les paiements S3P qui ne sont pas des cartes */
              (selectedMethod.gateway === 'enkap' || (selectedMethod.gateway === 's3p' && selectedMethod.type !== 'card')) && (
                <div className="space-y-6 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <User className="h-4 w-4 inline mr-2" />
                      Nom complet
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (errors.customerName) {
                          setErrors(prev => ({ ...prev, customerName: '' }));
                        }
                      }}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                        errors.customerName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="Entrez votre nom complet"
                    />
                    {errors.customerName && (
                      <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Phone className="h-4 w-4 inline mr-2" />
                      Numéro de téléphone
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          if (errors.customerPhone) {
                            setErrors(prev => ({ ...prev, customerPhone: '' }));
                          }
                        }}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
                          errors.customerPhone ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="237xxxxxxxx"
                      />
                    </div>
                    {errors.customerPhone ? (
                      <p className="mt-1 text-sm text-red-600">{errors.customerPhone}</p>
                    ) : (
                      <p className="mt-1 text-xs text-gray-500">
                        Format: 237xxxxxxxx ou 6xxxxxxxx
                      </p>
                    )}
                  </div>
                </div>
              )}
              {/* Dans la section Payment Details */}
              
{selectedMethod.type === 'card' && (
  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 p-6 mb-8 rounded-r-xl">
    <div className="flex items-start">
      <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
      <div>
        <h4 className="text-sm font-semibold text-blue-900 mb-1">
          Paiement sécurisé par carte
        </h4>
        <p className="text-sm text-blue-700">
          Vous serez redirigé vers la plateforme sécurisée Enkap pour finaliser votre paiement.
          Aucune information bancaire n'est stockée sur nos serveurs.
        </p>
      </div>
    </div>
  </div>
)}

{selectedMethod.gateway === 's3p' && (
  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400 p-6 mb-8 rounded-r-xl">
    <div className="flex items-start">
      <Smartphone className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
      <div>
        <h4 className="text-sm font-semibold text-green-900 mb-1">
          Paiement par Mobile Money
        </h4>
        <p className="text-sm text-green-700">
          Vous recevrez une demande de confirmation sur votre téléphone.
          Le paiement est instantané et sécurisé.
        </p>
      </div>
    </div>
  </div>
)}

              {/* Card Payment Info */}
              {selectedMethod.type === 'card' || selectedMethod.gateway === 'enkap' &&(
  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 p-6 mb-8 rounded-r-xl">
    <div className="flex items-start">
      <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
      <div>
        <h4 className="text-sm font-semibold text-blue-900 mb-1">
          Paiement sécurisé par Enkap
        </h4>
        <p className="text-sm text-blue-700">
        Vous recevrez une demande de confirmation sur votre téléphone.
        Le paiement est instantané et sécurisé.
        </p>
      </div>
    </div>
  </div>
)}


              {/* Order Summary */}
              <div className="bg-gray-50 rounded-xl p-6 mb-8">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Résumé de commande</h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Plan sélectionné</span>
                    <span className="font-medium">
                      {SUBSCRIPTION_PRICES[selectedPlan.toUpperCase() as keyof typeof SUBSCRIPTION_PRICES].name}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Durée</span>
                    <span className="font-medium">{currentPeriod.name}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Moyen de paiement</span>
                    <span className="font-medium">{selectedMethod.name}</span>
                  </div>
                  
                  {selectedMethod.processingTime && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Temps de traitement</span>
                      <span className="font-medium text-green-600">{selectedMethod.processingTime}</span>
                    </div>
                  )}
                  
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">Total à payer</span>
                      <span className="text-2xl font-bold text-indigo-600">
                        {formatPrice(calculateSubscriptionPrice(
                          selectedPlan.toUpperCase() as keyof typeof SUBSCRIPTION_PRICES, 
                          currentPeriod.months as 1 | 3 | 6 | 12
                        ).finalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Button */}
              <button
                onClick={() => handlePayment(selectedMethod)}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-indigo-700 hover:to-purple-700 transform transition-all duration-200 hover:scale-105 focus:ring-4 focus:ring-indigo-200"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Traitement en cours...</span>
                  </div>
                ) : (
                  `Payer avec ${selectedMethod.name}`
                )}
              </button>

              {/* Security Notice */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  <Shield className="h-4 w-4 inline mr-1" />
                  Paiement sécurisé et crypté
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {paymentStep === 'processing' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center border border-gray-100">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
              
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                Paiement en cours...
              </h3>
              
              <div className="space-y-3 text-gray-600">
                {selectedMethod?.gateway === 's3p' ? (
                  <>
                    <p className="text-lg">Veuillez vérifier votre téléphone</p>
                    <p className="text-sm">
                      Un code de confirmation vous a été envoyé par SMS.
                      Saisissez votre code PIN pour valider le paiement.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg">Redirection en cours...</p>
                    <p className="text-sm">
                      Vous allez être redirigé vers la page de paiement sécurisée.
                    </p>
                  </>
                )}
              </div>

              <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important :</strong> Ne fermez pas cette page pendant le traitement du paiement.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Back to Dashboard Button */}
        <div className="mt-16 flex justify-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
            disabled={paymentStep === 'processing'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </button>
        </div>

        {/* Support Section */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 mb-4">
            Besoin d'aide ? Contactez notre support
          </p>
          <div className="flex justify-center space-x-6 text-sm">
            <a href="mailto:support@votresite.com" className="text-indigo-600 hover:text-indigo-700">
              Email: support@votresite.com
            </a>
            <a href="tel:+237123456789" className="text-indigo-600 hover:text-indigo-700">
              Tél: +237 123 456 789
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
