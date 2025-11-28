'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle, 
  Gift, 
  Calendar, 
  Clock, 
  RefreshCw, 
  X,
  Zap
} from 'lucide-react';

interface RenewalAlertProps {
  userId?: string;
  className?: string;
}

interface RenewalInfo {
  subscription: {
    role: string;
    daysRemaining: number;
    isExpired: boolean;
    isExpiringSoon: boolean;
    urgencyLevel: 'none' | 'low' | 'medium' | 'high';
    planExpiresAt: string | null;
  };
  renewal: {
    isEligible: boolean;
    isEligibleForBonus: boolean;
  };
  bonusInfo: {
    available: boolean;
    structure: Array<{
      duration: string;
      bonusDays: number;
    }>;
  };
}

export default function RenewalAlert({ userId, className = '' }: RenewalAlertProps) {
  const [renewalInfo, setRenewalInfo] = useState<RenewalInfo | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchRenewalInfo = async () => {
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
          setRenewalInfo(data.data);
        } else {
          console.error('Erreur dans la réponse du serveur:', data.error);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des informations de renouvellement:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRenewalInfo();
  }, []);

  // Ne pas afficher l'alerte si pas de données ou pas éligible
  if (isLoading || !renewalInfo || !renewalInfo.renewal.isEligible || !isVisible) {
    return null;
  }

  const { subscription, renewal, bonusInfo } = renewalInfo;

  // Déterminer le type d'alerte à afficher
  const getAlertConfig = () => {
    if (subscription.isExpired) {
      return {
        type: 'expired',
        icon: AlertTriangle,
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        iconColor: 'text-red-500',
        titleColor: 'text-red-800',
        textColor: 'text-red-700',
        buttonColor: 'bg-red-600 hover:bg-red-700',
        title: 'Abonnement expiré',
        message: 'Votre abonnement a expiré. Renouvelez maintenant pour retrouver toutes vos fonctionnalités.',
        actionText: 'Renouveler maintenant'
      };
    }

    if (subscription.urgencyLevel === 'high') {
      return {
        type: 'urgent',
        icon: Clock,
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        iconColor: 'text-orange-500',
        titleColor: 'text-orange-800',
        textColor: 'text-orange-700',
        buttonColor: 'bg-orange-600 hover:bg-orange-700',
        title: `Plus que ${subscription.daysRemaining} jour${subscription.daysRemaining > 1 ? 's' : ''}`,
        message: renewal.isEligibleForBonus 
          ? 'Renouvelez maintenant et recevez des jours bonus gratuits !'
          : 'Votre abonnement expire bientôt. Renouvelez maintenant.',
        actionText: 'Renouveler avec bonus'
      };
    }

    if (subscription.urgencyLevel === 'medium') {
      return {
        type: 'reminder',
        icon: Calendar,
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        iconColor: 'text-yellow-500',
        titleColor: 'text-yellow-800',
        textColor: 'text-yellow-700',
        buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
        title: `${subscription.daysRemaining} jours restants`,
        message: renewal.isEligibleForBonus 
          ? 'Renouvelez avant expiration et bénéficiez de jours bonus !'
          : 'Pensez à renouveler votre abonnement.',
        actionText: 'Voir les options'
      };
    }

    if (renewal.isEligibleForBonus) {
      return {
        type: 'bonus',
        icon: Gift,
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        iconColor: 'text-green-500',
        titleColor: 'text-green-800',
        textColor: 'text-green-700',
        buttonColor: 'bg-green-600 hover:bg-green-700',
        title: 'Bonus de fidélité disponible',
        message: 'Renouvelez maintenant et recevez jusqu\'à 14 jours gratuits supplémentaires !',
        actionText: 'Renouveler avec bonus'
      };
    }

    return null;
  };

  const alertConfig = getAlertConfig();
  if (!alertConfig) return null;

  const Icon = alertConfig.icon;

  const handleRenewal = () => {
    router.push('/dashboard/upgrade?mode=renewal');
  };

  const formatExpirationDate = (dateString: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(dateString));
  };

  return (
    <div className={`${alertConfig.bgColor} border ${alertConfig.borderColor} rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${alertConfig.iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${alertConfig.titleColor}`}>
            {alertConfig.title}
          </h3>
          <div className={`mt-1 text-sm ${alertConfig.textColor}`}>
            <p>{alertConfig.message}</p>
            
            {subscription.planExpiresAt && (
              <p className="mt-1 text-xs opacity-75">
                Expire le {formatExpirationDate(subscription.planExpiresAt)}
              </p>
            )}

            {/* Affichage des bonus disponibles */}
            {renewal.isEligibleForBonus && (
              <div className="mt-2 flex flex-wrap gap-2">
                {bonusInfo.structure.slice(0, 2).map((bonus, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/50 text-green-800"
                  >
                    {bonus.duration}: +{bonus.bonusDays}j
                  </span>
                ))}
                {bonusInfo.structure.length > 2 && (
                  <span className="text-xs opacity-75">...</span>
                )}
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center space-x-3">
            <button
              onClick={handleRenewal}
              className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white ${alertConfig.buttonColor} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {alertConfig.actionText}
            </button>
            
            {alertConfig.type !== 'expired' && (
              <button
                onClick={() => setIsVisible(false)}
                className={`text-xs ${alertConfig.textColor} hover:opacity-75`}
              >
                Rappeler plus tard
              </button>
            )}
          </div>
        </div>
        
        {alertConfig.type !== 'expired' && (
          <div className="flex-shrink-0 ml-4">
            <button
              onClick={() => setIsVisible(false)}
              className={`inline-flex rounded-md ${alertConfig.textColor} hover:opacity-75`}
            >
              <span className="sr-only">Fermer</span>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook personnalisé pour utiliser les informations de renouvellement
export function useRenewalInfo() {
  const [renewalInfo, setRenewalInfo] = useState<RenewalInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRenewalInfo = async () => {
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
          setRenewalInfo(data.data);
        } else {
          console.error('Erreur dans la réponse du serveur:', data.error);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des informations de renouvellement:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRenewalInfo();
  }, []);

  return { renewalInfo, isLoading };
}
