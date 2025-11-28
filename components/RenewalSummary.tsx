'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar,
  Gift,
  TrendingUp,
  Clock,
  RefreshCw,
  Zap,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface RenewalSummaryProps {
  className?: string;
}

interface RenewalData {
  subscription: {
    role: string;
    daysRemaining: number;
    isExpired: boolean;
    isExpiringSoon: boolean;
    urgencyLevel: string;
    planExpiresAt: string | null;
  };
  renewal: {
    isEligible: boolean;
    isEligibleForBonus: boolean;
    options: Array<{
      duration: string;
      durationText: string;
      totalPrice: number;
      bonusDays: number;
      savings: number;
    }>;
    savingsComparison: Array<{
      duration: string;
      monthlyEquivalent: number;
      totalSavings: number;
      bonusDays: number;
    }>;
  };
}

export default function RenewalSummary({ className = '' }: RenewalSummaryProps) {
  const [renewalData, setRenewalData] = useState<RenewalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/v1/subscription/renewal-info', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            // Rediriger vers la page de connexion si non authentifié
            window.location.href = '/auth/login';
            return;
          }
          throw new Error('Erreur lors de la récupération des informations');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setRenewalData(data.data);
        } else {
          console.error('Erreur dans la réponse du serveur:', data.error);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des informations de renouvellement:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!renewalData || !renewalData.renewal.isEligible) {
    return null;
  }

  const { subscription, renewal } = renewalData;
  
  const getBestOption = () => {
    return renewal.options.find(opt => opt.duration === '3') || renewal.options[0];
  };

  const bestOption = getBestOption();

  const getStatusInfo = () => {
    if (subscription.isExpired) {
      return {
        icon: AlertTriangle,
        iconColor: 'text-red-500',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        status: 'Expiré',
        message: 'Votre abonnement a expiré'
      };
    }

    if (subscription.urgencyLevel === 'high') {
      return {
        icon: Clock,
        iconColor: 'text-orange-500',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        status: `${subscription.daysRemaining} jour${subscription.daysRemaining > 1 ? 's' : ''}`,
        message: 'Expire bientôt'
      };
    }

    return {
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      status: `${subscription.daysRemaining} jours`,
      message: 'Abonnement actif'
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {/* En-tête */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Abonnement {subscription.role}
          </h3>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.textColor}`}>
            <StatusIcon className={`h-3 w-3 mr-1 ${statusInfo.iconColor}`} />
            {statusInfo.status}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Statut actuel */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Statut</span>
            <span className={`text-sm font-medium ${statusInfo.textColor}`}>
              {statusInfo.message}
            </span>
          </div>
          
          {subscription.planExpiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Expire le</span>
              <span className="text-sm font-medium text-gray-900">
                {new Intl.DateTimeFormat('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }).format(new Date(subscription.planExpiresAt))}
              </span>
            </div>
          )}
        </div>

        {/* Options de renouvellement rapide */}
        {bestOption && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Renouvellement recommandé</h4>
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-indigo-900">{bestOption.durationText}</span>
                <span className="text-lg font-bold text-indigo-900">
                  {bestOption.totalPrice.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              
              <div className="space-y-1 text-xs text-indigo-700">
                {bestOption.savings > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Économies</span>
                    <span className="font-medium">-{bestOption.savings.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
                
                {bestOption.bonusDays > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Bonus fidélité</span>
                    <span className="font-medium text-green-600">+{bestOption.bonusDays} jours gratuits</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between border-t border-indigo-200 pt-2 mt-2">
                  <span className="font-medium">Jours totaux ajoutés</span>
                  <span className="font-bold">
                    {(parseInt(bestOption.duration) * 30) + bestOption.bonusDays} jours
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bonus de fidélité disponible */}
        {renewal.isEligibleForBonus && (
          <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center mb-2">
              <Gift className="h-4 w-4 text-green-500 mr-2" />
              <span className="text-sm font-medium text-green-900">
                Bonus de fidélité disponible
              </span>
            </div>
            <p className="text-xs text-green-700">
              Renouvelez maintenant et recevez des jours gratuits supplémentaires !
            </p>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/dashboard/upgrade?mode=renewal')}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Renouveler maintenant
            {renewal.isEligibleForBonus && <Gift className="h-4 w-4 ml-2" />}
          </button>
          
          <button
            onClick={() => router.push('/dashboard/billing')}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm hover:bg-gray-200 transition-colors"
          >
            Voir l'historique de facturation
          </button>
        </div>

        {/* Informations supplémentaires */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Plan actuel</span>
            <span className="font-medium">{subscription.role}</span>
          </div>
          
          {subscription.daysRemaining > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
              <span>Temps restant</span>
              <span className="font-medium">
                {subscription.daysRemaining} jour{subscription.daysRemaining > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}