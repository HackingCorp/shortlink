'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  Smartphone, 
  CreditCard, 
  Info,
  Shield,
  Download,
  Mail,
  ArrowLeft,
  Calendar,
  Gift,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type PaymentStatus = 'success' | 'pending' | 'errored' | 'cancelled' | 'failed' | '201' | '400' | '403' | '404' | '500' | '401';
type PaymentMethod = 'mobile' | 'card';
type Operator = 'orange' | 'mtn' | 'express-union' | 'unknown';

interface PaymentConfirmation {
  status: PaymentStatus;
  transactionId?: string;
  paymentMethod?: PaymentMethod;
  operator?: Operator;
  amount?: number;
  currency?: string;
  planName?: string | null;
  duration?: string;
  durationMonths?: number;
  timestamp?: string;
  customerEmail?: string;
  customerName?: string;
  provider?: 's3p' | 'enkap';
  errorCode?: number;
  errorMessage?: string;
  payItemId?: string;
  bonusDays?: number;
  oldExpiryDate?: string;
  newExpiryDate?: string;
  daysAdded?: number;
  planId?: string;
}

const S3P_ERROR_CODES = {
  0: { message: 'Paiement réussi', status: 'success' as PaymentStatus },
  703000: { message: 'Transaction échouée', status: 'errored' as PaymentStatus },
  703201: { message: 'Transaction non confirmée par le client', status: 'cancelled' as PaymentStatus },
  703202: { message: 'Transaction rejetée par le client', status: 'cancelled' as PaymentStatus },
  201: { message: 'Paiement réussi', status: 'success' as PaymentStatus },
  400: { message: 'Paiement échoué', status: 'errored' as PaymentStatus },
  403: { message: 'Paiement échoué', status: 'errored' as PaymentStatus },
  404: { message: 'Paiement échoué', status: 'errored' as PaymentStatus },
  500: { message: 'Paiement échoué', status: 'errored' as PaymentStatus },
  401: { message: 'Paiement échoué', status: 'errored' as PaymentStatus },
  703108: { message: 'Solde insuffisant', status: 'errored' as PaymentStatus },
  704005: { message: 'Transaction échouée', status: 'errored' as PaymentStatus },
};

const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
};

const getOperatorFromPayItemId = (payItemId?: string): Operator => {
  if (!payItemId) return 'unknown';
  if (payItemId.includes('ORANGE')) return 'orange';
  if (payItemId.includes('MTN')) return 'mtn';
  if (payItemId.includes('EXPRESS')) return 'express-union';
  return 'unknown';
};

const getS3PErrorMessage = (errorCode: number, operator: Operator): string => {
  const errorConfig = S3P_ERROR_CODES[errorCode as keyof typeof S3P_ERROR_CODES];
  
  if (errorConfig) {
    return errorConfig.message;
  }
  
  // Messages par défaut selon l'opérateur
  switch (operator) {
    case 'orange':
      return 'Erreur Orange Money. Veuillez réessayer.';
    case 'mtn':
      return 'Erreur MTN Mobile Money. Veuillez réessayer.';
    case 'express-union':
      return 'Erreur Express Union Mobile. Veuillez réessayer.';
    default:
      return `Erreur de paiement (Code: ${errorCode}). Veuillez réessayer.`;
  }
};

const getOperatorName = (operator?: Operator): string => {
  switch (operator) {
    case 'orange': return 'Orange Money';
    case 'mtn': return 'MTN Mobile Money';
    case 'express-union': return 'Express Union Mobile';
    default: return 'Mobile Money';
  }
};

const getProviderName = (provider?: 's3p' | 'enkap', paymentMethod?: PaymentMethod): string => {
  if (provider === 'enkap') {
    return paymentMethod === 'mobile' ? 'Mobile Money (e-nkap)' : 'Carte bancaire (e-nkap)';
  }
  return provider === 's3p' ? 'Mobile Money (S3P)' : 'Paiement en ligne';
};

const getProviderIcon = (provider?: 's3p' | 'enkap', paymentMethod?: PaymentMethod) => {
  if (provider === 'enkap') {
    return paymentMethod === 'mobile' ? 
      <Smartphone className="h-4 w-4 text-purple-600" /> :
      <CreditCard className="h-4 w-4 text-blue-600" />;
  }
  return <Smartphone className="h-4 w-4 text-green-600" />;
};


function LoadingSpinner({ attempts, isPending }: { attempts?: number; isPending?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {isPending ? 'Vérification en cours' : 'Chargement...'}
        </h2>
        <p className="text-gray-600">
          {isPending ? 'Vérification du paiement en cours...' : 'Chargement de votre confirmation...'}
        </p>
        {attempts !== undefined && attempts > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            Tentative {attempts + 1} sur 10
          </p>
        )}
      </div>
    </div>
  );
}


