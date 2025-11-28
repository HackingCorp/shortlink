'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
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
  ArrowLeft
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

// Fonction pour formater le prix
const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
};

// Fonction pour déterminer l'opérateur depuis le payItemId
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

// Composant LoadingSpinner
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

// Composant ErrorDisplay
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
          <Link href="/dashboard/upgrade" className="block">
            <Button variant="outline" className="w-full">
              Retour à la sélection des forfaits
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

// Composant StatusIcon
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

// Fonction pour obtenir le titre du statut
function getStatusTitle(status: PaymentStatus, errorCode?: number): string {
  if (errorCode === 703202) return 'Paiement Rejeté';
  if (errorCode === 703201) return 'Paiement Non Confirmé';
  if (errorCode === 703108) return 'Solde Insuffisant';
  
  switch (status) {
    case 'success': 
    case '201': 
      return 'Paiement Confirmé !';
    case 'pending': return 'Paiement en Cours';
    case 'errored': 
    case '400': 
    case '403': 
    case '404': 
    case '500': 
    case '401': 
      return 'Erreur de Paiement';
    case 'cancelled': return 'Paiement Annulé';
    default: return 'Statut Inconnu';
  }
}

// Fonction pour obtenir la description du statut
function getStatusDescription(status: PaymentStatus, method?: PaymentMethod, errorCode?: number, errorMessage?: string): string {
  if (errorCode === 703202) return 'Vous avez rejeté la transaction sur votre mobile. Aucun montant n\'a été débité.';
  if (errorCode === 703201) return 'Vous n\'avez pas confirmé la transaction à temps. Aucun montant n\'a été débité.';
  if (errorCode === 703108) return 'Votre solde est insuffisant pour effectuer ce paiement.';
  if (errorCode === 704005) return 'La transaction a échoué. Veuillez réessayer.';
  
  if (errorMessage) return errorMessage;
  
  switch (status) {
    case 'success':
    case '201':
      return 'Votre paiement a été traité avec succès. Votre abonnement est maintenant actif.';
    case 'pending':
      return method === 'mobile' 
        ? 'Veuillez confirmer le paiement sur votre téléphone. Le traitement peut prendre quelques minutes.'
        : 'Votre paiement est en cours de traitement. Vous recevrez une notification dès confirmation.';
    case 'errored':
    case '400':
    case '403':
    case '404':
    case '500':
    case '401':
      return 'Une erreur est survenue lors du traitement de votre paiement. Veuillez réessayer.';
    case 'cancelled':
      return 'Le paiement a été annulé. Aucun montant n\'a été débité.';
    default:
      return 'Statut de paiement non reconnu.';
  }
}

