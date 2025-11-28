// hooks/usePayment.ts - Version corrigée
import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export interface PaymentData {
  type: 'subscription' | 'renewal';
  planId: string;
  durationMonths: number;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  paymentMethod: string;
  operatorId?: string;
  returnUrl: string;
  cancelUrl: string;
  notificationUrl: string;
}

export interface PaymentResult {
  success: boolean;
  data?: {
    ptn?: string;
    transactionId?: string;
    paymentUrl?: string;
    status?: string;
    paymentReference?: string;
  };
  error?: string;
}

const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 9 && cleaned.length <= 12;
};

export const usePayment = () => {
  const { data: session, update } = useSession();
  const router = useRouter();

  const savePaymentData = useCallback((data: any) => {
    localStorage.setItem('lastPayment', JSON.stringify(data));
    console.log('💾 Données de paiement sauvegardées');
  }, []);

  const handleSuccessfulPayment = useCallback(async (paymentData: PaymentData, resultData: any) => {
    try {
      console.log('✅ Paiement réussi, mise à jour du compte...');

      const updateResponse = await fetch('/api/v1/user/update-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.accessToken && { 'Authorization': `Bearer ${session.accessToken}` })
        },
        body: JSON.stringify({
          plan: paymentData.planId.toUpperCase(),
          status: 'active',
          upgradedAt: new Date().toISOString(),
          transactionId: resultData.ptn || resultData.transactionId,
          type: paymentData.type,
          durationMonths: paymentData.durationMonths
        }),
      });

      if (updateResponse.ok) {
        await update();
        const confirmationUrl = paymentData.type === 'renewal' 
          ? `/dashboard/renew/confirmation?status=success&transactionId=${resultData.ptn || resultData.transactionId}`
          : `/dashboard/upgrade/confirmation?status=success&transactionId=${resultData.ptn || resultData.transactionId}`;
        
        router.push(confirmationUrl);
      } else {
        throw new Error('Erreur lors de la mise à jour du compte');
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour compte:', error);
      throw error;
    }
  }, [session, update, router]);

  // Fonction utilitaire pour parser les réponses JSON avec gestion d'erreur
  const parseJSONResponse = async (response: Response) => {
    const text = await response.text();
    
    // Vérifier si la réponse est vide
    if (!text) {
      throw new Error(`Réponse vide du serveur. Statut: ${response.status}`);
    }
  
    // Vérifier si la réponse est du HTML (erreur)
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      if (response.status === 404) {
        throw new Error('Le service de paiement est temporairement indisponible. Veuillez réessayer plus tard.');
      }
      throw new Error(`Erreur serveur (${response.status}). Veuillez réessayer.`);
    }
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error('❌ Erreur de parsing JSON:', parseError, 'Réponse:', text.substring(0, 200));
      throw new Error('Réponse serveur invalide. Veuillez réessayer.');
    }
  };

  const handlePayment = useCallback(async (
    paymentData: PaymentData,
    method: any,
    onSuccess?: (result: any) => void,
    onError?: (error: string) => void
  ) => {
    try {
      // Validation
      if ((method.type === 'mobile' || method.gateway === 's3p') && 
          (!paymentData.customerPhone || !validatePhoneNumber(paymentData.customerPhone))) {
        throw new Error('Numéro de téléphone invalide');
      }

      const basePayload = {
        ...paymentData,
        currency: 'XAF',
        isSimulated: false
      };

      let apiUrl: string;
      let payload: any;

      if (method.gateway === 's3p') {
        apiUrl = '/api/v1/payment/initiate';
        payload = {
          ...basePayload,
          operatorId: method.id === 'mtn-mobile-money' ? 'mtn' : 
                     method.id === 'orange-money' ? 'orange' : 'eu',
          gateway: 's3p'
        };
      } else if (method.gateway === 'enkap') {
        apiUrl = '/api/v1/payment/enkap/initiate';
        payload = {
          ...basePayload,
          gateway: 'enkap'
        };
      } else {
        throw new Error('Passerelle de paiement non supportée');
      }

      console.log('🔄 Données de paiement:', { ...payload, customerPhone: '***' });
      console.log('🔄 Tentative de paiement vers:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.accessToken && { 'Authorization': `Bearer ${session.accessToken}` })
        },
        body: JSON.stringify(payload),
      });

      // Utiliser le nouveau parser avec gestion d'erreur
      const responseData = await parseJSONResponse(response);

      console.log('📋 Réponse du serveur:', responseData);

      if (!response.ok || !responseData.success) {
        const errorMessage = responseData.error || 
                            responseData.message || 
                            `Erreur HTTP ${response.status}`;
        throw new Error(errorMessage);
      }
      if (!responseData.success) {
        throw new Error(responseData.error || 'Échec du traitement du paiement');
      }  

      // Sauvegarde des données
      savePaymentData({
        transactionId: responseData.data?.ptn || responseData.data?.transactionId || responseData.data?.paymentReference,
        paymentMethod: method.id,
        amount: paymentData.amount,
        currency: 'XAF',
        planName: paymentData.planId,
        duration: `${paymentData.durationMonths} mois`,
        durationMonths: paymentData.durationMonths,
        customerEmail: paymentData.customerEmail,
        customerName: paymentData.customerName,
        provider: method.gateway,
        timestamp: new Date().toISOString(),
        type: paymentData.type
      });

      const resultData = responseData.data || responseData;

      // Paiement immédiatement réussi
      if (resultData.status === 'succeeded' || resultData.status === 'success') {
        await handleSuccessfulPayment(paymentData, resultData);
        onSuccess?.(resultData);
        return { success: true, data: resultData };
      }

      // Redirection
      if (resultData.paymentUrl || resultData.callbackUrl) {
        window.location.href = resultData.paymentUrl || resultData.callbackUrl;
        return { success: true, data: resultData };
      }

      // Paiement en attente
      if (resultData.status === 'pending' || resultData.status === 'PENDING') {
        if (resultData.ptn || resultData.transactionId || resultData.paymentReference) {
          return { success: true, data: resultData };
        }
      }

      throw new Error('Réponse inattendue du serveur de paiement');

    } catch (error) {
        console.error('❌ Erreur lors du traitement du paiement:', error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Une erreur inconnue est survenue';
        onError?.(errorMessage);
        return { success: false, error: errorMessage };
      }
    }, [session, savePaymentData, handleSuccessfulPayment]);

  return {
    handlePayment,
    savePaymentData
  };

  
};