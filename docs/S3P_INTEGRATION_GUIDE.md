# Guide d'Intégration Complète - API S3P SmobilPay

## Table des Matières
1. [Introduction](#1-introduction)
2. [Configuration Initiale](#2-configuration-initiale)
3. [Endpoints et Flux](#3-endpoints-et-flux)
   - [3.1. Récupération des Packages](#31-récupération-des-packages)
   - [3.2. Demande de Devis](#32-demande-de-devis)
   - [3.3. Exécution du Paiement](#33-exécution-du-paiement)
   - [3.4. Vérification de Transaction](#34-vérification-de-transaction)
   - [3.5. Webhooks de Notification](#35-webhooks-de-notification)
4. [Flux Complet de Paiement](#4-flux-complet-de-paiement)
5. [Gestion des Erreurs](#5-gestion-des-erreurs)
6. [Bonnes Pratiques](#6-bonnes-pratiques)
7. [Exemple d'Implémentation](#7-exemple-dimplémentation)

## 1. Introduction

Ce document fournit une documentation complète pour l'intégration de l'API S3P SmobilPay pour les paiements mobiles money en Afrique. Il couvre tous les endpoints, les flux de données et les bonnes pratiques pour une intégration réussie.

## 2. Configuration Initiale

Avant de commencer, assurez-vous d'avoir :
- Un compte marchand S3P SmobilPay
- Les identifiants d'API (Access Token et Access Secret)
- Un environnement Node.js configuré

## 3. Endpoints et Flux

### 3.1 Récupération des Packages

**Endpoint:** `GET /cashin`

**Objectif:** Récupérer la liste des opérateurs mobiles et services de paiement disponibles.

**Requête:**
```http
GET /cashin HTTP/1.1
Host: api.smobilpay.com
Authorization: OAuth oauth_consumer_key="YOUR_ACCESS_TOKEN", ...
```

**Réponse (Exemple):**
```json
[
  {
    "serviceid": 1,
    "merchant": "MTN_MOMO",
    "payItemId": "MTN-MOMO-001",
    "payItemDescr": "Paiement Mobile Money MTN",
    "amountType": "VARIABLE",
    "localCur": "XAF",
    "name": "MTN Mobile Money",
    "amountLocalCur": 0,
    "description": "Service de paiement MTN Mobile Money"
  },
  {
    "serviceid": 2,
    "merchant": "ORANGE_MONEY",
    "payItemId": "ORANGE-MONEY-001",
    "payItemDescr": "Paiement Orange Money",
    "amountType": "VARIABLE",
    "localCur": "XAF",
    "name": "Orange Money",
    "amountLocalCur": 0,
    "description": "Service de paiement Orange Money"
  }
]
```

**Champs Importants:**
- `merchant`: Identifiant de l'opérateur (MTN_MOMO, ORANGE_MONEY, etc.)
- `payItemId`: Identifiant unique du service de paiement
- `amountType`: "VARIABLE" pour les montants personnalisés

### 3.2 Demande de Devis

**Endpoint:** `POST /quote`

**Objectif:** Obtenir un devis pour un paiement spécifique.

**Requête (Exemple):**
```http
POST /quote HTTP/1.1
Host: api.smobilpay.com
Content-Type: application/json
Authorization: OAuth oauth_consumer_key="YOUR_ACCESS_TOKEN", ...

{
  "amount": 5000,
  "payItemId": "MTN-MOMO-001",
  "currency": "XAF"
}
```

**Réponse (Exemple):**
```json
{
  "quoteId": "QT123456789",
  "expiresAt": "2025-09-12T15:30:00Z",
  "payItemId": "MTN-MOMO-001",
  "amountLocalCur": 5000,
  "priceLocalCur": 5000,
  "priceSystemCur": 5000,
  "localCur": "XAF",
  "systemCur": "XAF"
}
```

**Champs Importants:**
- `quoteId`: Identifiant unique du devis (valide 15 minutes)
- `expiresAt`: Date d'expiration du devis
- `amountLocalCur`: Montant à payer par le client (en XAF)

### 3.3 Exécution du Paiement

**Endpoint:** `POST /collect`

**Objectif:** Initier le paiement mobile money.

**Requête (Exemple):**
```http
POST /collect HTTP/1.1
Host: api.smobilpay.com
Content-Type: application/json
Authorization: OAuth oauth_consumer_key="YOUR_ACCESS_TOKEN", ...

{
  "quoteId": "QT123456789",
  "customerPhonenumber": "237699123456",
  "customerEmailaddress": "client@example.com",
  "customerName": "Jean Dupont",
  "serviceNumber": "YOUR_SERVICE_NUMBER",
  "trid": "TRANS123456"
}
```

**Réponse (Exemple):**
```json
{
  "ptn": "PTN987654321",
  "timestamp": "2025-09-12T14:15:22Z",
  "agentBalance": 150000,
  "receiptNumber": "RC123456789",
  "veriCode": "1234",
  "priceLocalCur": 5000,
  "priceSystemCur": 5000,
  "localCur": "XAF",
  "systemCur": "XAF",
  "trid": "TRANS123456",
  "status": "PENDING",
  "payItemId": "MTN-MOMO-001",
  "payItemDescr": "Paiement Mobile Money MTN"
}
```

**Champs Importants:**
- `ptn`: Identifiant unique de la transaction de paiement
- `status`: État actuel du paiement (PENDING, SUCCESS, FAILED)
- `veriCode`: Code de confirmation (si nécessaire)

### 3.4 Vérification de Transaction

**Endpoint:** `GET /verifytx`

**Objectif:** Vérifier le statut d'une transaction.

**Requête (Exemple):**
```http
GET /verifytx?ptn=PTN987654321 HTTP/1.1
Host: api.smobilpay.com
Authorization: OAuth oauth_consumer_key="YOUR_ACCESS_TOKEN", ...
```

**Réponse (Exemple):**
```json
{
  "ptn": "PTN987654321",
  "status": "SUCCESS",
  "amount": 5000,
  "currency": "XAF",
  "timestamp": "2025-09-12T14:16:30Z",
  "customerInfo": {
    "name": "maxime cessu",
    "phone": "237699123456",
    "email": "client@example.com"
  },
  "merchantReference": "CMD12345"
}
```

### 3.5 Webhooks de Notification

**Endpoint:** `POST /v2/notify` (configuré côté S3P)

**Objectif:** Recevoir des mises à jour en temps réel sur les transactions.

**Notification (Exemple):**
```http
POST /v2/notify HTTP/1.1
Host: votre-domaine.com
Content-Type: application/json

{
  "eventType": "PAYMENT_COMPLETED",
  "ptn": "PTN987654321",
  "status": "SUCCESS",
  "amount": 5000,
  "currency": "XAF",
  "timestamp": "2025-09-12T14:16:30Z",
  "customerInfo": {
    "name": "Jean Dupont",
    "phone": "237699123456",
    "email": "client@example.com"
  },
  "metadata": {
    "orderId": "CMD12345",
    "customData": "Données personnalisées"
  }
}
```

## 4. Flux Complet de Paiement

1. **Récupération des Packages**
   - L'application récupère la liste des opérateurs disponibles
   - L'utilisateur sélectionne son opérateur

2. **Demande de Devis**
   - L'application envoie le montant et l'opérateur sélectionné
   - S3P retourne un devis avec un ID unique

3. **Exécution du Paiement**
   - L'application envoie les informations client avec l'ID du devis
   - Le client reçoit une demande de confirmation sur son mobile

4. **Vérification et Confirmation**
   - L'application vérifie périodiquement le statut
   - S3P envoie une notification webhook lors du changement de statut

## 5. Gestion des Erreurs

### Codes d'Erreur Courants

| Code | Description | Action Recommandée |
|------|-------------|-------------------|
| 400 | Requête invalide | Vérifier les paramètres d'entrée |
| 401 | Non autorisé | Vérifier les identifiants OAuth |
| 403 | Accès refusé | Vérifier les permissions du compte |
| 404 | Ressource non trouvée | Vérifier l'URL et les paramètres |
| 429 | Trop de requêtes | Réduire la fréquence des appels |
| 500 | Erreur serveur | Réessayer plus tard |

## 6. Bonnes Pratiques

1. **Sécurité**
   - Ne jamais exposer les clés secrètes dans le code client
   - Utiliser HTTPS pour toutes les communications
   - Valider toutes les entrées utilisateur

2. **Performance**
   - Mettre en cache les packages de paiement
   - Utiliser le polling avec modération
   - Implémenter des timeouts appropriés

3. **Expérience Utilisateur**
   - Afficher clairement le statut du paiement
   - Fournir des messages d'erreur explicites
   - Offrir un support client en cas de problème

## 7. Exemple d'Implémentation

### 7.1 Installation des Dépendances

```bash
npm install axios crypto dotenv
```

### 7.2 Configuration de Base

```typescript
// config.ts
export const S3P_CONFIG = {
  BASE_URL: process.env.S3P_BASE_URL || 'https://api.smobilpay.com/s3p/v2',
  ACCESS_TOKEN: process.env.S3P_ACCESS_TOKEN,
  ACCESS_SECRET: process.env.S3P_ACCESS_SECRET,
  ENDPOINTS: {
    CASHIN: '/cashin',
    QUOTE: '/quote',
    COLLECT: '/collect',
    VERIFY: '/verifytx',
  },
  CURRENCY: 'XAF',
};
```

### 7.3 Service de Paiement

```typescript
// mobileWalletService.ts
import axios from 'axios';
import { S3P_CONFIG } from './config';
import { 
  generateNonce, 
  generateTimestamp, 
  createBaseString, 
  calculateSignature 
} from './auth';

export class S3PMobileWalletService {
  // ... (voir l'implémentation complète plus haut)
}
```

### 7.4 Exemple d'Utilisation

```typescript
// Exemple de flux de paiement
async function processPayment(amount: number, phone: string, email: string) {
  try {
    const paymentService = new S3PMobileWalletService();
    
    // 1. Récupérer les packages
    const packages = await paymentService.getCashinPackages();
    const mtnPackage = packages.find(pkg => pkg.merchant === 'MTN_MOMO');
    
    if (!mtnPackage) throw new Error('Service MTN non disponible');
    
    // 2. Demander un devis
    const quote = await paymentService.requestQuote(amount, mtnPackage.payItemId);
    
    // 3. Exécuter le paiement
    const payment = await paymentService.collectPayment(
      quote.quoteId,
      phone,
      email,
      'John Doe',
      'ORDER123'
    );
    
    // 4. Vérifier le statut
    const checkStatus = async (): Promise<any> => {
      const status = await paymentService.verifyTransaction(payment.ptn);
      
      if (status.status === 'PENDING') {
        // Attendre 5 secondes avant de revérifier
        await new Promise(resolve => setTimeout(resolve, 5000));
        return checkStatus();
      }
      
      return status;
    };
    
    const finalStatus = await checkStatus();
    return { success: true, status: finalStatus };
    
  } catch (error) {
    console.error('Erreur de paiement:', error);
    return { success: false, error: error.message };
  }
}
```

## 8. Scénario d'Utilisation Complet

### Étape 1: Initialisation
L'utilisateur sélectionne un abonnement à 5 000 FCFA et clique sur "Payer avec Mobile Money".

### Étape 2: Sélection de l'Opérateur
L'application affiche la liste des opérateurs disponibles (MTN, Orange, etc.) récupérés via `/cashin`.

### Étape 3: Demande de Devis
L'application envoie une demande à `/quote` avec le montant et l'opérateur sélectionné.

### Étape 4: Confirmation Client
L'utilisateur entre son numéro de téléphone et confirme le paiement.

### Étape 5: Exécution du Paiement
L'application appelle `/collect` avec les informations client et l'ID du devis.

### Étape 6: Validation
- Le client reçoit une demande de confirmation sur son mobile
- Il entre son code PIN pour valider

### Étape 7: Vérification
- L'application vérifie le statut via `/verifytx`
- Une notification webhook est également reçue

### Étape 8: Confirmation
- L'application affiche une confirmation de paiement
- Le service est activé pour l'utilisateur

### Étape 9: Gestion des Erreurs
En cas d'échec, l'application propose de réessayer ou de contacter le support.

## Conclusion

Cette documentation couvre l'ensemble du processus d'intégration de l'API S3P SmobilPay pour les paiements mobiles. En suivant ces instructions, vous devriez être en mesure d'implémenter une solution de paiement sécurisée et fiable dans votre application.
