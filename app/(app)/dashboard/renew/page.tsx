'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  Gift, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Smartphone,
  CreditCard,
  ArrowLeft,
  Check,
  X,
  Clock as ClockIcon,
  User,
  Phone,
  Shield
} from 'lucide-react';
import { useNotification } from '@/hooks/useNotification';
import toast from 'react-hot-toast';
import { handleS3PCashout } from '@/lib/s3p/mobileWalletService';
type PaymentStatus = 'idle' | 'pending' | 'processing' | 'success' | 'failed';
type PaymentStep = 'plan' | 'method' | 'details' | 'processing';
type Operator = 'mtn' | 'orange' | 'express-union' | 'unknown';

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

interface RenewalOption {
  duration: string;
  durationMonths: number;
  basePrice: number;
  discount: number;
  totalPrice: number;
  bonusDays: number;
  savings: number;
}

interface RenewalData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    planExpiresAt: string | null;
    daysRemaining: number;
  };
  renewal: {
    isEligibleForRenewal: boolean;
    isEarlyRenewal: boolean;
    options: RenewalOption[];
  };
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


const ALL_PAYMENT_METHODS: PaymentMethod[] = [
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
    serviceId: '20053',
    merchant: 'MTNMOMO',
    payItemId: 'S-112-949-MTNMOMO-20053-200050001-1',
    name: 'MTN Mobile Money'
  }
} as const;

type OperatorKey = keyof typeof S3P_SERVICES_CONFIG;

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

