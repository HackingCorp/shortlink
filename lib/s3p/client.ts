import { s3pClient } from '@/lib/s3p/auth';

export interface S3PResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: any;
}

export interface S3PError {
  status: number;
  message: string;
  code?: string;
  details?: any;
}

function handleApiError(error: any): S3PError {
  if (error.response) {
    const { status, data } = error.response;
    return {
      status,
      message: data?.message || 'Erreur inconnue du serveur',
      code: data?.code,
      details: data,
    };
  } else if (error.request) {
    return {
      status: 503,
      message: 'Impossible de se connecter au service de paiement',
      code: 'SERVICE_UNAVAILABLE',
    };
  } else {
    return {
      status: 400,
      message: error.message || 'Erreur de configuration de la requête',
      code: 'REQUEST_ERROR',
    };
  }
}

export const s3pService = {
  async getCashoutPackages(serviceId?: number) {
    try {
      console.log(`[S3P Service] Récupération des packages pour serviceId: ${serviceId}`);
      
      const response = await s3pClient.cashoutGet(serviceId);
      console.log('[S3P Service] Réponse reçue:', response);
      
      const packages = Array.isArray(response) ? response : [];
      
      return {
        success: true,
        data: {
          packages: packages,
          total: packages.length
        }
      };
    } catch (error) {
      console.error('[S3P Service] Erreur lors de la récupération des packages:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la récupération des packages';
      const errorCode = error && typeof error === 'object' && 'code' in error ? 
        (error as { code?: string }).code : 'UNKNOWN_ERROR';
      
      return {
        success: false,
        error: {
          message: errorMessage,
          code: errorCode,
          details: error
        }
      };
    }
  },
 
  async createQuote(params: {
    serviceId: string;
    amount: number;
    currency: string;
    customerId: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const response = await s3pClient.quotesStdPost({
        payItemId: params.serviceId,
        amount: params.amount.toString(),
        currency: params.currency,
        payItemDescr: `Retrait de ${params.amount} ${params.currency}`,
        customerName: params.customerName,
        customerEmail: params.customerEmail || '',
        customerPhone: params.customerPhone || '',
        metadata: JSON.stringify(params.metadata || {}),
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return {
        success: false,
        error: handleApiError(error),
      };
    }
  },

  

 
  
async collectPayment(params: {
  quoteId: string;
  phoneNumber: string;
  customerName: string;
  customerEmail: string;
  customerId: string;
  transactionId: string;
  metadata?: any;
}): Promise<S3PResponse> {
  try {
    // STRUCTURE EXACTE selon la documentation CollectionRequest
    const requestData = {
      
      quoteId: params.quoteId, 
      customerPhonenumber: params.phoneNumber, 
      customerEmailaddress: params.customerEmail, 
      
      
      customerName: params.customerName, 
      customerNumber: params.customerId, 
      serviceNumber: params.phoneNumber, 
      trid: params.transactionId, 
      tag: 'subscription_payment', 
      callbackUrl: `${process.env.NEXTAUTH_URL}/api/v1/payment/s3p/webhook`, 
      cdata: JSON.stringify({ 
        service: 'cashout',
        plan: 'Pro',
        customer_id: params.customerId,
        metadata: params.metadata || {}
      })
    };

    console.log('[S3P Collect] Données selon documentation:', JSON.stringify(requestData, null, 2));
    
    const result = await s3pClient.collectstdPost('3.0.0', requestData);
    
    return { 
      success: true, 
      data: result 
    };
  } catch (error) {
    console.error('[S3P Collect] Erreur détaillée:', error);
    return { 
      success: false, 
      error: handleApiError(error)
    };
  }
},
 

  async verifyTransaction(transactionId: string) {
    try {
      const response = await s3pClient.verifytxGet('3.0.0', transactionId);
      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return {
        success: false,
        error: handleApiError(error),
      };
    }
  }
};