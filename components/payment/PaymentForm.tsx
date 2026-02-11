// components/payment/PaymentForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
// @ts-ignore
import { toast } from 'react-toastify';

// Types pour les packages de paiement
interface PaymentPackage {
  id: string;
  amount: number;
  currency: string;
  description: string;
  serviceId: number;
  merchant: string;
  metadata?: Record<string, any>;
}

export default function PaymentForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<PaymentPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PaymentPackage | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('standard');
  const [duration, setDuration] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Charger les packages au montage
  useEffect(() => {
    async function loadPackages() {
      try {
        setLoading(true);
        const response = await fetch('/api/v1/payment/s3p/packages');
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Erreur de chargement des options de paiement');
        }
        
        setPackages(data.data || []);
        if (data.data?.length > 0) {
          setSelectedPackage(data.data[0]);
        }
      } catch (error: any) {
        console.error('Erreur:', error);
        toast.error(error.message || 'Impossible de charger les options de paiement');
      } finally {
        setLoading(false);
      }
    }
    
    loadPackages();
  }, []);

  // Gérer la soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPackage) {
      toast.error('Veuillez sélectionner un montant');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 9) {
      toast.error('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/payment/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageId: selectedPackage.id,
          phoneNumber: phoneNumber,
          customerName: session?.user?.name || 'Client',
          customerEmail: session?.user?.email,
          metadata: {
            planId: selectedPlan,
            durationMonths: duration,
            operator: selectedPackage.merchant.toLowerCase()
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du traitement du paiement');
      }

      if (data.paymentUrl) {
        // Rediriger vers la page de paiement
        window.location.href = data.paymentUrl;
      } else if (data.status === 'SUCCESS') {
        // Paiement réussi (pour les simulations)
        toast.success('Paiement effectué avec succès !');
        router.push('/dashboard/subscription/success');
      } else {
        // Autres statuts
        toast.info('Votre paiement est en cours de traitement...');
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error(error.message || 'Une erreur est survenue lors du traitement de votre demande');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Afficher un indicateur de chargement pendant le chargement des packages
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Chargement des options de paiement...</p>
      </div>
    );
  }

  // Afficher un message si aucun package n'est disponible
  if (packages.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md text-center">
        <p className="text-red-500">Aucune option de paiement disponible pour le moment.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Paiement par Mobile Money</h2>
      
      {/* Sélection du montant */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Montant <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedPackage(pkg)}
              className={`p-4 border rounded-lg text-center transition-colors ${
                selectedPackage?.id === pkg.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-bold text-lg">
                {pkg.amount.toLocaleString()} {pkg.currency}
              </div>
              {pkg.description && (
                <div className="text-sm text-gray-600 mt-1">{pkg.description}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Numéro de téléphone */}
      <div className="mb-6">
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
          Numéro de téléphone <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className="text-gray-500">+237</span>
          </div>
          <input
            id="phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
            placeholder="6XXXXXXXX"
            className="w-full pl-14 p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required
            maxLength={9}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">Format: 6XXXXXXXX (sans espace ni tiret)</p>
      </div>

      {/* Plan d'abonnement */}
      <div className="mb-6">
        <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-2">
          Plan d'abonnement
        </label>
        <select
          id="plan"
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="standard">Standard</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Durée d'abonnement */}
      <div className="mb-8">
        <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
          Durée d'abonnement
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 3, 6, 12].map((months) => (
            <button
              key={months}
              type="button"
              onClick={() => setDuration(months)}
              className={`p-3 border rounded-md text-center ${
                duration === months
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              {months} {months > 1 ? 'mois' : 'mois'}
            </button>
          ))}
        </div>
      </div>

      {/* Bouton de soumission */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          {isSubmitting ? (
            <>
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
              Traitement...
            </>
          ) : (
            `Payer ${selectedPackage?.amount.toLocaleString()} ${selectedPackage?.currency}`
          )}
        </button>
      </div>

      {/* Avertissement en mode développement */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Mode développement activé. Les paiements sont simulés.
              </p>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}