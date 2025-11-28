// lib/enkap/paymentService.ts
// Service pour gérer les paiements via l'API E-nkap

import axios, { AxiosError, AxiosResponse } from 'axios';
import { ENKAP_CONFIG } from './config';
import { 
  EnkapTokenResponse, 
  EnkapOrderRequest, 
  EnkapOrderResponse, 
  EnkapStatusResponse, 
  EnkapDetailsResponse,
  EnkapStatus
} from './types';

// Extension de l'interface Axios pour gérer les réponses d'erreur personnalisées
declare module 'axios' {
  export interface AxiosRequestConfig {
    _retry?: boolean;
  }
}

// Cache en mémoire pour le token d'accès
let tokenCache = {
  accessToken: '',
  expiresAt: 0,
};

/**
 * Gère l'authentification et l'obtention d'un token d'accès E-nkap.
 * Le token est mis en cache pour éviter des demandes répétées.
 */
const getAccessToken = async (): Promise<string> => {
  const now = Date.now();

  // Si le token est encore valide, le retourner depuis le cache
  if (tokenCache.accessToken && tokenCache.expiresAt > now) {
    return tokenCache.accessToken;
  }

  try {
    const credentials = Buffer.from(
      `${ENKAP_CONFIG.CONSUMER_KEY}:${ENKAP_CONFIG.CONSUMER_SECRET}`
    ).toString('base64');

    const response = await axios.post<EnkapTokenResponse>(
      ENKAP_CONFIG.TOKEN_URL,
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        timeout: ENKAP_CONFIG.REQUEST_TIMEOUT,
      }
    );

    const { access_token, expires_in } = response.data;

    // Mettre à jour le cache
    tokenCache = {
      accessToken: access_token,
      expiresAt: now + (expires_in - 300) * 1000, // Marge de sécurité de 5 minutes
    };

    return access_token;
  } catch (error) {
    console.error("Erreur lors de l'obtention du token E-nkap:", error);
    throw new Error('Impossible de s\'authentifier auprès du service de paiement.');
  }
};

/**
 * Classe principale du service de paiement E-nkap
 */