const formatPrice = (price: number): string => {
  return `${price.toLocaleString()} FCFA`;
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

// Composant Payment Method Card
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

export default function RenewalPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  

  const [renewalData, setRenewalData] = useState<RenewalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState<string>('1');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentStep, setCurrentStep] = useState<PaymentStep>('plan');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { error: notifyError, success: notifySuccess, loading: notifyLoading } = useNotification();

  // Validation des formulaires
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    
    if (selectedMethod?.type === 'mobile' || selectedMethod?.type === 'other') {
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

  useEffect(() => {
    const fetchRenewalData = async () => {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        const response = await fetch('/api/v1/subscription/renewal-info');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
          const renewalData: RenewalData = {
            user: {
              id: session.user.id,
              name: session.user.name || 'Utilisateur',
              email: session.user.email || '',
              role: result.data.subscription.role,
              planExpiresAt: result.data.subscription.planExpiresAt,
              daysRemaining: result.data.subscription.daysRemaining
            },
            renewal: {
              isEligibleForRenewal: result.data.renewal.isEligible,
              isEarlyRenewal: result.data.subscription.daysRemaining > 7,
              options: result.data.renewal.options.map((option: any) => ({
                duration: option.durationText,
                durationMonths: option.durationMonths,
                basePrice: option.basePrice,
                discount: option.discount,
                totalPrice: option.totalPrice,
                bonusDays: option.bonusDays,
                savings: option.savings
              }))
            }
          };
          
          setRenewalData(renewalData);
          
          if (result.data.renewal.recommendedDuration) {
            setSelectedDuration(result.data.renewal.recommendedDuration);
          }
          
        } else {
          throw new Error(result.error || 'Erreur inconnue');
        }
        
      } catch (error) {
        console.error('Erreur lors du chargement des options de renouvellement:', error);
        
        // Données de secours en cas d'erreur
        const fallbackData: RenewalData = {
          user: {
            id: session.user.id,
            name: session.user.name || 'Utilisateur',
            email: session.user.email || '',
            role: 'premium',
            planExpiresAt: null,
            daysRemaining: 0
          },
          renewal: {
            isEligibleForRenewal: true,
            isEarlyRenewal: true,
            options: [
              {
                duration: "1 mois",
                durationMonths: 1,
                basePrice: 5000,
                discount: 0,
                totalPrice: 5000,
                bonusDays: 0,
                savings: 0
              },
              {
                duration: "3 mois",
                durationMonths: 3,
                basePrice: 15000,
                discount: 10,
                totalPrice: 13500,
                bonusDays: 5,
                savings: 1500
              }
            ]
          }
        };
        
        setRenewalData(fallbackData);
        toast.error('Chargement des options en mode de secours');
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchRenewalData();
  }, [session]);


  // Fonction de paiement principale
  const handlePayment = async (method: PaymentMethod) => {
    if (!renewalData) {
      notifyError('Veuillez sélectionner un plan avant de continuer');
      return;
    }
  

    const phoneToUse = customerPhone;
    const formattedPhone = formatPhoneNumber(phoneToUse);
    
    if ((method.type === 'mobile' || method.gateway === 's3p') && (!phoneToUse || !validatePhoneNumber(phoneToUse))) {
      setErrors(prev => ({ ...prev, phone: 'Veuillez entrer un numéro de téléphone valide' }));
      notifyError('Numéro de téléphone invalide');
      return;
    }
  
    const selectedOption = renewalData.renewal.options.find(
      opt => opt.durationMonths === parseInt(selectedDuration)
    );
  
    if (!selectedOption) {
      notifyError('Option de renouvellement invalide');
      return;
    }
  
    const loadingId = notifyLoading('Traitement de votre paiement en cours...');
    setIsProcessing(true);
  
    try {  
      const paymentData = {
        planId: renewalData.user.role,
        durationMonths: selectedOption.durationMonths,
        customerName: customerName || session?.user?.name || '',
        customerPhone: formatPhoneNumber(customerPhone),
        customerEmail: session?.user?.email || '',
        paymentMethod: method.id,
        amount: selectedOption.totalPrice,
        currency: 'XAF',
        gateway: method.gateway
      };
  
      let result;
  
      const savePaymentData = (paymentData: any, method: PaymentMethod, selectedOption: RenewalOption) => {
        const paymentInfo = {
          // Données de transaction
          transactionId: paymentData.ptn || paymentData.transactionId,
          paymentMethod: method.id,
          provider: method.gateway,
          
          // Données de renouvellement
          amount: selectedOption.totalPrice,
          currency: 'XAF',
          planId: renewalData.user.role,
          planName: renewalData.user.role,
          durationMonths: selectedOption.durationMonths,
          duration: selectedOption.duration,
          
          // Données bonus
          bonusDays: selectedOption.bonusDays,
          savings: selectedOption.savings,
          
          // Données client
          customerEmail: session?.user?.email,
          customerName: session?.user?.name,
          
          // Métadonnées
          timestamp: new Date().toISOString(),
          
          // Pour S3P
          operator: method.gateway === 's3p' ? getOperatorFromMethodId(method.id) : undefined,
          payItemId: method.gateway === 's3p' ? S3P_SERVICES_CONFIG[method.id as OperatorKey]?.payItemId : undefined
        };
  
        console.log('💾 Sauvegarde des données de paiement:', paymentInfo);
        localStorage.setItem('lastPayment', JSON.stringify(paymentInfo));
      };
  
      const getOperatorFromMethodId = (methodId: string): Operator => {
        if (methodId.includes('orange')) return 'orange';
        if (methodId.includes('mtn')) return 'mtn';
        if (methodId.includes('express')) return 'express-union';
        return 'unknown';
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
          amount: paymentData.amount,
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
          amount: paymentData.amount,
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
          amount: paymentData.amount,
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
  
        // GESTION RÉPONSE S3P
        if (result.data?.ptn) {
          savePaymentData({
            ptn: result.data.ptn,
            paymentMethod: method.id,
            amount: paymentData.amount,
            currency: 'XAF'
          }, method, selectedOption);
  
          notifySuccess('Paiement Mobile Money initié. Vérification en cours...');
          setCurrentStep('processing');
          await verifyS3PPaymentStatus(result.data.ptn);
          
        } else if (result.data?.paymentUrl) {
          savePaymentData({}, method, selectedOption); 
          notifySuccess('Redirection vers la passerelle de paiement...');
          window.location.href = result.data.paymentUrl;
          
        } else if (result.data?.status === 'PENDING') {
          savePaymentData({}, method, selectedOption); 
          notifySuccess('Paiement en attente de confirmation...');
          setCurrentStep('processing');
          
        } else {
          console.warn('[Payment S3P] Structure de réponse inattendue:', result);
          throw new Error('Réponse inattendue du service S3P');
        }
  
      } else if (method.gateway === 'enkap') {
        
        console.log('[Payment] Début paiement Enkap ');
  
        const enkapParams = {
          ...paymentData,
          returnUrl: `${window.location.origin}/dashboard/renew/confirmation?status=success`,
          cancelUrl: `${window.location.origin}/dashboard/renew?status=cancelled`,
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
  
        // GESTION RÉPONSE ENKAP
        if (result.paymentUrl || result.data?.paymentUrl) {
          savePaymentData({
            paymentMethod: method.id,
            amount: paymentData.amount,
            currency: 'XAF'
          }, method, selectedOption); 
  
          notifySuccess('Redirection vers la plateforme de paiement sécurisée...');
          window.location.href = result.paymentUrl || result.data.paymentUrl;
          
        } else if (result.status === 'PENDING' || result.status === 'success') {
          savePaymentData({}, method, selectedOption); 
          notifySuccess('Paiement en cours de traitement...');
          window.location.href = `${window.location.origin}/dashboard/renew/confirmation?status=pending`;
          
        } else {
          console.warn('[Payment Enkap] Structure de réponse inattendue:', result);
          throw new Error('Réponse inattendue du service Enkap');
        }
      }
      
    } catch (error) {
      console.error('Erreur lors du traitement du paiement:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Erreur inattendue';
      
      if (method.gateway === 's3p') {
        if (errorMessage.includes('Service not found') || errorMessage.includes('40602')) {
          errorMessage = `L'opérateur ${method.name} n'est pas disponible. Veuillez choisir un autre moyen de paiement.`;
        } else if (errorMessage.includes('quote') || errorMessage.includes('devis')) {
          errorMessage = 'Erreur lors de la préparation du paiement. Veuillez réessayer.';
        }
      } else if (method.gateway === 'enkap') {
        errorMessage = 'Erreur lors du paiement. Vérifiez les informations et réessayez.';
      }
      
      notifyError(errorMessage, { title: 'Erreur de paiement' });
      setCurrentStep('details');
    } finally {
      setIsProcessing(false);
      if (typeof loadingId === 'string') {
        notifyLoading(loadingId, {});
      }
    }
  };

  // Vérification du statut S3P
  const verifyS3PPaymentStatus = async (transactionId: string, attempts = 0) => {
    try {
      const response = await fetch(`/api/v1/payment/s3p/verify?transactionId=${transactionId}`);
      
      if (!response.ok) {

        if (response.status === 404) {
          console.log('[S3P Verify] Transaction non trouvée (encore en traitement)');
          
          if (attempts < 60) { 
            setTimeout(() => verifyS3PPaymentStatus(transactionId, attempts + 1), 3000);
            return;
          } else {
            notifyError('Délai de vérification dépassé. Le paiement est peut-être toujours en cours.');
            setCurrentStep('details');
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
          
          router.push('/dashboard/renew/confirmation?status=success&transactionId=' + transactionId);
          break;
          
        case 'PENDING':
          if (attempts < 60) {
            setTimeout(() => verifyS3PPaymentStatus(transactionId, attempts + 1), 3000);
          } else {
            notifyError('Paiement toujours en attente après 3 minutes. Vérifiez manuellement.');
            setCurrentStep('details');
          }
          break;
          
        case 'FAILED':
        case 'CANCELLED':
          notifyError(`Paiement ${data.status.toLowerCase()}. Veuillez réessayer.`);
          setCurrentStep('details');
          break;
          
        default:
          console.warn('[S3P Verify] Statut inconnu:', data.status);
          if (attempts < 60) {
            setTimeout(() => verifyS3PPaymentStatus(transactionId, attempts + 1), 3000);
          } else {
            notifyError('Impossible de déterminer le statut du paiement.');
            setCurrentStep('details');
          }
      }
      
    } catch (error) {
      console.error('Erreur de vérification S3P:', error);
      
      if (attempts < 60) {
        setTimeout(() => verifyS3PPaymentStatus(transactionId, attempts + 1), 3000);
      } else {
        notifyError('Erreur de vérification du paiement.');
        setCurrentStep('details');
      }
    }
  };

  // Rendu du sélecteur de plan
  const renderPlanSelection = () => {
    if (!renewalData) return null;
    
    const { user, renewal } = renewalData;

    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Renouveler votre abonnement {user?.role}
          </h1>
          {user?.planExpiresAt && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-yellow-800">
                Votre abonnement actuel expire le {new Date(user.planExpiresAt).toLocaleDateString()}
                {user?.daysRemaining > 0 && ` (dans ${user.daysRemaining} jours)`}
                {user?.daysRemaining <= 0 && ` (expiré)`}
              </p>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {renewal?.options.map((option) => (
            <div 
              key={option.durationMonths}
              className={`relative p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-xl ${
                selectedDuration === option.durationMonths.toString()
                  ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50'
                  : 'border-gray-200 hover:border-indigo-300 bg-white'
              } ${option.discount > 0 ? 'transform scale-105' : ''}`}
              onClick={() => setSelectedDuration(option.durationMonths.toString())}
            >
              {option.discount > 0 && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-red-600 to-red-700 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                    -{option.discount}% Économie
                  </span>
                </div>
              )}
              
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {option.duration}
                </h3>
                
                {option.bonusDays > 0 && (
                  <div className="mb-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Gift className="h-3 w-3 mr-1" />
                      +{option.bonusDays} jours offerts
                    </span>
                  </div>
                )}
                
                <div className="mb-4">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatPrice(option.totalPrice)}
                  </div>
                  {option.discount > 0 && (
                    <div className="text-sm text-gray-500 line-through">
                      {formatPrice(option.basePrice)}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 mt-1">
                    Soit {formatPrice(Math.round(option.totalPrice / option.durationMonths))}/mois
                  </div>
                </div>
                
                {option.savings > 0 && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-800">
                      Économisez {formatPrice(option.savings)}
                    </p>
                  </div>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDuration(option.durationMonths.toString());
                    setCurrentStep('method');
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                    selectedDuration === option.durationMonths.toString()
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {selectedDuration === option.durationMonths.toString() ? 'Sélectionné' : 'Choisir'}
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Avantages du renouvellement</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900">Continuité de service</h4>
                <p className="text-sm text-blue-700">Aucune interruption de vos liens</p>
              </div>
            </div>
            <div className="flex items-start">
              <Gift className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900">Jours bonus</h4>
                <p className="text-sm text-blue-700">Plus de durée pour le même prix</p>
              </div>
            </div>
            <div className="flex items-start">
              <Calendar className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900">Économies</h4>
                <p className="text-sm text-blue-700">Jusqu'à 25% sur les forfaits longs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Rendu du sélecteur de méthode de paiement
  const renderMethodSelection = () => (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center mb-8">
        <button
          onClick={() => setCurrentStep('plan')}
          className="text-gray-600 hover:text-gray-900 mr-4 p-3 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="text-3xl font-bold text-gray-900">
          Choisissez votre moyen de paiement
        </h2>
      </div>

      <div className="mb-12">
        <div className="flex items-center mb-6">
          <Smartphone className="h-6 w-6 text-indigo-600 mr-3" />
          <h3 className="text-xl font-semibold text-gray-800">Mobile Money</h3>
          <span className="ml-3 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
            Instantané
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ALL_PAYMENT_METHODS.filter(m => m.gateway === 's3p' && m.type === 'mobile').map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              onSelect={() => {
                setSelectedMethod(method);
                setCurrentStep('details');
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
                  setCurrentStep('details');
                }}
              />
            ))}
        </div>
      </div>

      <div className="mb-12">
        <div className="flex items-center mb-6">
          <CreditCard className="h-6 w-6 text-indigo-600 mr-3" />
          <h3 className="text-xl font-semibold text-gray-800">Paiement par Carte</h3>
          <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            Sécurisé
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ALL_PAYMENT_METHODS.filter(m => m.type === 'card').map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              onSelect={() => {
                setSelectedMethod(method);
                setCurrentStep('details');
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // Rendu des détails de paiement
  const renderPaymentDetails = () => {
    if (!selectedMethod || !renewalData) return null;

    const selectedOption = renewalData.renewal.options.find(
      opt => opt.durationMonths === parseInt(selectedDuration)
    );

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
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
              onClick={() => setCurrentStep('method')}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              ← Changer
            </button>
          </div>

          {(selectedMethod.gateway === 'enkap' || (selectedMethod.gateway === 's3p' && selectedMethod.type !== 'card')) && (
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
{selectedMethod.type === 'card' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 p-6 mb-8 rounded-r-xl">
              <div className="flex items-start">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                    Paiement sécurisé
                  </h4>
                  <p className="text-sm text-blue-700">
                    Vous serez redirigé vers une page sécurisée pour finaliser votre paiement.
                    Vos informations bancaires sont protégées par un chiffrement SSL.
                  </p>
                </div>
              </div>
            </div>
          )}
                    <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Résumé du renouvellement</h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Plan actuel</span>
                <span className="font-medium">{renewalData?.user?.role}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Durée de renouvellement</span>
                <span className="font-medium">{selectedOption?.duration}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Moyen de paiement</span>
                <span className="font-medium">{selectedMethod.name}</span>
              </div>
              
              {selectedOption?.bonusDays !== undefined && selectedOption.bonusDays > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Jours bonus</span>
                  <span className="font-medium text-green-600">
                    +{selectedOption.bonusDays} jours
                  </span>
                </div>
              )}
              {selectedMethod.processingTime && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Temps de traitement</span>
                  <span className="font-medium text-green-600">{selectedMethod.processingTime}</span>
                </div>
              )}
              {selectedOption?.discount !== undefined && selectedOption.discount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Économie</span>
                  <span className="font-medium text-green-600">
                    -{selectedOption.discount}% ({formatPrice(selectedOption.savings)})
                  </span>
                </div>
              )}
              
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total à payer</span>
                  <span className="text-2xl font-bold text-indigo-600">
                    {formatPrice(selectedOption?.totalPrice || 0)}
                  </span>
                </div>
                </div>
            </div>
          </div>

          <button
            onClick={() => handlePayment(selectedMethod)}
            disabled={isProcessing || !selectedOption}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-indigo-700 hover:to-purple-700 transform transition-all duration-200 hover:scale-105 focus:ring-4 focus:ring-indigo-200"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" />
                <span className="ml-2">Traitement en cours...</span>
              </div>
              ) : (
                `Renouveler avec ${selectedMethod.name} - ${formatPrice(selectedOption?.totalPrice || 0)}`
              )}
            </button>
  
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                <Shield className="h-4 w-4 inline mr-1" />
                Paiement sécurisé et crypté
              </p>
            </div>
          </div>
        </div>
      );
    };
    const renderProcessing = () => (
      <div className="max-w-md mx-auto text-center py-12">
        {paymentStatus === 'processing' && (
          <>
            <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-indigo-100 mb-6">
              <LoadingSpinner size="lg" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Initialisation du paiement...
            </h2>
            <p className="text-gray-600 mb-8">
              Nous préparons votre paiement. Veuillez patienter.
            </p>
          </>
        )}
      {paymentStatus === 'pending' && (
        <>
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-yellow-100 mb-6">
            <Clock className="h-12 w-12 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Paiement en cours de traitement
          </h2>
          <p className="text-gray-600 mb-8">
            {selectedMethod?.type === 'mobile' ? (
              <>
                Veuillez vérifier votre téléphone et confirmer le paiement.
                <br />
                Un code de confirmation vous a été envoyé.
              </>
            ) : (
              'Votre paiement est en cours de traitement. Cela peut prendre quelques minutes.'
            )}
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start">
              <ClockIcon className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <h3 className="text-sm font-medium text-yellow-800">En attente de confirmation</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Ne fermez pas cette page. Nous vérifions automatiquement l'état de votre paiement.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
      {paymentStatus === 'success' && (
        <>
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 mb-6">
            <Check className="h-12 w-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Renouvellement réussi !
          </h2>
          <p className="text-gray-600 mb-8">
            Votre abonnement a été renouvelé avec succès. 
            Vous bénéficiez maintenant de {selectedDuration} mois supplémentaires.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
            <div className="text-left">
              <h3 className="text-lg font-semibold text-green-900 mb-2">Récapitulatif</h3>
              <div className="space-y-2 text-sm text-green-800">
                <div className="flex justify-between">
                  <span>Plan:</span>
                  <span className="font-medium">{renewalData?.user?.role}</span>
                </div>
                <div className="flex justify-between">
                  <span>Durée ajoutée:</span>
                  <span className="font-medium">
                    {renewalData?.renewal.options.find(opt => 
                      opt.durationMonths === parseInt(selectedDuration)
                    )?.duration}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Montant payé:</span>
                  <span className="font-medium">
                    {formatPrice(renewalData?.renewal.options.find(opt => 
                      opt.durationMonths === parseInt(selectedDuration)
                    )?.totalPrice || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
          >
            Retour au tableau de bord
          </button>
        </>
      )}
      {paymentStatus === 'failed' && (
        <>
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-red-100 mb-6">
            <X className="h-12 w-12 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Échec du paiement
          </h2>
          <p className="text-gray-600 mb-8">
            Une erreur est survenue lors du traitement de votre paiement de renouvellement.
            Veuillez réessayer ou contacter le support.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <h3 className="text-sm font-medium text-red-800">Que faire maintenant ?</h3>
                <ul className="text-sm text-red-700 mt-1 space-y-1">
                  <li>• Vérifiez votre solde et réessayez</li>
                  <li>• Utilisez une autre méthode de paiement</li>
                  <li>• Contactez notre support si le problème persiste</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setCurrentStep('plan');
                setPaymentStatus('idle');
                setSelectedMethod(null);
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Recommencer
            </button>
            <button
              onClick={() => {
                setPaymentStatus('idle');
                setCurrentStep('method');
              }}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
            >
              Changer le paiement
            </button>
          </div>
        </>
      )}
    </div>
  );
const renderContent = () => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <LoadingSpinner size="lg" />
        <p className="text-gray-600 mt-4">Chargement de vos options de renouvellement...</p>
        <div className="mt-4 w-64 bg-gray-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: '70%' }}
          ></div>
        </div>
      </div>
    );
  }

  if (!renewalData) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-md">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-medium text-red-900">Erreur de chargement</h3>
            <p className="text-sm text-red-700 mt-2">
              Impossible de charger les options de renouvellement. Veuillez réessayer.
            </p>
            <div className="mt-4">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vérifier si l'utilisateur est éligible au renouvellement
  if (!renewalData.renewal.isEligibleForRenewal) {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-yellow-800 mb-2">
            Renouvellement non disponible
          </h2>
          <p className="text-yellow-700 mb-4">
            Votre plan actuel ne permet pas le renouvellement ou vous n'êtes pas éligible.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  // Afficher les étapes normales
  switch (currentStep) {
    case 'plan':
      return renderPlanSelection();
    case 'method':
      return renderMethodSelection();
    case 'details':
      return renderPaymentDetails();
    case 'processing':
      return renderProcessing();
    default:
      return renderPlanSelection();
  }
};
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Renouvellement d'abonnement
            </h1>
            <p className="text-xl text-gray-600">
              Renouvelez votre abonnement et continuez à profiter de tous nos services
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between mb-3 text-sm font-medium">
              <span className={currentStep === 'plan' ? 'text-indigo-600' : 'text-gray-500'}>
                Choisir la durée
              </span>
              <span className={currentStep === 'method' ? 'text-indigo-600' : 'text-gray-500'}>
                Moyen de paiement
              </span>
              <span className={currentStep === 'details' ? 'text-indigo-600' : 'text-gray-500'}>
                Détails
              </span>
              <span className={currentStep === 'processing' ? 'text-indigo-600' : 'text-gray-500'}>
                Confirmation
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                style={{
                  width: 
                    currentStep === 'plan' ? '25%' :
                    currentStep === 'method' ? '50%' :
                    currentStep === 'details' ? '75%' : '100%'
                }}
              />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {renderContent()}
        </div>
        
        {currentStep !== 'processing' && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center px-6 py-3 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au tableau de bord
            </button>
          </div>
        )}
          <div className="mt-12 text-center">
          <p className="text-sm text-gray-500 mb-4">
            Besoin d'aide pour votre renouvellement ?
          </p>
          <div className="flex justify-center space-x-6 text-sm">
            <a href="mailto:support@shortlink.com" className="text-indigo-600 hover:text-indigo-700">
              Email: support@shortlink.com
            </a>
            <a href="tel:+237123456789" className="text-indigo-600 hover:text-indigo-700">
              Tél: +237 123 456 789
            </a>
          </div>
          <div className="mt-6 flex justify-center items-center space-x-4 text-xs text-gray-400">
            <Shield className="h-4 w-4" />
            <span>Paiements sécurisés par nos partenaires certifiés</span>
          </div>
        </div>
      </div>
    </div>
  );
};