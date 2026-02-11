'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
// @ts-ignore
import { toast } from 'react-toastify';

// Types pour les packages de cash-out
interface CashoutPackage {
  id: string;
  amount: number;
  currency: string;
  description: string;
  serviceId: string;
  merchant: string;
  metadata?: Record<string, any>;
}

// État du flux de cash-out
type CashoutFlowStep = 'select-amount' | 'enter-phone' | 'confirmation' | 'processing' | 'completed' | 'error';

export default function CashoutForm() {
  const { data: session } = useSession();
  const router = useRouter();
  
  // États pour le flux de cash-out
  const [step, setStep] = useState<CashoutFlowStep>('select-amount');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Données du formulaire
  const [packages, setPackages] = useState<CashoutPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<CashoutPackage | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED' | null>(null);

  // Charger les packages de cash-out au montage
  useEffect(() => {
    async function loadCashoutPackages() {
      try {
        setLoading(true);
        const response = await fetch('/api/v1/payment/s3p/cashout');
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Erreur de chargement des options de cash-out');
        }
        
        setPackages(data.data || []);
        if (data.data?.length > 0) {
          setSelectedPackage(data.data[0]);
        }
      } catch (error: any) {
        console.error('Erreur:', error);
        setError(error.message || 'Impossible de charger les options de cash-out');
        setStep('error');
      } finally {
        setLoading(false);
      }
    }
    
    loadCashoutPackages();
  }, []);

  // Vérifier l'état d'une transaction
  const checkTransactionStatus = async (txId: string) => {
    try {
      const response = await fetch(`/api/v1/payment/s3p/verify/${txId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de vérification du statut');
      }
      
      setTransactionStatus(data.status);
      
      // Si la transaction est toujours en attente, on vérifie à nouveau après un délai
      if (data.status === 'PENDING') {
        setTimeout(() => checkTransactionStatus(txId), 3000); // Vérifier toutes les 3 secondes
      } else if (data.status === 'SUCCESS') {
        setStep('completed');
        toast.success('Transaction effectuée avec succès!');
      } else {
        setError('Échec de la transaction. Veuillez réessayer.');
        setStep('error');
      }
    } catch (error: any) {
      console.error('Erreur de vérification:', error);
      // En cas d'erreur, on réessaie après un délai
      setTimeout(() => checkTransactionStatus(txId), 3000);
    }
  };

  // Étape 1: Obtenir une offre pour le montant sélectionné
  const handleGetQuote = async () => {
    if (!selectedPackage && !customAmount) {
      toast.error('Veuillez sélectionner un montant ou en saisir un personnalisé');
      return;
    }

    const amount = customAmount ? parseFloat(customAmount) : selectedPackage?.amount;
    if (isNaN(amount!) || amount! <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/v1/payment/s3p/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: 'XAF',
          serviceId: selectedPackage?.serviceId
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la génération de l\'offre');
      }
      
      // Stocker l'ID de la transaction pour les étapes suivantes
      setTransactionId(data.transactionId);
      setStep('enter-phone');
      
    } catch (error: any) {
      console.error('Erreur:', error);
      setError(error.message || 'Erreur lors de la génération de l\'offre');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Étape 2: Collecter le paiement
  const handleCollectPayment = async () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      toast.error('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    if (!transactionId) {
      setError('ID de transaction manquant');
      setStep('error');
      return;
    }

    try {
      setLoading(true);
      setStep('processing');
      
      const response = await fetch('/api/v1/payment/s3p/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          phoneNumber,
          customerName: session?.user?.name || 'Client',
          customerEmail: session?.user?.email,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la collecte du paiement');
      }
      
      // Démarrer la vérification de l'état de la transaction
      checkTransactionStatus(transactionId);
      
    } catch (error: any) {
      console.error('Erreur:', error);
      setError(error.message || 'Erreur lors de la collecte du paiement');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Réinitialiser le formulaire
  const resetForm = () => {
    setStep('select-amount');
    setError(null);
    setTransactionId(null);
    setTransactionStatus(null);
    setPhoneNumber('');
    setCustomAmount('');
  };

  // Rendu du formulaire en fonction de l'étape actuelle
  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-center">Retrait d'argent</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
          <button 
            onClick={resetForm}
            className="ml-4 text-red-700 font-semibold hover:underline"
          >
            Réessayer
          </button>
        </div>
      )}
      
      {loading && (
        <div className="mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded text-center">
          Traitement en cours...
        </div>
      )}
      
      {/* Étape 1: Sélection du montant */}
      {step === 'select-amount' && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Sélectionnez un montant</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg)}
                className={`p-4 border rounded-lg text-center ${
                  selectedPackage?.id === pkg.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="font-bold">{pkg.amount} {pkg.currency}</div>
                <div className="text-sm text-gray-600">{pkg.description}</div>
              </button>
            ))}
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ou saisissez un montant personnalisé
            </label>
            <div className="flex">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedPackage(null);
                }}
                placeholder="Montant en XAF"
                className="flex-1 p-2 border border-gray-300 rounded-l-md focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="inline-flex items-center px-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md">
                XAF
              </span>
            </div>
          </div>
          
          <button
            onClick={handleGetQuote}
            disabled={loading || (!selectedPackage && !customAmount)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Continuer
          </button>
        </div>
      )}
      
      {/* Étape 2: Saisie du numéro de téléphone */}
      {step === 'enter-phone' && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Entrez votre numéro de téléphone</h3>
          <p className="text-gray-600 mb-4">
            Un code de confirmation sera envoyé à ce numéro pour valider la transaction.
          </p>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Numéro de téléphone
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md">
                +237
              </span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="6XX XXX XXX"
                className="flex-1 p-2 border border-gray-300 rounded-r-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={() => setStep('select-amount')}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Retour
            </button>
            <button
              onClick={handleCollectPayment}
              disabled={loading || !phoneNumber}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Valider
            </button>
          </div>
        </div>
      )}
      
      {/* Étape de traitement */}
      {step === 'processing' && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Traitement en cours</h3>
          <p className="text-gray-600">
            Veuillez patienter pendant que nous traitons votre demande de retrait...
          </p>
        </div>
      )}
      
      {/* Étape de confirmation */}
      {step === 'completed' && (
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Retrait effectué avec succès !</h3>
          <p className="text-gray-600 mb-6">
            Votre demande de retrait a été traitée avec succès. Les fonds devraient être disponibles sur votre compte sous peu.
          </p>
          <button
            onClick={resetForm}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Effectuer un nouveau retrait
          </button>
        </div>
      )}
      
      {/* Étape d'erreur */}
      {step === 'error' && (
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Une erreur est survenue</h3>
          <p className="text-gray-600 mb-6">
            {error || 'Une erreur inattendue s\'est produite lors du traitement de votre demande.'}
          </p>
          <button
            onClick={resetForm}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