export class EnkapPaymentService {
  /**
   * Initialise une transaction de paiement et retourne l'URL de redirection.
   */
  async initiatePayment(order: EnkapOrderRequest): Promise<EnkapOrderResponse> {
    try {
      // Créer une référence de commande unique si non fournie
      const merchantReference = order.merchantReference || `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Extraire et valider les champs de la commande
      const { 
        customerName, 
        description = 'Paiement de votre abonnement',
        email, 
        items = [], 
        phoneNumber, 
        totalAmount,
        returnUrl = ENKAP_CONFIG.RETURN_URL,
        notificationUrl = ENKAP_CONFIG.NOTIFICATION_URL,
        orderDate = new Date().toISOString(),
        expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Expire dans 7 jours par défaut
        langKey = 'fr',
        currency = 'XAF',
        ...restParams
      } = order;

      // Validation des champs obligatoires
      if (!customerName || !totalAmount) {
        throw new Error('customerName et totalAmount sont des champs obligatoires');
      }

      if (totalAmount <= 0) {
        throw new Error('Le montant total doit être supérieur à zéro');
      }

      // Formater le numéro de téléphone selon le format attendu par E-nkap
      const formatPhoneNumber = (phone: string | undefined): string | undefined => {
        if (!phone) return undefined;
        
        // Supprimer tous les caractères non numériques
        const digits = phone.replace(/\D/g, '');
        
        // Si le numéro commence par l'indicatif +237 ou 237, le garder tel quel
        if (digits.startsWith('237')) {
          return digits;
        }
        
        // Si le numéro commence par 0, le remplacer par 237
        if (digits.startsWith('0')) {
          return `237${digits.substring(1)}`;
        }
        
        // Si le numéro a 9 chiffres, ajouter 237 devant
        if (digits.length === 9) {
          return `237${digits}`;
        }
        
        // Pour les autres cas, retourner le numéro tel quel
        return digits;
      };
      
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Construire la requête selon la documentation E-nkap
      const orderRequest: any = {
        currency,
        totalAmount,
        merchantReference,
        customerName: customerName.substring(0, 50), // Limité à 50 caractères
        id: { 
          uuid: merchantReference,
          version: '1.0' 
        },
        langKey,
        orderDate,
        expiryDate,
        items: []
      };

      // Ajouter les champs optionnels s'ils sont définis
      if (description) orderRequest.description = description.substring(0, 255);
      if (email) orderRequest.email = email;
      if (formattedPhone) orderRequest.phoneNumber = formattedPhone;
      if (returnUrl) orderRequest.returnUrl = returnUrl;
      if (notificationUrl) orderRequest.notificationUrl = notificationUrl;
      if (orderDate) orderRequest.orderDate = orderDate;
      if (expiryDate) orderRequest.expiryDate = expiryDate;
      if (langKey) orderRequest.langKey = langKey;

      // Ajouter les articles s'ils sont définis
      if (items && items.length > 0) {
        orderRequest.items = items.map(item => ({
          itemId: item.itemId,
          particulars: item.particulars.substring(0, 100),
          quantity: item.quantity,
          unitCost: item.unitCost,
          subTotal: item.subTotal,
        }));
      }

      // Ajouter les paramètres supplémentaires s'ils existent
      Object.assign(orderRequest, restParams);

      // Journaliser la requête (sans données sensibles)
      const loggableRequest = { ...orderRequest };
      if (loggableRequest.phoneNumber) {
        loggableRequest.phoneNumber = '***' + loggableRequest.phoneNumber.slice(-3);
      }
      if (loggableRequest.email) {
        const [user, domain] = loggableRequest.email.split('@');
        loggableRequest.email = `${user[0]}***@${domain}`;
      }

      // Obtenir le token d'accès
      const accessToken = await getAccessToken();
      
      // Préparer les en-têtes
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      };

      // URL de l'API E-nkap
      const url = `${ENKAP_CONFIG.API_BASE_URL}${ENKAP_CONFIG.ENDPOINTS.ORDER}`;

      // Journalisation pour le débogage (sans le token complet)
      console.log('Envoi de la requête à E-nkap:', {
        url,
        headers: {
          ...headers,
          'Authorization': `Bearer ${accessToken.substring(0, 10)}...`
        },
        data: loggableRequest
      });

      try {
        // Envoyer la requête à l'API E-nkap
        const response = await axios.post<EnkapOrderResponse>(
          url,
          orderRequest,
          {
            headers,
            timeout: ENKAP_CONFIG.REQUEST_TIMEOUT,
            validateStatus: () => true // Pour gérer manuellement les codes d'erreur
          }
        );

        // Journaliser la réponse
        console.log('Réponse reçue de E-nkap:', {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        });

        // Vérifier les erreurs de l'API
        if (response.status >= 400) {
          let errorMessage = `Erreur ${response.status} lors de la création de la commande`;
          
          try {
            // Essayer d'extraire le message d'erreur de la réponse
            if (response.data) {
              const responseData = typeof response.data === 'string' 
                ? JSON.parse(response.data) 
                : response.data;
              
              errorMessage = (responseData as any)?.message || 
                            (responseData as any)?.error || 
                            errorMessage;
            }
          } catch (e) {
            console.error('Erreur lors de l\'analyse de la réponse d\'erreur:', e);
          }
          
          throw new Error(errorMessage);
        }

        // Vérifier que la réponse contient bien les données attendues
        if (!response.data || !response.data.redirectUrl) {
          throw new Error('Réponse invalide de l\'API E-nkap: URL de redirection manquante');
        }

        return response.data;

      } catch (error) {
        console.error('Erreur lors de la communication avec E-nkap:', error);
        
        // Améliorer le message d'erreur en fonction du type d'erreur
        if (axios.isAxiosError(error)) {
          if (error.response) {
            // Erreur avec réponse du serveur
            const errorData = error.response.data || {};
            throw new Error(
              `Erreur ${error.response.status} de l'API E-nkap: ${errorData.message || 'Erreur inconnue'}`
            );
          } else if (error.request) {
            // Pas de réponse du serveur
            throw new Error('Impossible de se connecter au service de paiement. Veuillez vérifier votre connexion internet.');
          }
        }
        
        // Pour les autres types d'erreurs
        throw new Error(
          error instanceof Error 
            ? error.message 
            : 'Une erreur inattendue est survenue lors du traitement de votre paiement'
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'initiation du paiement E-nkap:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const errorData = error.response.data || {};
          throw new Error(
            `Erreur ${error.response.status} de l'API E-nkap: ${errorData.message || 'Erreur inconnue'}`
          );
        } else if (error.request) {
          throw new Error('Impossible de se connecter au service de paiement. Veuillez vérifier votre connexion internet.');
        }
      }
      
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Une erreur inattendue est survenue lors du traitement de votre paiement'
      );
    }
  }

  /**
   * Vérifie le statut d'une transaction E-nkap.
   * @param transactionId - L'ID de transaction E-nkap ou la référence marchande
   * @param isMerchantReference - Si true, utilise l'endpoint avec orderMerchantId au lieu de txid
   */
  async verifyPayment(
    transactionId: string, 
    isMerchantReference: boolean = false
  ): Promise<EnkapStatusResponse> {
    try {
      const accessToken = await getAccessToken();
      let url: string;
      
      if (isMerchantReference) {
        url = `${ENKAP_CONFIG.API_BASE_URL}${ENKAP_CONFIG.ENDPOINTS.ORDER_STATUS}`;
      } else {
        url = `${ENKAP_CONFIG.API_BASE_URL}${ENKAP_CONFIG.ENDPOINTS.ORDER_STATUS}/${transactionId}`;
      }
      
      const config = {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        timeout: ENKAP_CONFIG.REQUEST_TIMEOUT,
        params: isMerchantReference ? { orderMerchantId: transactionId } : {},
        validateStatus: () => true // Pour gérer manuellement les codes d'erreur
      };

      console.log('🔍 Vérification E-nkap:', {
        url,
        transactionId,
        isMerchantReference
      });

      const response = await axios.get<EnkapStatusResponse>(url, config);

      // 🔥 GESTION DÉTAILLÉE DES STATUS HTTP
      switch (response.status) {
        case 200:
          // Succès - traiter la réponse normale
          console.log('✅ Réponse E-nkap 200:', response.data);
          return this.handleSuccessResponse(response.data, transactionId);
          
        case 201:
          // Transaction créée mais en attente
          console.log('⏳ Réponse E-nkap 201 - Transaction créée');
          return this.createPendingResponse(transactionId, 'Transaction créée - en attente');
          
        case 400:
          console.log('❌ Erreur E-nkap 400 - Requête invalide');
          throw new Error('Paramètres de requête invalides');
          
        case 401:
          console.log('❌ Erreur E-nkap 401 - Non autorisé');
          throw new Error('Non autorisé - token d\'accès invalide ou expiré');
          
        case 403:
          console.log('❌ Erreur E-nkap 403 - Accès refusé');
          throw new Error('Accès refusé - permissions insuffisantes');
          
        case 404:
          // Transaction non trouvée - peut être normale si trop récente
          console.log('🔍 Réponse E-nkap 404 - Transaction non trouvée');
          return this.createPendingResponse(
            transactionId, 
            'Transaction non trouvée - en cours d\'initialisation',
            404
          );
          
        case 500:
          console.log('❌ Erreur E-nkap 500 - Erreur interne');
          throw new Error('Erreur interne du service E-nkap');
          
        default:
          console.log(`⚠️  Status HTTP non géré: ${response.status}`);
          if (response.status >= 400) {
            throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
          }
          return this.handleSuccessResponse(response.data, transactionId);
      }

    } catch (error) {
      console.error('❌ Erreur lors de la vérification E-nkap:', error);
      return this.handleErrorResponse(error, transactionId);
    }
  }

  /**
   * Traite une réponse réussie (status 200)
   */
  private handleSuccessResponse(data: any, transactionId: string): EnkapStatusResponse {
    // Vérifier la structure de la réponse
    if (!data?.status) {
      console.warn('⚠️  Réponse E-nkap invalide, structure manquante:', data);
      return this.createErrorResponse(
        transactionId,
        'STRUCTURE_ERROR',
        'Réponse de vérification invalide'
      );
    }

    // Mapper les statuts E-nkap vers nos statuts internes
    const statusMap: Record<string, EnkapStatus> = {
      'PAID': 'CONFIRMED',
      'SUCCESS': 'CONFIRMED',
      'COMPLETED': 'CONFIRMED',
      'CANCELLED': 'CANCELED',
      'INITIALISED': 'PENDING',
      'IN_PROGRESS': 'PENDING',
      'CREATED': 'PENDING',
      'PENDING': 'PENDING',
      'FAILED': 'FAILED',
      'ERROR': 'FAILED',
      'REJECTED': 'FAILED',
      'EXPIRED': 'EXPIRED'
    };

    const normalizedStatus = statusMap[data.status.toUpperCase()] || 'PENDING';
    
    console.log('📊 Statut E-nkap normalisé:', {
      original: data.status,
      normalized: normalizedStatus,
      transactionId
    });

    // Construire la réponse standardisée
    const response: EnkapStatusResponse = {
      status: normalizedStatus,
      transactionId: data.transactionId || transactionId,
      merchantReference: data.merchantReference,
      amount: data.amount,
      currency: data.currency || 'XAF',
      paymentDate: data.paymentDate || new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    // Ajouter les informations d'erreur si présentes
    if (data.error || data.errorCode) {
      response.error = {
        code: data.errorCode || data.error,
        message: data.errorMessage || data.message || 'Erreur de traitement',
        details: data.errorDetails || data.details
      };
    }

    return response;
  }

  /**
   * Crée une réponse pour les transactions en attente
   */
  private createPendingResponse(
    transactionId: string, 
    message: string,
    httpCode?: number
  ): EnkapStatusResponse {
    return {
      status: 'PENDING',
      transactionId,
      timestamp: new Date().toISOString(),
      ...(httpCode && {
        error: {
          code: `HTTP_${httpCode}`,
          message,
          details: { httpStatusCode: httpCode }
        }
      })
    };
  }

  /**
   * Crée une réponse d'erreur structurée
   */
  private createErrorResponse(
    transactionId: string,
    errorCode: string,
    errorMessage: string,
    details?: any
  ): EnkapStatusResponse {
    return {
      status: 'FAILED',
      transactionId,
      timestamp: new Date().toISOString(),
      error: {
        code: errorCode,
        message: errorMessage,
        details
      }
    };
  }

  /**
   * Gère les erreurs de manière centralisée
   */
  private handleErrorResponse(error: any, transactionId: string): EnkapStatusResponse {
    // Erreur Axios avec réponse du serveur
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const errorData = error.response.data || {};
      
      console.error(`❌ Erreur Axios ${status}:`, errorData);
      
      return this.createErrorResponse(
        transactionId,
        `HTTP_${status}`,
        errorData.message || error.message || `Erreur ${status} du serveur`,
        errorData
      );
    }
    
    // Erreur Axios sans réponse (problème réseau)
    if (axios.isAxiosError(error) && error.request) {
      console.error('❌ Erreur réseau E-nkap:', error.message);
      
      return this.createErrorResponse(
        transactionId,
        'NETWORK_ERROR',
        'Impossible de se connecter au service de paiement',
        { originalError: error.message }
      );
    }
    
    // Erreur JavaScript standard
    console.error('❌ Erreur générale E-nkap:', error);
    
    return this.createErrorResponse(
      transactionId,
      'UNKNOWN_ERROR',
      error instanceof Error ? error.message : 'Erreur inconnue',
      error
    );
  }

  /**
   * Vérifie si une transaction existe (utilitaire)
   */
  async checkTransactionExists(
    reference: string, 
    isMerchantReference: boolean = false
  ): Promise<boolean> {
    try {
      const status = await this.verifyPayment(reference, isMerchantReference);
      return status.status !== 'FAILED' && 
             !status.error?.code?.includes('404') && 
             !status.error?.code?.includes('NETWORK');
    } catch {
      return false;
    }
  }



  /**
   * Récupère les détails complets d'une transaction
   */
  async getPaymentDetails(transactionId: string): Promise<EnkapDetailsResponse> {
    try {
      const accessToken = await getAccessToken();
      const url = `${ENKAP_CONFIG.API_BASE_URL}${ENKAP_CONFIG.ENDPOINTS.ORDER_DETAILS}/${transactionId}`;
      
      const response = await axios.get<EnkapDetailsResponse>(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        timeout: ENKAP_CONFIG.REQUEST_TIMEOUT,
        validateStatus: () => true
      });

      // Gestion des status HTTP pour les détails aussi
      if (response.status >= 400) {
        throw new Error(`Erreur ${response.status} lors de la récupération des détails`);
      }

      if (!response.data || !('id' in response.data)) {
        throw new Error('Réponse de détails de paiement invalide');
      }

      return response.data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des détails E-nkap:', error);
      throw error;
    }
  }
}

// Exporter une instance unique du service
export const enkapPaymentService = new EnkapPaymentService();