// Composant TransactionDetails
function TransactionDetails({ confirmation }: { confirmation: PaymentConfirmation }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Détails de la transaction</h2>
      
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

        {confirmation.planName && (
          <DetailRow label="Forfait" value={confirmation.planName} />
        )}

        {confirmation.duration && (
          <DetailRow label="Durée" value={confirmation.duration} />
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

// Composant DetailRow
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-100">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

// Composant SecurityInfo
function SecurityInfo({ status }: { status: PaymentStatus }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <Shield className="h-6 w-6 text-green-600 mr-3" />
        <h3 className="font-semibold text-gray-900">Paiement sécurisé</h3>
      </div>
      <p className="text-sm text-gray-600">
        {status === 'success' 
          ? 'Votre transaction a été traitée de manière sécurisée.'
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
          <Link href="/dashboard/upgrade">
            <Button variant="outline" className="w-full bg-red-600 text-white hover:bg-red-700">
              Réessayer le paiement
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
          support@votresite.com
        </div>
        <div className="flex items-center">
          <Smartphone className="h-3 w-3 mr-2" />
          +237 XXX XXX XXX
        </div>
      </div>
    </div>
  );
}

// Composant AdditionalMessages
function AdditionalMessages({ 
  status, 
  planName, 
  errorCode, 
  errorMessage, 
  operator,
  hasUpdatedPlan 
}: { 
  status: PaymentStatus; 
  planName?: string | null; 
  errorCode?: number; 
  errorMessage?: string; 
  operator?: Operator;
  hasUpdatedPlan?: boolean;
}) {
  
  if (status === 'success' || status === '201') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
        <div className="flex items-start">
          <CheckCircle className="h-6 w-6 text-green-600 mt-0.5 mr-3" />
          <div>
            <h3 className="font-semibold text-green-900 mb-2">
              {hasUpdatedPlan ? 'Votre abonnement est actif !' : 'Activation de votre abonnement...'}
            </h3>
            <p className="text-green-700">
              {hasUpdatedPlan 
                ? `Vous pouvez maintenant profiter de toutes les fonctionnalités de votre forfait ${planName}. Un email de confirmation vous a été envoyé.`
                : `Votre forfait ${planName} est en cours d'activation. Cette opération peut prendre quelques instants.`
              }
            </p>
            {!hasUpdatedPlan && (
              <p className="text-green-600 text-sm mt-2">
                ⏳ Veuillez patienter pendant l'activation de votre compte...
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
              Veuillez recharger votre compte {getOperatorName(operator)} et réessayer le paiement.
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
            <h3 className="font-semibold text-orange-900 mb-2">Transaction interrompue</h3>
            <p className="text-orange-700">
              {errorCode === 703202 
                ? 'Vous avez rejeté la transaction. Aucun montant n\'a été débité.'
                : 'Vous n\'avez pas confirmé la transaction à temps. Aucun montant n\'a été débité.'
              }
            </p>
            <p className="text-orange-600 text-sm mt-2">
              Vous pouvez réessayer le paiement à tout moment.
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
              Votre paiement est en cours de traitement. Cette opération peut prendre quelques minutes.
              Vous recevrez une notification dès que le paiement sera confirmé.
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
            <h3 className="font-semibold text-red-900 mb-2">Erreur de paiement</h3>
            <p className="text-red-700">
              {errorMessage || 'Une erreur est survenue lors du traitement de votre paiement.'}
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

export default function UpgradeConfirmationPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <UpgradeConfirmationContent />
    </Suspense>
  );
}

function UpgradeConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, update, status: sessionStatus } = useSession();
  
  const [confirmation, setConfirmation] = useState<PaymentConfirmation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [hasUpdatedPlan, setHasUpdatedPlan] = useState(false);

  const getPaymentData = useCallback((): PaymentConfirmation | null => {
    try {
      const paymentData = localStorage.getItem('lastPayment');
      if (paymentData) {
        const data = JSON.parse(paymentData);
        console.log('📦 Données de paiement récupérées:', data);
        
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
    console.log('🧹 Données de paiement nettoyées');
  }, []);

  const updateUserPlan = useCallback(async (planName?: string, transactionId?: string) => {
    if (hasUpdatedPlan) {
      console.log('🔄 Plan déjà mis à jour');
      return true;
    }

    try {
      const savedData = getPaymentData();

     
      
      if (!planName && savedData?.amount) { 
          planName = determinePlanFromAmount(savedData.amount);
          console.log('🔍 Plan déterminé depuis montant:', planName);
        
      }

      if (!planName) {
        console.warn('⚠️ Aucun plan name disponible pour la mise à jour');
        return false;
      }

      const response = await fetch('/api/v1/user/update-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: planName.toUpperCase(),
          status: 'active',
          upgradedAt: new Date().toISOString(),
          transactionId: transactionId,
          durationMonths: savedData?.durationMonths || 1
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Plan utilisateur mis à jour:', result);

      if (result.success) {
        // Mettre à jour la session NextAuth
        await update({ 
          ...session,
          user: {
            ...session?.user,
            role: planName.toUpperCase(),
            planExpiresAt: result.user.planExpiresAt
          }
        });
        
        return result;
      }
      
      setHasUpdatedPlan(true);
      console.log('🎉 Session mise à jour avec le nouveau plan');
      return true;

    } catch (error) {
      console.error('❌ Erreur mise à jour plan:', error);
      return false;
    }
  }, [update, hasUpdatedPlan, getPaymentData]);

  const determinePlanFromAmount = useCallback((amount: number): string => {
    const planPrices = {
      'STANDARD': 9990,
      'PRO': 19990,
      'ENTERPRISE': 32900
    };

    const closestPlan = Object.entries(planPrices).reduce((closest, [plan, price]) => {
      const currentDiff = Math.abs(amount - price);
      const closestDiff = Math.abs(amount - (planPrices[closest as keyof typeof planPrices] || 0));
      return currentDiff < closestDiff ? plan : closest;
    }, 'STANDARD');

    console.log(`💰 Plan déterminé: ${closestPlan} pour montant: ${amount}`);
    return closestPlan;
  }, []);

  const handleSuccessfulPayment = useCallback(async (confirmationData: PaymentConfirmation) => {
    try {
      console.log('💰 Traitement du paiement réussi...', confirmationData);
      
      const { planName, transactionId, amount } = confirmationData;
      
    if (planName) {
      const updateSuccess = await updateUserPlan(planName, transactionId);
      
      if (!updateSuccess && amount) {
        const determinedPlan = determinePlanFromAmount(amount);
        await updateUserPlan(determinedPlan, transactionId);
      }
    } else if (amount) {
      const determinedPlan = determinePlanFromAmount(amount);
      await updateUserPlan(determinedPlan, transactionId);
    }
      
      cleanupPaymentData();
      
   
      
      console.log('✅ Traitement paiement réussi terminé');

    } catch (error) {
      console.error('❌ Erreur traitement paiement réussi:', error);
    }
  }, [updateUserPlan, determinePlanFromAmount, cleanupPaymentData, update]);

  const verifyS3PPayment = useCallback(async (transactionId: string, operator?: Operator, savedData?: any) => {
    try {
      console.log(`🔍 Vérification S3P pour transaction: ${transactionId}, opérateur: ${operator}`);
      
      const response = await fetch(`/api/v1/payment/s3p/verify?transactionId=${transactionId}`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📋 Réponse S3P:', data);

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

      if (transaction.status === 'SUCCESS') {
        status = 'success';
        
        if (savedData) {
          const confirmationData: PaymentConfirmation = {
            ...savedData,
            status: 'success',
            transactionId: transactionId,
            operator: operator,
            errorCode: errorCode,
            errorMessage: errorMessage,
            timestamp: new Date().toISOString()
          };
          
          await handleSuccessfulPayment(confirmationData);
        }
      } else if (transaction.status === 'ERRORED' && errorCode !== undefined) {
        const errorConfig = S3P_ERROR_CODES[errorCode as keyof typeof S3P_ERROR_CODES];
        status = errorConfig ? errorConfig.status : 'errored';
        errorMessage = getS3PErrorMessage(errorCode, operator || 'unknown');
      }

      console.log(`📊 Statut S3P déterminé: ${status}, Code erreur: ${errorCode}, Message: ${errorMessage}`);

      return { 
        status, 
        errorCode, 
        errorMessage,
        transactionData: transaction 
      };

    } catch (error) {
      console.error('❌ Erreur vérification S3P:', error);
      return { 
        status: 'pending' as PaymentStatus, 
        errorCode: undefined, 
        errorMessage: 'Erreur de vérification du statut',
        transactionData: null
      };
    }
  }, [handleSuccessfulPayment]);

// Modifiez la fonction verifyEnkapPayment pour qu'elle gère correctement le statut
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

    // Vérification directe du statut success depuis la racine
    if (data.status === 'success') {
      console.log('✅ Paiement e-nkap confirmé comme réussi (racine)');
      
      if (savedData && !hasUpdatedPlan) {
        const confirmationData: PaymentConfirmation = {
          ...savedData,
          status: 'success',
          transactionId: transactionId,
          provider: 'enkap',
          timestamp: new Date().toISOString()
        };
        
        await handleSuccessfulPayment(confirmationData);
      }
      
      return { 
        status: 'success' as PaymentStatus,
        errorCode: undefined,
        errorMessage: '',
        transactionData: data
      };
    }

    // Traitement de la réponse standard e-nkap avec data.success
    if (data.success && data.data) {
      const statusMapping: { [key: string]: PaymentStatus } = {
        'CONFIRMED': 'success',
        'COMPLETED': 'success', 
        'SUCCESS': 'success',
        'PENDING': 'pending',
        'IN_PROGRESS': 'pending',
        'FAILED': 'errored',
        'CANCELLED': 'cancelled',
        'CREATED': 'pending',
        'INITIALISED': 'pending'
      };

      const enkapStatus = data.data.status || data.data.paymentStatus;
      const status = statusMapping[enkapStatus] || 'pending';
      
      console.log(`📊 Statut e-nkap: ${enkapStatus} -> ${status}`);

      let errorMessage = '';

      if (status === 'success' && savedData && !hasUpdatedPlan) {
        console.log('✅ Paiement e-nkap réussi, mise à jour du plan...');
        const confirmationData: PaymentConfirmation = {
          ...savedData,
          status: 'success',
          transactionId: transactionId,
          provider: 'enkap',
          timestamp: new Date().toISOString()
        };
        
        await handleSuccessfulPayment(confirmationData);
      }

      if (status === 'errored') {
        errorMessage = data.data.message || 'Le paiement a échoué';
      }

      return { 
        status, 
        errorCode: undefined, 
        errorMessage,
        transactionData: data.data 
      };
    }

    // Si data.success est false ou réponse inattendue
    if (!data.success) {
      return { 
        status: 'pending' as PaymentStatus, 
        errorCode: undefined, 
        errorMessage: data.error || 'En attente de confirmation',
        transactionData: null
      };
    }

    // Par défaut, on considère que c'est en attente
    return { 
      status: 'pending' as PaymentStatus, 
      errorCode: undefined, 
      errorMessage: 'En attente de confirmation',
      transactionData: null
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
}, [handleSuccessfulPayment, hasUpdatedPlan]);

// Ajoutez un état pour suivre les vérifications en cours
const [isVerifying, setIsVerifying] = useState(false);
const processEnkapNotification = useCallback(async (searchParams: URLSearchParams) => {
  const enkapTxId = searchParams.get('enkap_transaction_id');
  const merchantRef = searchParams.get('enkap_merchant_reference');
  const statusParam = searchParams.get('status');

  if (enkapTxId || merchantRef) {
    console.log('📨 Notification e-nkap détectée:', { enkapTxId, merchantRef, statusParam });
    
    const savedData = getPaymentData();
    const result = await verifyEnkapPayment(enkapTxId || '', merchantRef || '', savedData);
    
    const updatedData: PaymentConfirmation = {
      ...savedData,
      status: result.status,
      transactionId: enkapTxId || savedData?.transactionId,
      provider: 'enkap',
      paymentMethod: savedData?.paymentMethod || 'card',
      errorMessage: result.errorMessage,
      timestamp: new Date().toISOString()
    };

    setConfirmation(updatedData);
    
    // Plus besoin d'appeler handleSuccessfulPayment ici car c'est fait dans verifyEnkapPayment
    return updatedData;
  }

  return null;
}, [verifyEnkapPayment, getPaymentData]);

// Modifiez le useEffect principal avec une gestion robuste de l'état
useEffect(() => {
  const loadConfirmation = async () => {
    // Éviter les vérifications multiples simultanées
    if (isVerifying) {
      console.log('⏸️ Vérification déjà en cours, attente...');
      return;
    }

    try {
      setIsVerifying(true);
      setIsLoading(true);
      setError(null);
      
      const status = searchParams.get('status') as PaymentStatus;
      const transactionId = searchParams.get('transactionId');
      const provider = searchParams.get('provider') as 's3p' | 'enkap';
      const errorCode = searchParams.get('errorCode');
      const planFromUrl = searchParams.get('plan');
      
      console.log('🔄 Début du chargement de confirmation', {
        status, transactionId, provider, errorCode, planFromUrl
      });

      // Traitement des notifications e-nkap en premier
      const enkapNotification = await processEnkapNotification(searchParams);
      if (enkapNotification) {
        console.log('✅ Notification e-nkap traitée:', enkapNotification);
        
        // Si le statut est déjà en succès, on arrête tout
        if (enkapNotification.status === 'success') {
          console.log('🎉 Paiement e-nkap réussi - arrêt des vérifications');
          setConfirmation(enkapNotification);
          setIsLoading(false);
          setIsVerifying(false);
          return;
        }
      }

      const savedData = getPaymentData();
      
      if (savedData?.provider === 's3p') {
        if (!savedData.planName && planFromUrl) {
          savedData.planName = planFromUrl;
        }
        
        if (!savedData.transactionId && transactionId) {
          savedData.transactionId = transactionId;
        }
      }

      // Vérifier si on a déjà un statut final qui ne nécessite plus de vérification
      const hasFinalStatus = confirmation?.status === 'success' || 
                            confirmation?.status === '201' || 
                            confirmation?.status === 'cancelled' ||
                            (confirmation?.errorCode && (confirmation.errorCode === 703202 || confirmation.errorCode === 703201));

      if (hasFinalStatus) {
        console.log('✅ Statut final déjà atteint, arrêt des vérifications:', confirmation?.status);
        setIsLoading(false);
        setIsVerifying(false);
        return;
      }

      if (!savedData && !status && !transactionId && !enkapNotification) {
        setError('Aucune information de paiement trouvée. La session a peut-être expiré.');
        setIsLoading(false);
        setIsVerifying(false);
        return;
      }

      let finalStatus: PaymentStatus = status || savedData?.status || enkapNotification?.status || 'pending';
      let finalTransactionId = transactionId || savedData?.transactionId || enkapNotification?.transactionId;
      let finalProvider = provider || savedData?.provider || enkapNotification?.provider || 's3p';
      let operator = savedData?.operator || enkapNotification?.operator || getOperatorFromPayItemId(savedData?.payItemId);
      const planName = savedData?.planName || enkapNotification?.planName || planFromUrl;
      
      console.log('✅ Données de confirmation fusionnées:', { 
        finalStatus, 
        finalTransactionId, 
        finalProvider, 
        operator, 
        planName
      });

      // ARRÊTER IMMÉDIATEMENT si statut final déjà atteint
      if (finalStatus === 'success' || finalStatus === '201' || finalStatus === 'cancelled') {
        console.log('🚫 Statut final détecté, pas de vérification nécessaire:', finalStatus);
        const finalConfirmation: PaymentConfirmation = {
          status: finalStatus,
          transactionId: finalTransactionId,
          paymentMethod: savedData?.paymentMethod || enkapNotification?.paymentMethod,
          operator: operator,
          amount: savedData?.amount || enkapNotification?.amount,
          currency: savedData?.currency || enkapNotification?.currency,
          planName: planName,
          duration: savedData?.duration || enkapNotification?.duration,
          timestamp: new Date().toISOString(),
          customerEmail: session?.user?.email ?? undefined,
          customerName: session?.user?.name ?? undefined,
          provider: finalProvider,
          errorCode: errorCode ? parseInt(errorCode) : savedData?.errorCode,
          errorMessage: savedData?.errorMessage || enkapNotification?.errorMessage,
          payItemId: savedData?.payItemId
        };

        setConfirmation(finalConfirmation);
        
        if ((finalStatus === 'success' || finalStatus === '201') && !hasUpdatedPlan) {
          console.log('🎉 Mise à jour du plan pour statut final...');
          await handleSuccessfulPayment(finalConfirmation);
        }
        
        setIsLoading(false);
        setIsVerifying(false);
        return;
      }

      // Vérification S3P pour les transactions en attente
      if (finalTransactionId && finalStatus === 'pending' && finalProvider === 's3p') {
        console.log('🔄 Vérification S3P en cours...');
        const s3pResult = await verifyS3PPayment(finalTransactionId, operator, savedData);
        finalStatus = s3pResult.status;
        
        const updatedConfirmation: PaymentConfirmation = {
          ...savedData,
          status: s3pResult.status,
          transactionId: finalTransactionId,
          errorCode: s3pResult.errorCode,
          errorMessage: s3pResult.errorMessage,
          operator: operator,
          planName: planName,
          timestamp: new Date().toISOString()
        };
        
        setConfirmation(updatedConfirmation);
        
        if (s3pResult.status === 'success') {
          console.log('✅ S3P réussi - arrêt des vérifications');
          setIsLoading(false);
          setIsVerifying(false);
          return;
        }
      }

      // Vérification e-nkap pour les transactions en attente
      if (finalTransactionId && finalStatus === 'pending' && finalProvider === 'enkap') {
        console.log('🔄 Vérification e-nkap en cours...');
        const enkapResult = await verifyEnkapPayment(finalTransactionId, undefined, savedData);
        finalStatus = enkapResult.status;
        
        const updatedConfirmation: PaymentConfirmation = {
          ...savedData,
          status: enkapResult.status,
          transactionId: finalTransactionId,
          errorMessage: enkapResult.errorMessage,
          provider: 'enkap',
          planName: planName,
          timestamp: new Date().toISOString()
        };
        
        setConfirmation(updatedConfirmation);
        
        if (enkapResult.status === 'success') {
          console.log('✅ e-nkap réussi - arrêt des vérifications');
          setIsLoading(false);
          setIsVerifying(false);
          return;
        }
      }

      // Gestion des codes d'erreur directs depuis l'URL
      if (errorCode && finalStatus === 'pending') {
        const errorNum = parseInt(errorCode);
        const errorConfig = S3P_ERROR_CODES[errorNum as keyof typeof S3P_ERROR_CODES];
        if (errorConfig) {
          finalStatus = errorConfig.status;
        }
      }

      // Création de la confirmation finale
      const finalConfirmation: PaymentConfirmation = {
        status: finalStatus,
        transactionId: finalTransactionId,
        paymentMethod: savedData?.paymentMethod || enkapNotification?.paymentMethod,
        operator: operator,
        amount: savedData?.amount || enkapNotification?.amount,
        currency: savedData?.currency || enkapNotification?.currency,
        planName: planName,
        duration: savedData?.duration || enkapNotification?.duration,
        timestamp: new Date().toISOString(),
        customerEmail: session?.user?.email ?? undefined,
        customerName: session?.user?.name ?? undefined,
        provider: finalProvider,
        errorCode: errorCode ? parseInt(errorCode) : savedData?.errorCode,
        errorMessage: savedData?.errorMessage || enkapNotification?.errorMessage,
        payItemId: savedData?.payItemId
      };

      setConfirmation(finalConfirmation);
      console.log('✅ Confirmation finale mise à jour:', finalConfirmation);

      // Gestion des tentatives de vérification pour les paiements en attente
      if (finalStatus === 'pending' && verificationAttempts < 10) {
        const delay = Math.min(3000 + (verificationAttempts * 2000), 10000);
        console.log(`⏳ Nouvelle tentative dans ${delay}ms (${verificationAttempts + 1}/10)`);
        
        setTimeout(() => {
          setVerificationAttempts(prev => prev + 1);
          setIsVerifying(false); // Réautoriser la vérification pour le prochain cycle
        }, delay);
      } else {
        console.log('🏁 Fin des vérifications (max atteint ou statut final)');
        setIsLoading(false);
        setIsVerifying(false);
      }

      // Si statut final, arrêter immédiatement
      if (finalStatus !== 'pending') {
        console.log('🏁 Statut final, arrêt des vérifications');
        setIsLoading(false);
        setIsVerifying(false);
      }

    } catch (err) {
      console.error('❌ Erreur chargement confirmation:', err);
      setError('Erreur lors du chargement de la confirmation');
      setIsLoading(false);
      setIsVerifying(false);
    }
  };

  loadConfirmation();
}, [
  searchParams, 
  session, 
  getPaymentData, 
  handleSuccessfulPayment,
  verifyS3PPayment,
  verifyEnkapPayment,
  processEnkapNotification,
  verificationAttempts,
  hasUpdatedPlan,
  isVerifying,
  confirmation // Ajouter confirmation comme dépendance
]);

  const retryVerification = useCallback(() => {
    setVerificationAttempts(0);
    setIsLoading(true);
    setError(null);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }, []);

  // Afficher les différents états
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
    return <ErrorDisplay error="Aucune information de paiement disponible" onRetry={retryVerification} />;
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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

        {/* Détails de la transaction */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div className="md:col-span-2">
            <TransactionDetails confirmation={confirmation} />
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
        />

        {/* Section informations complémentaires */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {/* Prochaines étapes pour succès */}
          {(confirmation.status === 'success' || confirmation.status === '201') && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Prochaines étapes</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Votre forfait est maintenant actif</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Vous recevrez un email de confirmation</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Accédez à toutes les fonctionnalités de votre forfait</span>
                </li>
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
                  <span>Assurez-vous que le service est activé</span>
                </li>
                <li className="flex items-start">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span>Réessayez dans quelques minutes</span>
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
                <span>support@votresite.com</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Smartphone className="h-4 w-4 mr-2 text-gray-400" />
                <span>+237 XXX XXX XXX</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                <span>Lun - Ven: 8h - 18h</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer sécurisé */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
            <Shield className="h-4 w-4" />
            <span>Paiement 100% sécurisé</span>
            <span>•</span>
            <span>Chiffrement SSL</span>
            <span>•</span>
            <span>Confidentialité garantie</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant Clock manquant
function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