function ErrorDisplay({ error, onRetry, isPending }: { error: string; onRetry?: () => void; isPending?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
          <XCircle className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Erreur</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="space-y-3">
          {onRetry && (
            <Button onClick={onRetry} className="w-full bg-indigo-600 hover:bg-indigo-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          )}
          <Link href="/dashboard/renew" className="block">
            <Button variant="outline" className="w-full">
              Retour au renouvellement
            </Button>
          </Link>
          <Link href="/dashboard" className="block">
            <Button variant="outline" className="w-full">
              Retour au tableau de bord
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status, errorCode }: { status: PaymentStatus; errorCode?: number }) {
  const iconProps = {
    className: "h-16 w-16 mx-auto"
  };

  if (errorCode === 703202 || errorCode === 703201) {
    return <AlertCircle {...iconProps} className={`${iconProps.className} text-orange-500`} />;
  }

  switch (status) {
    case 'success':
    case '201':
      return <CheckCircle {...iconProps} className={`${iconProps.className} text-green-600`} />;
    case 'pending':
      return <Loader2 {...iconProps} className={`${iconProps.className} text-yellow-600 animate-spin`} />;
    case 'errored':
    case '400':
    case '403':
    case '404':
    case '500':
    case '401':
      return <XCircle {...iconProps} className={`${iconProps.className} text-red-600`} />;
    case 'cancelled':
      return <AlertCircle {...iconProps} className={`${iconProps.className} text-orange-500`} />;
    default:
      return <AlertCircle {...iconProps} className={`${iconProps.className} text-gray-400`} />;
  }
}

function getStatusTitle(status: PaymentStatus, errorCode?: number): string {
  if (errorCode === 703202) return 'Renouvellement Rejeté';
  if (errorCode === 703201) return 'Renouvellement Non Confirmé';
  if (errorCode === 703108) return 'Solde Insuffisant';
  
  switch (status) {
    case 'success': 
    case '201': 
      return 'Renouvellement Réussi !';
    case 'pending': return 'Renouvellement en Cours';
    case 'errored': 
    case '400': 
    case '403': 
    case '404': 
    case '500': 
    case '401': 
      return 'Erreur de Renouvellement';
    case 'cancelled': return 'Renouvellement Annulé';
    default: return 'Statut Inconnu';
  }
}

// Fonction pour obtenir la description du statut
function getStatusDescription(status: PaymentStatus, method?: PaymentMethod, errorCode?: number, errorMessage?: string): string {
  if (errorCode === 703202) return 'Vous avez rejeté la transaction sur votre mobile. Aucun montant n\'a été débité.';
  if (errorCode === 703201) return 'Vous n\'avez pas confirmé la transaction à temps. Aucun montant n\'a été débité.';
  if (errorCode === 703108) return 'Votre solde est insuffisant pour effectuer ce renouvellement.';
  if (errorCode === 704005) return 'La transaction a échoué. Veuillez réessayer.';
  
  if (errorMessage) return errorMessage;
  
  switch (status) {
    case 'success':
    case '201':
      return 'Votre abonnement a été renouvelé avec succès. Vous pouvez continuer à profiter de nos services.';
    case 'pending':
      return method === 'mobile' 
        ? 'Veuillez confirmer le paiement sur votre téléphone. Le traitement peut prendre quelques minutes.'
        : 'Votre renouvellement est en cours de traitement. Vous recevrez une notification dès confirmation.';
    case 'errored':
    case '400':
    case '403':
    case '404':
    case '500':
    case '401':
      return 'Une erreur est survenue lors du renouvellement de votre abonnement. Veuillez réessayer.';
    case 'cancelled':
      return 'Le renouvellement a été annulé. Aucun montant n\'a été débité.';
    default:
      return 'Statut de renouvellement non reconnu.';
  }
}

function RenewalDetails({ confirmation }: { confirmation: PaymentConfirmation }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Détails du renouvellement</h2>
      
      <div className="space-y-4">
        <DetailRow label="Statut" value={
          <span className={`px-3 py-1 rounded-full text-sm ${
            confirmation.status === 'success' || confirmation.status === '201' 
              ? 'bg-green-100 text-green-800' :
            confirmation.status === 'pending' 
              ? 'bg-yellow-100 text-yellow-800' :
            confirmation.status === 'cancelled' 
              ? 'bg-orange-100 text-orange-800' :
            'bg-red-100 text-red-800'
          }`}>
            {confirmation.status === 'success' || confirmation.status === '201' ? 'Confirmé' :
             confirmation.status === 'pending' ? 'En attente' :
             confirmation.status === 'cancelled' ? 'Annulé' : 'Erreur'}
          </span>
        } />
        
        <DetailRow label="Plan" value={confirmation.planName || 'Standard'} />

        {confirmation.duration && (
          <DetailRow label="Durée renouvelée" value={confirmation.duration} />
        )}

        {confirmation.bonusDays && confirmation.bonusDays > 0 && (
          <DetailRow label="Jours bonus" value={
            <span className="flex items-center text-green-600">
              <Gift className="h-4 w-4 mr-1" />
              +{confirmation.bonusDays} jours offerts
            </span>
          } />
        )}

        {confirmation.oldExpiryDate && (
          <DetailRow label="Ancienne expiration" value={
            <span className="text-gray-500">{confirmation.oldExpiryDate}</span>
          } />
        )}

        {confirmation.newExpiryDate && (
          <DetailRow label="Nouvelle expiration" value={
            <span className="flex items-center text-blue-600 font-semibold">
              <Calendar className="h-4 w-4 mr-1" />
              {confirmation.newExpiryDate}
            </span>
          } />
        )}

        {confirmation.daysAdded && (
          <DetailRow label="Total jours ajoutés" value={
            <span className="text-green-600 font-semibold">+{confirmation.daysAdded} jours</span>
          } />
        )}

        <DetailRow label="Opérateur" value={getOperatorName(confirmation.operator)} />

        <DetailRow label="Méthode de paiement" value={
          <div className="flex items-center space-x-2">
            {getProviderIcon(confirmation.provider, confirmation.paymentMethod)}
            <span>{getProviderName(confirmation.provider, confirmation.paymentMethod)}</span>
          </div>
        } />

        {confirmation.transactionId && (
          <DetailRow label="Référence" value={
            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
              {confirmation.transactionId}
            </span>
          } />
        )}

        {confirmation.amount && (
          <DetailRow label="Montant" value={
            <span className="font-bold text-lg text-indigo-600">
              {formatPrice(confirmation.amount)} {confirmation.currency}
            </span>
          } />
        )}

        {confirmation.errorCode && (
          <DetailRow label="Code d'erreur" value={
            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
              {confirmation.errorCode}
            </span>
          } />
        )}

        {confirmation.timestamp && (
          <DetailRow label="Date" value={
            new Date(confirmation.timestamp).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          } />
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-100">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}


function SecurityInfo({ status }: { status: PaymentStatus }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <Shield className="h-6 w-6 text-green-600 mr-3" />
        <h3 className="font-semibold text-gray-900">Renouvellement sécurisé</h3>
      </div>
      <p className="text-sm text-gray-600">
        {status === 'success' 
          ? 'Votre renouvellement a été traité de manière sécurisée.'
          : 'Toutes vos informations sont cryptées et sécurisées.'
        }
      </p>
    </div>
  );
}

// Composant ActionButtons
function ActionButtons({ status, transactionId, onRetry, operator }: { 
  status: PaymentStatus; 
  transactionId?: string; 
  onRetry?: () => void;
  operator?: Operator;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
      
      <div className="space-y-3">
        <Button 
          onClick={() => window.print()} 
          variant="outline" 
          className="w-full flex items-center justify-center"
        >
          <Download className="h-4 w-4 mr-2" />
          Imprimer le reçu
        </Button>

        <Link href="/dashboard">
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
            Retour au tableau de bord
          </Button>
        </Link>

        {(status === 'failed' || status === 'errored' || status === 'cancelled' || 
          status === '400' || status === '403' || status === '404' || status === '500' || status === '401') && (
          <Link href="/dashboard/renew">
            <Button variant="outline" className="w-full bg-red-600 text-white hover:bg-red-700">
              Réessayer le renouvellement
            </Button>
          </Link>
        )}

        {status === 'pending' && onRetry && (
          <Button 
            onClick={onRetry} 
            variant="outline" 
            className="w-full flex items-center justify-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser le statut
          </Button>
        )}

        {(status === 'success' || status === '201') && (
          <Link href="/dashboard/links">
            <Button variant="outline" className="w-full">
              Gérer mes liens
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

// Composant SupportInfo
function SupportInfo({ operator }: { operator?: Operator }) {
  const getSupportMessage = () => {
    switch (operator) {
      case 'orange':
        return 'Problème avec Orange Money ? Contactez notre support.';
      case 'mtn':
        return 'Problème avec MTN Mobile Money ? Contactez notre support.';
      case 'express-union':
        return 'Problème avec Express Union ? Contactez notre support.';
      default:
        return 'Notre équipe support est disponible pour vous aider.';
    }
  };

  return (
    <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
      <h3 className="font-semibold text-blue-900 mb-2">Besoin d'aide ?</h3>
      <p className="text-sm text-blue-700 mb-3">
        {getSupportMessage()}
      </p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center">
          <Mail className="h-3 w-3 mr-2" />
          support@shortlink.com
        </div>
        <div className="flex items-center">
          <Smartphone className="h-3 w-3 mr-2" />
          +237 XXX XXX XXX
        </div>
      </div>
    </div>
  );
}


function AdditionalMessages({ 
  status, 
  planName, 
  errorCode, 
  errorMessage, 
  operator,
  hasUpdatedPlan,
  newExpiryDate
}: { 
  status: PaymentStatus; 
  planName?: string | null; 
  errorCode?: number; 
  errorMessage?: string; 
  operator?: Operator;
  hasUpdatedPlan?: boolean;
  newExpiryDate?: string;
}) {
  
  if (status === 'success' || status === '201') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
        <div className="flex items-start">
          <CheckCircle className="h-6 w-6 text-green-600 mt-0.5 mr-3" />
          <div>
            <h3 className="font-semibold text-green-900 mb-2">
              {hasUpdatedPlan ? 'Votre abonnement est renouvelé !' : 'Renouvellement en cours...'}
            </h3>
            <p className="text-green-700">
              {hasUpdatedPlan 
                ? `Votre abonnement ${planName} a été prolongé jusqu'au ${newExpiryDate}. Vous pouvez continuer à utiliser nos services sans interruption.`
                : `Votre abonnement ${planName} est en cours de renouvellement. Cette opération peut prendre quelques instants.`
              }
            </p>
            {!hasUpdatedPlan && (
              <p className="text-green-600 text-sm mt-2">
                ⏳ Activation de votre renouvellement en cours...
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (errorCode === 703108) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
        <div className="flex items-start">
          <Info className="h-6 w-6 text-orange-600 mt-0.5 mr-3" />
          <div>
            <h3 className="font-semibold text-orange-900 mb-2">Solde insuffisant</h3>
            <p className="text-orange-700">
              Veuillez recharger votre compte {getOperatorName(operator)} et réessayer le renouvellement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (errorCode === 703202 || errorCode === 703201) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
        <div className="flex items-start">
          <Info className="h-6 w-6 text-orange-600 mt-0.5 mr-3" />
          <div>
            <h3 className="font-semibold text-orange-900 mb-2">Renouvellement interrompu</h3>
            <p className="text-orange-700">
              {errorCode === 703202 
                ? 'Vous avez rejeté la transaction. Aucun montant n\'a été débité.'
                : 'Vous n\'avez pas confirmé la transaction à temps. Aucun montant n\'a été débité.'
              }
            </p>
            <p className="text-orange-600 text-sm mt-2">
              Vous pouvez réessayer le renouvellement à tout moment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
        <div className="flex items-start">
          <Loader2 className="h-6 w-6 text-yellow-600 mt-0.5 mr-3 animate-spin" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">En attente de confirmation</h3>
            <p className="text-yellow-700">
              Votre renouvellement est en cours de traitement. Cette opération peut prendre quelques minutes.
              Vous recevrez une notification dès que le renouvellement sera confirmé.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'errored' || status === '400' || status === '403' || status === '404' || status === '500' || status === '401') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-start">
          <XCircle className="h-6 w-6 text-red-600 mt-0.5 mr-3" />
          <div>
            <h3 className="font-semibold text-red-900 mb-2">Erreur de renouvellement</h3>
            <p className="text-red-700">
              {errorMessage || 'Une erreur est survenue lors du renouvellement de votre abonnement.'}
            </p>
            <p className="text-red-600 text-sm mt-2">
              Veuillez réessayer ou contacter notre support si le problème persiste.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function RenewConfirmationPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RenewConfirmationContent />
    </Suspense>
  );
}


function RenewConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, update, status: sessionStatus } = useSession();
  
  const [confirmation, setConfirmation] = useState<PaymentConfirmation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [hasUpdatedPlan, setHasUpdatedPlan] = useState(false);

  const debugAPIResponse = useCallback((result: any, context: string) => {
    console.log(`🔍 DEBUG ${context}:`, {
      success: result.success,
      hasData: !!result.data,
      dataKeys: result.data ? Object.keys(result.data) : 'no data',
      oldExpiryDate: result.data?.oldExpiryDate,
      newExpiryDate: result.data?.newExpiryDate,
      daysAdded: result.data?.daysAdded,
      bonusDays: result.data?.bonusDays,
      fullResponse: result
    });
  }, []);

  const getPaymentData = useCallback(() => {
    try {
      const paymentData = localStorage.getItem('lastPayment');
      if (paymentData) {
        const data = JSON.parse(paymentData);
        console.log('📦 Données de renouvellement récupérées:', data);
        if (data.provider === 's3p' && !data.planName) {
          const planFromUrl = new URLSearchParams(window.location.search).get('plan');
          if (planFromUrl) {
            data.planName = planFromUrl;
          }
        }
        return data;
      }
    } catch (error) {
      console.error('❌ Erreur lecture localStorage:', error);
    }
    return null;
  }, []);

  const cleanupPaymentData = useCallback(() => {
    localStorage.removeItem('lastPayment');
    console.log('🧹 Données de renouvellement nettoyées');
  }, []);

const updateUserSubscription = useCallback(async (
  durationMonths: number, 
  transactionId?: string, 
  planName?: string
) => {
  try {
    console.log('🔄 Mise à jour abonnement appelée avec:', {
      durationMonths,
      transactionId,
      planName,
      hasUpdatedPlan
    });

    if (hasUpdatedPlan) {
      console.log('✅ Abonnement déjà mis à jour, skip...');
      return true;
    }

    const response = await fetch('/api/v1/payment/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionId: transactionId,
        durationMonths: durationMonths,
        planId: planName
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur API confirmation:', errorText);
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    debugAPIResponse(result, 'API Confirmation');

    if (result.success && result.data) {
      console.log('✅✅✅ Abonnement mis à jour avec succès:', result.data);
      

      setConfirmation(prev => {
        if (!prev) {
          console.warn('❌ Aucune confirmation précédente trouvée');
          return prev;
        }
        
        const updatedConfirmation = {
          ...prev,
          newExpiryDate: result.data.newExpiryDate,
          oldExpiryDate: result.data.oldExpiryDate,
          daysAdded: result.data.daysAdded,
          bonusDays: result.data.bonusDays,
          planName: result.data.plan,
          status: 'success' as PaymentStatus,
      
          timestamp: new Date().toISOString()
        };
        
        console.log('🔄 Mise à jour confirmation COMPLÈTE:', {
          avant: { newExpiryDate: prev.newExpiryDate, oldExpiryDate: prev.oldExpiryDate },
          apres: { newExpiryDate: updatedConfirmation.newExpiryDate, oldExpiryDate: updatedConfirmation.oldExpiryDate }
        });
        
        return updatedConfirmation;
      });

      if (session) {
        await update({
          ...session,
          user: {
            ...session.user,
            planExpiresAt: result.data.newExpiryDate
          }
        });
        console.log('✅ Session NextAuth mise à jour');
      }

      setHasUpdatedPlan(true);
      console.log('✅✅✅ hasUpdatedPlan défini à true');
      return true;
    } else {
      throw new Error(result.error || 'Erreur inconnue lors de la confirmation');
    }

  } catch (error) {
    console.error('❌ Erreur mise à jour abonnement:', error);
    return false;
  }
}, [update, hasUpdatedPlan, session, debugAPIResponse]);

const handleSuccessfulRenewal = useCallback(async (confirmationData: PaymentConfirmation) => {
  try {
    console.log('💰💰💰 DEBUT handleSuccessfulRenewal avec données:', confirmationData);
    
    const { durationMonths, transactionId, planName } = confirmationData;
    
    if (!durationMonths) {
      console.error('❌❌❌ Durée de renouvellement manquante dans handleSuccessfulRenewal');
      return;
    }


    if (hasUpdatedPlan) {
      console.log('🔄 handleSuccessfulRenewal: déjà mis à jour, skip');
      return;
    }

    console.log('🔄 Appel updateUserSubscription...');
    
    const success = await updateUserSubscription(durationMonths, transactionId, planName?? undefined);
    
    if (success) {
      console.log('🎉🎉🎉 handleSuccessfulRenewal COMPLET avec succès');
      cleanupPaymentData();
    } else {
      console.error('❌❌❌ handleSuccessfulRenewal a échoué');
      throw new Error('Échec de la mise à jour de l\'abonnement');
    }
    
    console.log('✅✅✅ FIN handleSuccessfulRenewal');

  } catch (error) {
    console.error('❌❌❌ Erreur critique dans handleSuccessfulRenewal:', error);
    setError(`Erreur lors de la mise à jour de votre abonnement: ${error}`);
  }
}, [updateUserSubscription, cleanupPaymentData, hasUpdatedPlan]);

const verifyS3PPayment = useCallback(async (transactionId: string, operator?: Operator, savedData?: any) => {
  try {
    console.log(`🔍 Vérification S3P pour renouvellement: ${transactionId}`);
    
    const response = await fetch(`/api/v1/payment/s3p/verify?transactionId=${transactionId}`);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📋 Réponse S3P renouvellement COMPLÈTE:', data);

    const transaction = Array.isArray(data) ? data[0] : data;
    
    if (!transaction) {
      return { 
        status: 'pending' as PaymentStatus, 
        errorCode: undefined, 
        errorMessage: '',
        transactionData: null
      };
    }

    let status: PaymentStatus = 'pending';
    let errorCode = transaction.errorCode;
    let errorMessage = '';

    console.log('🔍 Analyse transaction S3P:', {
      transactionStatus: transaction.status,
      errorCode: transaction.errorCode,
      hasSavedData: !!savedData,
      durationMonths: savedData?.durationMonths
    });

    if (transaction.status === 'SUCCESS' || transaction.status === 'success') {
      status = 'success';
      console.log('✅✅✅ Renouvellement S3P réussi, appel handleSuccessfulRenewal...');
      
      if (savedData?.durationMonths) {
        await handleSuccessfulRenewal({
          ...savedData,
          status: 'success',
          transactionId: transactionId,
          operator: operator,
        });
      } else {
        console.warn('⚠️ Données insuffisantes pour handleSuccessfulRenewal:', savedData);
      }
    } else if (transaction.status === 'ERRORED' && errorCode !== undefined) {
      const errorConfig = S3P_ERROR_CODES[errorCode as keyof typeof S3P_ERROR_CODES];
      status = errorConfig ? errorConfig.status : 'errored';
      errorMessage = getS3PErrorMessage(errorCode, operator || 'unknown');
    }

    return { 
      status, 
      errorCode, 
      errorMessage,
      transactionData: transaction 
    };

  } catch (error) {
    console.error('❌ Erreur vérification S3P renouvellement:', error);
    return { 
      status: 'pending' as PaymentStatus, 
      errorCode: undefined, 
      errorMessage: 'Erreur de vérification du statut',
      transactionData: null
    };
  }
}, [handleSuccessfulRenewal]);


  // Vérification e-nkap
  const verifyEnkapPayment = useCallback(async (transactionId: string, merchantReference?: string, savedData?: any) => {
    try {
      console.log(`🔍 Vérification e-nkap pour transaction: ${transactionId}`);
      
      const response = await fetch('/api/v1/payment/enkap/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          merchantReference
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📋 Réponse e-nkap complète:', data);

      let status: PaymentStatus = 'pending';
      let errorMessage = '';

      // Vérification directe du statut success
      if (data.status === 'success') {
        status = 'success';
        console.log('✅ Paiement e-nkap confirmé comme réussi');
        
        if (savedData && !hasUpdatedPlan) {
          await handleSuccessfulRenewal({
            ...savedData,
            status: 'success',
            transactionId: transactionId,
            provider: 'enkap',
          });
        }
      }
      // Traitement de la réponse standard
      else if (data.success && data.data) {
        const statusMapping: { [key: string]: PaymentStatus } = {
          'CONFIRMED': 'success',
          'COMPLETED': 'success', 
          'SUCCESS': 'success',
          'PENDING': 'pending',
          'IN_PROGRESS': 'pending',
          'FAILED': 'errored',
          'CANCELLED': 'cancelled'
        };

        const enkapStatus = data.data.status || data.data.paymentStatus;
        status = statusMapping[enkapStatus] || 'pending';
        
        console.log(`📊 Statut e-nkap: ${enkapStatus} -> ${status}`);

        if (status === 'success' && savedData && !hasUpdatedPlan) {
          console.log('✅ Paiement e-nkap réussi, mise à jour du plan...');
          await handleSuccessfulRenewal({
            ...savedData,
            status: 'success',
            transactionId: transactionId,
            provider: 'enkap',
          });
        }

        if (status === 'errored') {
          errorMessage = data.data.message || 'Le paiement a échoué';
        }
      }

      return { 
        status, 
        errorCode: undefined, 
        errorMessage,
        transactionData: data.data || data
      };

    } catch (error) {
      console.error('❌ Erreur vérification e-nkap:', error);
      return { 
        status: 'pending' as PaymentStatus, 
        errorCode: undefined, 
        errorMessage: 'Erreur de vérification du statut e-nkap',
        transactionData: null
      };
    }
  }, [handleSuccessfulRenewal, hasUpdatedPlan]);



const hasCalledAPI = useRef(false);
const processedTransactions = useRef(new Set());


useEffect(() => {
  let isMounted = true;

  const loadConfirmation = async () => {
    try {
      const status = searchParams.get('status') as PaymentStatus;
      const transactionId = searchParams.get('transactionId');
      
      const transactionKey = `${status}-${transactionId}`;
      if (processedTransactions.current.has(transactionKey)) {
        console.log('✅ Transaction déjà traitée:', transactionKey);
        if (isMounted) setIsLoading(false);
        return;
      }

      processedTransactions.current.add(transactionKey);

      if (isMounted) {
        setIsLoading(true);
        setError(null);
      }
      
      console.log('🔄 Début du chargement UNIQUE', { status, transactionId });

      const savedData = getPaymentData();
      
      let finalStatus: PaymentStatus = status || savedData?.status || 'pending';
      
      if (finalStatus === 'success' && !hasUpdatedPlan && savedData?.durationMonths && isMounted && !hasCalledAPI.current) {
        console.log('🎯 Traitement UNIQUE - Premier appel API');
        
        hasCalledAPI.current = true; 
        
        const initialConfirmation: PaymentConfirmation = {
          ...savedData,
          status: 'success',
          timestamp: new Date().toISOString()
        };
        
        setConfirmation(initialConfirmation);
        await handleSuccessfulRenewal(initialConfirmation);
        
        if (isMounted) setIsLoading(false);
        return;
      }

      if (isMounted && (!hasUpdatedPlan || finalStatus !== 'success')) {
        const finalConfirmation: PaymentConfirmation = {
          status: finalStatus,
          transactionId: transactionId || savedData?.transactionId,
          paymentMethod: savedData?.paymentMethod,
          operator: savedData?.operator || getOperatorFromPayItemId(savedData?.payItemId),
          amount: savedData?.amount,
          currency: savedData?.currency,
          planName: savedData?.planName,
          duration: savedData?.duration,
          durationMonths: savedData?.durationMonths,
          timestamp: new Date().toISOString(),
          customerEmail: session?.user?.email ?? undefined,
          customerName: session?.user?.name ?? undefined,
          provider: savedData?.provider || 's3p',
          errorCode: savedData?.errorCode,
          errorMessage: savedData?.errorMessage,
          payItemId: savedData?.payItemId,
          bonusDays: savedData?.bonusDays,
          oldExpiryDate: savedData?.oldExpiryDate,
          newExpiryDate: savedData?.newExpiryDate,
          daysAdded: savedData?.daysAdded
        };

        setConfirmation(finalConfirmation);
        console.log('✅ Confirmation mise à jour (sans appel API):', finalConfirmation);
      }

      if (isMounted) setIsLoading(false);

    } catch (err) {
      console.error('❌ Erreur:', err);
      if (isMounted) setIsLoading(false);
    }
  };

  loadConfirmation();

  return () => {
    isMounted = false;
  };
}, [searchParams, hasUpdatedPlan]); 

  const retryVerification = useCallback(() => {
    setVerificationAttempts(0);
    setIsLoading(true);
    setError(null);
  }, []);

  if (isLoading) {
    return (
      <LoadingSpinner 
        attempts={verificationAttempts} 
        isPending={confirmation?.status === 'pending'}
      />
    );
  }

  if (error) {
    return (
      <ErrorDisplay 
        error={error} 
        onRetry={retryVerification}
        isPending={confirmation?.status === 'pending'}
      />
    );
  }

  if (!confirmation) {
    return <ErrorDisplay error="Aucune information de renouvellement disponible" onRetry={retryVerification} />;
  }


    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header avec bouton retour */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au tableau de bord
            </button>
          </div>
  
          {/* Header avec statut détaillé */}
          <div className="text-center mb-8">
            <StatusIcon status={confirmation.status} errorCode={confirmation.errorCode} />
            <h1 className="text-4xl font-bold text-gray-900 mt-4 mb-2">
              {getStatusTitle(confirmation.status, confirmation.errorCode)}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {getStatusDescription(
                confirmation.status, 
                confirmation.paymentMethod, 
                confirmation.errorCode, 
                confirmation.errorMessage
              )}
            </p>
          </div>
  
          {/* Détails du renouvellement */}
          <div className="grid lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
              <RenewalDetails confirmation={confirmation} />
            </div>
            
            <div className="space-y-6">
              <SecurityInfo status={confirmation.status} />
              <ActionButtons 
                status={confirmation.status} 
                transactionId={confirmation.transactionId}
                onRetry={retryVerification}
                operator={confirmation.operator}
              />
              <SupportInfo operator={confirmation.operator} />
            </div>
          </div>
  
          {/* Messages supplémentaires */}
          <AdditionalMessages 
            status={confirmation.status} 
            planName={confirmation.planName}
            errorCode={confirmation.errorCode}
            errorMessage={confirmation.errorMessage}
            operator={confirmation.operator}
            hasUpdatedPlan={hasUpdatedPlan}
            newExpiryDate={confirmation.newExpiryDate}
          />
  
          {/* Section avantages du renouvellement */}
          {(confirmation.status === 'success' || confirmation.status === '201') && (
            <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 p-8">
              <h2 className="text-2xl font-bold text-indigo-900 mb-6 text-center">
                🎉 Félicitations pour votre renouvellement !
              </h2>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-indigo-100">
                    <Calendar className="h-8 w-8 text-indigo-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-indigo-900 mb-2">Continuité assurée</h3>
                    <p className="text-sm text-indigo-700">
                      Votre service continue sans interruption
                    </p>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-indigo-100">
                    <Gift className="h-8 w-8 text-green-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-green-900 mb-2">Jours bonus</h3>
                    <p className="text-sm text-green-700">
                      {confirmation.bonusDays ? `+${confirmation.bonusDays} jours offerts` : 'Avantages inclus'}
                    </p>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-indigo-100">
                    <Shield className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-blue-900 mb-2">Sécurité maintenue</h3>
                    <p className="text-sm text-blue-700">
                      Protection continue de vos liens
                    </p>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-indigo-100">
                    <CheckCircle className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-purple-900 mb-2">Support prioritaire</h3>
                    <p className="text-sm text-purple-700">
                      Assistance dédiée 24/7
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
  
          {/* Section informations complémentaires */}
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            {/* Prochaines étapes pour succès */}
            {(confirmation.status === 'success' || confirmation.status === '201') && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Prochaines étapes</h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span>Votre abonnement est prolongé jusqu'au {confirmation.newExpiryDate || 'la nouvelle date'}</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span>Vous recevrez un email de confirmation de renouvellement</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span>Continuez à utiliser toutes les fonctionnalités de votre forfait</span>
                  </li>
                  {confirmation.bonusDays && confirmation.bonusDays > 0 && (
                    <li className="flex items-start">
                      <Gift className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                      <span>Vous bénéficiez de {confirmation.bonusDays} jours bonus supplémentaires</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
  
            {/* Dépannage pour erreurs */}
            {(confirmation.status === 'errored' || confirmation.status === 'cancelled' || 
              confirmation.status === '400' || confirmation.status === '403' || 
              confirmation.status === '404' || confirmation.status === '500' || 
              confirmation.status === '401') && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Solutions possibles</h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span>Vérifiez votre solde mobile money</span>
                  </li>
                  <li className="flex items-start">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span>Assurez-vous que le service est activé sur votre mobile</span>
                  </li>
                  <li className="flex items-start">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span>Réessayez dans quelques minutes</span>
                  </li>
                  <li className="flex items-start">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span>Contactez notre support si le problème persiste</span>
                  </li>
                </ul>
              </div>
            )}
  
            {/* Informations de contact */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Contact & Support</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center text-gray-600">
                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                  <span>support@shortlink.com</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Smartphone className="h-4 w-4 mr-2 text-gray-400" />
                  <span>+237 XXX XXX XXX</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Clock className="h-4 w-4 mr-2 text-gray-400" />
                  <span>Lun - Ven: 8h - 18h</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Info className="h-4 w-4 mr-2 text-gray-400" />
                  <span>Support dédié aux renouvellements</span>
                </div>
              </div>
            </div>
          </div>
  
          {/* Timeline de renouvellement pour statut success */}
          {(confirmation.status === 'success' || confirmation.status === '201') && (
            <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-6">Historique du renouvellement</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">Renouvellement confirmé</p>
                    <p className="text-sm text-gray-500">{confirmation.timestamp ? new Date(confirmation.timestamp).toLocaleDateString('fr-FR') : 'Aujourd\'hui'}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">Nouvelle date d'expiration</p>
                    <p className="text-sm text-gray-500">{confirmation.newExpiryDate || 'Calcul en cours...'}</p>
                  </div>
                </div>
                
                {confirmation.bonusDays && confirmation.bonusDays > 0 && (
                  <div className="flex items-center">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <Gift className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Jours bonus activés</p>
                      <p className="text-sm text-gray-500">+{confirmation.bonusDays} jours offerts</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
  
          {/* Footer sécurisé */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <Shield className="h-4 w-4" />
              <span>Renouvellement 100% sécurisé</span>
              <span>•</span>
              <span>Chiffrement SSL</span>
              <span>•</span>
              <span>Confidentialité garantie</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Transaction #{confirmation.transactionId || 'En attente...'}
            </p>
          </div>
        </div>
      </div>
    );
  }