// lib/s3p/mobileWalletService.ts
// Service pour gérer les paiements mobile money via S3P Cash-in

import { s3pClient } from './auth';
import { S3P_CONFIG } from './config';

// Configuration pour le mode développement
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Types pour les opérations mobile money
export interface CashinPackage {
  serviceid: number;
  merchant: 'ORANGE_MONEY' | 'MTN_MOMO' | 'EXPRESS_UNION';
  payItemId: string;
  payItemDescr: string;
  amountType: 'VARIABLE';
  localCur: 'XAF';
  name: string;
  amountLocalCur: number;
  description: string;
}

export interface QuoteRequest {
  amount: number; // Montant en FCFA (sans décimales)
  payItemId: string;
}

export interface QuoteResponse {
  quoteId: string;
  expiresAt: string;
  payItemId: string;
  amountLocalCur: number;
  priceLocalCur: number;
  priceSystemCur: number;
  localCur: 'XAF';
  systemCur: 'XAF';
  promotion?: string | null;
}

export interface CollectRequest {
  quoteId: string;
  customerPhonenumber: string; // Format international (237699123456)
  customerEmailaddress: string;
  customerName: string;
  serviceNumber: string; // ID utilisateur ou numéro de service
  trid?: string; // Transaction ID personnalisé
  tag?: string; // Tag pour identification
}

export interface CollectResponse {
  ptn: string; // Payment Transaction Number
  timestamp: string;
  agentBalance: number;
  receiptNumber: string;
  veriCode: string;
  priceLocalCur: number;
  priceSystemCur: number;
  localCur: 'XAF';
  systemCur: 'XAF';
  trid: string;
  pin: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  payItemId: string;
  payItemDescr: string;
  tag?: string;
}

export interface DebugInfo {
  isFallback: boolean;
  createdAt: string;
  lastAttempt: string;
  error: string | null;
  [key: string]: any; // Pour permettre d'ajouter d'autres champs de débogage
}

export interface TransactionVerification {
  ptn: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED';
  amount: number;
  currency: 'XAF';
  timestamp: string;
  customerInfo?: {
    name: string;
    phone: string;
    email: string;
  };
  name?: string;
  phone?: string;
  email?: string;
  _debug?: DebugInfo; // Ajout du champ de débogage optionnel
}

// Classe principale du service Mobile Wallet
export class S3PMobileWalletService {
  
  /**
   * Étape 1: Récupérer les packages cash-in disponibles
   */
  
