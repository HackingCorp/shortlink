

import { unknown } from "zod";

export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export type CashoutParams = {
  step: 'getPackages' | 'createQuote' | 'collect';
  serviceId?: number | string; 
  amount?: number | string;
  currency?: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  quoteId?: string;
  serviceNumber?: string; 
  transactionId?: string; 
};

export interface S3PPaymentRequest {
  amount: number;
  currency: string;
  customerPhone: string;
  customerEmail: string;
  customerName: string;
  serviceCode: string;
  operatorId: string;
  isSimulated: boolean;
  metadata: {
    planId: string;
    durationMonths: number;
    userId: string;
    [key: string]: any;
  };
  orderId: string;
}

// Interface pour la réponse de paiement S3P
export interface S3PPaymentResponse {
  success: boolean;
  transactionId: string;
  status: TransactionStatus;
  paymentUrl?: string;
  message?: string;
  error?: string;
  details?: any; 
}


export const initiateS3PPayment = async (params: {
  amount: number;
  currency: string;
  customerPhone: string;
  customerEmail: string;
  customerName: string;
  serviceCode: string;
  operatorId: string;
  metadata: Record<string, any>;
  orderId?: string;
}) => {
  try {
    const response = await fetch('/api/v1/payment/s3p/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Échec de l\'initialisation du paiement');
    }

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du paiement:', error);
    throw error;
  }
};
export async function handleS3PCashout(params: CashoutParams) {
  try {
    const response = await fetch('/api/v1/payment/s3p/cashout', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[handleS3PCashout] Erreur API:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = errorText;
      }
      
      return { 
        success: false, 
        error: errorData?.usrMsg || errorData?.devMsg || `Erreur serveur (${response.status})` 
      };
    }

    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('[handleS3PCashout] Erreur:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la récupération des packages';      
    return { 
      success: false, 
      error: errorMessage || 'Erreur inattendue' 
    };
  }
}