// lib/enkap/types.ts
// Contient les types et interfaces pour l'interaction avec l'API E-nkap

/**
 * Réponse de l'API de token E-nkap
 */
export interface EnkapTokenResponse {
  access_token: string;
  scope: string;
  token_type: 'Bearer';
  expires_in: number; // Durée de validité en secondes
}

/**
 * Représente un article dans une commande E-nkap
 */
export interface EnkapOrderItem {
  itemId: string;       // ID de l'article dans votre système
  particulars: string;  // Description de l'article
  quantity: number;
  unitCost: number;     // Coût unitaire
  subTotal: number;     // quantity * unitCost
}

/**
 * Requête pour placer une commande de paiement
 */
export interface EnkapOrderRequest {
  currency: 'XAF' | 'EUR' | 'USD' | 'CAD' | 'GBP' | 'NGN';
  customerName: string;
  description?: string;
  email?: string;
  id?: {
    uuid: string;     // ID unique de la transaction de votre côté
    version?: string;
  };
  items?: EnkapOrderItem[];
  langKey?: 'en' | 'fr';
  merchantReference?: string; // Autre référence unique de votre côté
  phoneNumber?: string;
  totalAmount: number;
  returnUrl?: string;       // URL de redirection après paiement
  receiptUrl?: string;      // URL de reçu (alias de returnUrl pour compatibilité)
  notificationUrl?: string; // URL de callback pour les notifications de statut
  expiryDate?: string;      // Format ISO 8601 (e.g., "2025-12-31T23:59:59Z")
  orderDate?: string;       // Format ISO 8601
  optRefOne?: string;       // Référence optionnelle 1
  optRefTwo?: string;       // Référence optionnelle 2
  [key: string]: any;       // Pour les champs supplémentaires non typés
}

/**
 * Réponse de l'API après la création d'une commande
 */
export interface EnkapOrderResponse {
  orderTransactionId: string;  // ID de transaction E-nkap
  merchantReferenceId: string; // Votre référence de commande
  redirectUrl: string;         // URL de redirection pour le paiement
  [key: string]: any;          // Pour les champs supplémentaires non typés
}

/**
 * Statut possible d'un paiement E-nkap
 */
export type EnkapStatus = 
  | 'CREATED'      // La commande a été créée
  | 'PENDING'      // En attente de paiement
  | 'INITIALISED'  // L'utilisateur a été redirigé vers la page de paiement
  | 'IN_PROGRESS'  // Le paiement a été soumis mais pas encore confirmé
  | 'CONFIRMED'    // Le paiement a réussi
  | 'PAID'         // Paiement effectué avec succès
  | 'CANCELLED'    // Commande annulée
  | 'CANCELED'     // Alias pour CANCELLED (compatibilité)
  | 'EXPIRED'      // Commande expirée
  | 'FAILED';      // Échec du paiement

/**
 * Réponse de vérification de statut de paiement
 */
export interface EnkapStatusResponse {
  status: EnkapStatus;
  transactionId?: string;
  amount?: number;
  currency?: string;
  merchantReference?: string;
  paymentDate?: string;
  paymentProviderName?: string;
  payerAccountName?: string;
  payerAccountNumber?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  [key: string]: any; // Pour les champs supplémentaires non typés
}

/**
 * Réponse détaillée de l'API de vérification
 */
export interface EnkapDetailsResponse {
  id: { 
    uuid: string;
    version?: string;
  };
  paymentStatus: EnkapStatus;
  order: EnkapOrderRequest; // L'objet de la commande originale
  paymentDate?: string;
  paymentProviderName?: string;
  payerAccountName?: string;
  payerAccountNumber?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  [key: string]: any; // Pour les champs supplémentaires non typés
}