  async getCashinPackages(serviceid?: number): Promise<CashinPackage[]> {
    try {
      const queryParams = serviceid ? { serviceid } : {};
      const packages = await s3pClient.get(S3P_CONFIG.ENDPOINTS.CASHIN, queryParams);
      
      console.log('Packages cash-in récupérés:', packages.length);
      return packages;
    } catch (error) {
      console.error('Erreur lors de la récupération des packages cash-in:', error);
      throw new Error(`Impossible de récupérer les packages de paiement: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  /**
   * Étape 2: Demander un devis pour le cash-in
   */
  async requestQuote(request: QuoteRequest): Promise<QuoteResponse> {
    try {
      // Validation des données
      if (!request.amount || request.amount <= 0) {
        throw new Error('Le montant doit être supérieur à 0');
      }
      
      if (!request.payItemId) {
        throw new Error('L\'identifiant du package de paiement est requis');
      }
      
      const quote = await s3pClient.post(S3P_CONFIG.ENDPOINTS.QUOTE, {
        amount: request.amount,
        payItemId: request.payItemId
      });
      
      console.log('Devis obtenu:', {
        quoteId: quote.quoteId,
        amount: quote.amountLocalCur,
        price: quote.priceLocalCur,
        expiresAt: quote.expiresAt
      });
      
      return quote;
    } catch (error) {
      console.error('Erreur lors de la demande de devis:', error);
      throw new Error(`Impossible d'obtenir le devis: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  /**
   * Étape 3: Exécuter le cash-in (débiter le compte client)
   */
  async executeCollection(request: CollectRequest): Promise<CollectResponse> {
    try {
      // Validation des données client
      this.validateCollectionRequest(request);
      
      const collectData = {
        quoteId: request.quoteId,
        customerPhonenumber: this.formatPhoneNumber(request.customerPhonenumber),
        customerEmailaddress: request.customerEmailaddress,
        customerName: request.customerName,
        serviceNumber: request.serviceNumber,
        trid: request.trid || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tag: request.tag || 'subscription_payment'
      };
      
      console.log('Exécution du cash-in:', {
        quoteId: collectData.quoteId,
        customer: collectData.customerName,
        phone: collectData.customerPhonenumber,
        trid: collectData.trid
      });
      
      const result = await s3pClient.post(S3P_CONFIG.ENDPOINTS.COLLECT, collectData);
      
      console.log('Cash-in exécuté:', {
        status: result.status,
        ptn: result.ptn,
        amount: result.priceLocalCur
      });
      
      return result;
    } catch (error) {
      console.error('Erreur lors de l\'exécution du cash-in:', error);
      throw new Error(`Échec du paiement mobile money: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  /**
   * Étape 4: Vérifier le statut d'une transaction
   */
  /**
   * Crée une réponse de transaction en attente avec des informations de débogage
   * @param ptn Identifiant de la transaction
   * @param errorMessage Message d'erreur optionnel
   * @returns Un objet TransactionVerification avec le statut PENDING
   */
  private createPendingResponse(ptn: string, errorMessage: string = ''): TransactionVerification {
    const timestamp = new Date().toISOString();
    const defaultCustomerInfo = {
      name: 'Client inconnu',
      phone: 'Non disponible',
      email: 'non.disponible@example.com'
    };

    // Créer un message d'erreur détaillé
    const errorInfo = errorMessage 
      ? ` [Erreur: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}]` 
      : '';

    console.warn(`[S3P] Création d'une réponse PENDING pour PTN: ${ptn}${errorInfo}`, {
      timestamp,
      errorDetails: errorMessage || 'Aucun détail d\'erreur fourni'
    });

    return {
      ptn,
      status: 'PENDING',
      amount: 0,
      currency: 'XAF',
      timestamp,
      customerInfo: defaultCustomerInfo,
      // Champs requis par l'interface
      ...defaultCustomerInfo,
      // Ajout d'informations supplémentaires pour le débogage
      _debug: {
        isFallback: true,
        createdAt: timestamp,
        lastAttempt: new Date().toISOString(),
        error: errorMessage || null
      }
    };
  }

  /**
   * Valide une requête de collecte (version simplifiée)
   */
  private validateCollectionRequest(request: CollectRequest): void {
    // Validation minimale requise
    if (!request.quoteId) {
      throw new Error('ID de devis requis');
    }
    if (!request.customerPhonenumber) {
      throw new Error('Numéro de téléphone requis');
    }
  }

  /**
   * Formate un numéro de téléphone au format international
   */
  private formatPhoneNumber(phone: string): string {
    // Nettoyer le numéro
    let cleanPhone = phone.replace(/[^\d]/g, '');
    
    // Ajouter l'indicatif pays si nécessaire
    if (cleanPhone.startsWith('6') || cleanPhone.startsWith('7')) {
      cleanPhone = '237' + cleanPhone;
    }
    
    // Valider le format camerounais
    if (!cleanPhone.match(/^237[67]\d{8}$/)) {
      throw new Error('Format de numéro invalide. Utilisez le format 237699123456');
    }
    
    return cleanPhone;
  }

  /**
   * Sélectionne l'ID de paiement en fonction de l'opérateur
   */
  private selectPayItemId(packages: CashinPackage[], operatorId: 'orange' | 'mtn' | 'eu'): string {
    // Mappage des opérateurs avec leurs différentes variantes possibles
    const OPERATOR_MAPPING = {
      orange: ['ORANGE', 'ORANGE_CM', 'ORANGE_MONEY', 'ORANGE_MOBILE_MONEY'],
      mtn: ['MTN', 'MTN_CM', 'MTN_MOMO', 'MTN_MOBILE_MONEY'],
      eu: ['EXPRESS_UNION', 'EU', 'NEXTTEL', 'EXPRESS_UNION_MOBILE']
    };

    // Récupérer les identifiants possibles pour cet opérateur
    const possibleIds = OPERATOR_MAPPING[operatorId] || [operatorId];
    
    console.log(`Recherche package pour opérateur: ${operatorId}`);
    console.log(`Identifiants à tester:`, possibleIds);

    // Chercher un package qui correspond à un des identifiants
    const foundPackage = packages.find(pkg => {
      const pkgMerchant = (pkg.merchant || '').toUpperCase();
      const pkgName = (pkg.payItemDescr || '').toUpperCase();
      
      return possibleIds.some(id => 
        pkgMerchant.includes(id.toUpperCase()) || 
        pkgName.includes(id.toUpperCase())
      );
    });

    // Log pour le débogage
    if (!foundPackage) {
      console.log(`Aucun package trouvé pour: ${operatorId}`);
      console.log(`Opérateurs disponibles dans les packages:`, 
        packages.map(p => ({
          merchant: p.merchant,
          name: p.payItemDescr,
          id: p.payItemId
        }))
      );
      throw new Error(`Aucun package de paiement trouvé pour l'opérateur ${operatorId}. Opérateurs disponibles: ${Array.from(new Set(packages.map(p => p.merchant))).join(', ')}`);
    }

    console.log(`Package trouvé:`, {
      id: foundPackage.payItemId,
      merchant: foundPackage.merchant,
      name: foundPackage.payItemDescr
    });

    return foundPackage.payItemId;
  }

  /**
   * Vérifie le statut d'une transaction S3P (version simplifiée)
   * La vérification complète se fera via le webhook
   */
  async verifyTransaction(ptn: string): Promise<TransactionVerification> {
    try {
      console.log(`Vérification du statut de la transaction ${ptn}`);
      
      const response = await s3pClient.get(S3P_CONFIG.ENDPOINTS.VERIFY, { ptn });
      
      // Retourne simplement le statut actuel sans réessai
      return {
        ptn,
        status: response?.status || 'PENDING',
        amount: response?.priceLocalCur || 0,
        currency: response?.localCur || 'XAF',
        timestamp: response?.timestamp || new Date().toISOString(),
        customerInfo: {
          name: response?.customerName || 'Client',
          phone: response?.customerPhonenumber || '',
          email: response?.customerEmailaddress || ''
        }
      };
      
    } catch (error) {
      console.error(`Erreur lors de la vérification de la transaction ${ptn}:`, error);
      
      // En cas d'erreur, on retourne un statut PENDING
      return this.createPendingResponse(
        ptn,
        error instanceof Error ? error.message : 'Erreur lors de la vérification'
      );
    }
  }

  /**
   * Traite un paiement d'abonnement
   * Version simplifiée avec validation minimale
   */
  async processSubscriptionPayment(params: {
    amount: number;
    operatorId: 'orange' | 'mtn' | 'eu';
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    userId: string;
    planId: string;
    subscriptionInfo?: string;
  }): Promise<{
    success: boolean;
    ptn?: string;
    status?: string;
    message: string;
    transactionDetails?: CollectResponse;
  }> {
    try {
      console.log('Début du processus de paiement:', {
        amount: params.amount,
        operator: params.operatorId,
        customer: params.customerName
      });

      // 1. Récupérer les packages disponibles (sans filtrage)
      const packages = await this.getCashinPackages();
      
      // 2. Sélectionner le bon package selon l'opérateur
      const payItemId = this.selectPayItemId(packages, params.operatorId);
      
      // 3. Demander un devis
      const quote = await this.requestQuote({
        amount: params.amount,
        payItemId
      });
      
      // 4. Formater le numéro de téléphone (formatage simplifié)
      const formattedPhone = params.customerPhone.replace(/\D/g, '');
      
      // 5. Exécuter la collecte avec validation minimale
      const collection = await this.executeCollection({
        quoteId: quote.quoteId,
        customerPhonenumber: formattedPhone,
        customerEmailaddress: params.customerEmail || `user-${params.userId}@example.com`,
        customerName: params.customerName || 'Client',
        serviceNumber: params.userId,
        trid: `sub_${params.userId}_${Date.now()}`,
        tag: `subscription_${params.planId}`
      });

      // 6. Retourner immédiatement avec statut PENDING
      // La confirmation finale sera gérée par le webhook
      return {
        success: true,
        ptn: collection.ptn,
        status: 'PENDING',
        message: 'Paiement en attente de confirmation',
        transactionDetails: collection
      };
      
    } catch (error) {
      console.error('Erreur lors du traitement du paiement:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur inconnue lors du paiement'
      };
    }
  }

  // === MÉTHODES UTILITAIRES ===

  /**
   * Vérifie si une adresse email est valide
   */
  private isValidEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Instance globale du service
export const s3pMobileWallet = new S3PMobileWalletService();