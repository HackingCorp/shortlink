// scripts/test-subscription-flows.ts
import dotenv from 'dotenv';
import path from 'path';
import { S3PMobileWalletService } from '@/lib/s3p/mobileWalletService';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Configuration des tests
const CONFIG = {
  // Numéros de test
  TEST_PHONE: process.env.TEST_PHONE || '655006556',
  TEST_EMAIL: process.env.TEST_EMAIL || 'cessumaxime1@gmail.com',
  TEST_NAME: process.env.TEST_NAME || 'Test User',
  
  // Montants de test (en FCFA)
  AMOUNTS: {
    BASIC: 500,
    STANDARD: 1000,
    PREMIUM: 2000
  },
  
  // Délais (en millisecondes)
  DELAY_BEFORE_VERIFY: 15000, // 15 secondes
  
  // Options
  DEBUG: process.env.DEBUG === 'true'
};

// Logger amélioré
const logger = {
  info: (message: string, data?: any) => {
    console.log(`ℹ️  ${message}`, data || '');
  },
  success: (message: string) => {
    console.log(`✅ ${message}`);
  },
  error: (message: string, error?: any) => {
    console.error(`❌ ${message}`, error || '');
  },
  debug: (message: string, data?: any) => {
    if (CONFIG.DEBUG) {
      console.debug(`🐞 ${message}`, data || '');
    }
  }
};

// Fonction utilitaire pour attendre
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fonction pour tester une souscription
async function testSubscription(plan: 'BASIC' | 'STANDARD' | 'PREMIUM', isUpgrade: boolean = false) {
  const s3pService = new S3PMobileWalletService();
  const amount = CONFIG.AMOUNTS[plan];
  const operatorId = CONFIG.TEST_PHONE.startsWith('67') || CONFIG.TEST_PHONE.startsWith('65') ? 'mtn' : 'orange';
  
  try {
    logger.info(`\n=== DÉBUT TEST ${isUpgrade ? 'MISE À NIVEAU' : 'SOUSCRIPTION'} ${plan} ===`);
    logger.info(`Montant: ${amount} FCFA`);
    logger.info(`Opérateur: ${operatorId.toUpperCase()}`);
    
    // 1. Récupérer les packages disponibles
    logger.info('\n1. Récupération des packages...');
    const packages = await s3pService.getCashinPackages();
    
    // 2. Exécuter le paiement
    logger.info('\n2. Exécution du paiement...');
    const result = await s3pService.processSubscriptionPayment({
      amount,
      operatorId: operatorId as 'mtn' | 'orange',
      customerName: CONFIG.TEST_NAME,
      customerPhone: CONFIG.TEST_PHONE,
      customerEmail: CONFIG.TEST_EMAIL,
      userId: 'test-user-123',
      planId: plan.toLowerCase(),
      subscriptionInfo: isUpgrade ? 'upgrade' : 'new'
    });
    
    // 3. Vérifier le résultat
    logger.info('\n3. Résultat du paiement:', {
      success: result.success,
      status: result.status,
      ptn: result.ptn
    });
    
    if (result.success) {
      logger.success(`Paiement réussi! PTN: ${result.ptn}`);
    } else {
      logger.error('Échec du paiement', result.message);
    }
    
    return result;
    
  } catch (error) {
    logger.error('Erreur lors du test de souscription', error);
    throw error;
  }
}

// Fonction pour tester un réabonnement
async function testResubscription(previousPtn: string) {
  const s3pService = new S3PMobileWalletService();
  
  try {
    logger.info('\n=== DÉBUT TEST RÉABONNEMENT ===');
    
    // 1. Vérifier l'état du précédent paiement
    logger.info('\n1. Vérification du paiement précédent...');
    const verification = await s3pService.verifyTransaction(previousPtn);
    
    if (verification.status !== 'SUCCESS') {
      throw new Error(`Le paiement précédent n'est pas en statut SUCCESS (${verification.status})`);
    }
    
    // 2. Exécuter un nouveau paiement (similaire au précédent)
    logger.info('\n2. Exécution du réabonnement...');
    const amount = verification.amount;
    const operatorId = verification.customerInfo.phone.startsWith('2376') ? 
      (verification.customerInfo.phone.startsWith('23767') ? 'mtn' : 'orange') : 'mtn';
    
    const result = await s3pService.processSubscriptionPayment({
      amount,
      operatorId: operatorId as 'mtn' | 'orange',
      customerName: verification.customerInfo.name || CONFIG.TEST_NAME,
      customerPhone: verification.customerInfo.phone.replace('237', ''),
      customerEmail: verification.customerInfo.email || CONFIG.TEST_EMAIL,
      userId: 'test-user-123',
      planId: 'resubscription',
      subscriptionInfo: 'resubscription'
    });
    
    // 3. Vérifier le résultat
    logger.info('\n3. Résultat du réabonnement:', {
      success: result.success,
      status: result.status,
      ptn: result.ptn
    });
    
    if (result.success) {
      logger.success(`Réabonnement réussi! Nouveau PTN: ${result.ptn}`);
    } else {
      logger.error('Échec du réabonnement', result.message);
    }
    
    return result;
    
  } catch (error) {
    logger.error('Erreur lors du test de réabonnement', error);
    throw error;
  }
}

// Fonction principale
async function main() {
  try {
    logger.info('=== DÉMARRAGE DES TESTS DE SOUSCRIPTIONS ===');
    
    // Test de souscription BASIC
    const basicResult = await testSubscription('BASIC');
    
    if (basicResult.success && basicResult.ptn) {
      // Attendre un peu avant le test de mise à niveau
      await wait(5000);
      
      // Test de mise à niveau vers STANDARD
      await testSubscription('STANDARD', true);
      
      // Attendre un peu avant le test de réabonnement
      await wait(5000);
      
      // Test de réabonnement
      await testResubscription(basicResult.ptn);
    }
    
    logger.success('=== TESTS TERMINÉS AVEC SUCCÈS ===');
    
  } catch (error) {
    logger.error('=== ERREUR LORS DES TESTS ===', error);
    process.exit(1);
  }
}

// Exécution du script
if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 ERREUR NON GÉRÉE:', error);
    process.exit(1);
  });
}

export { testSubscription, testResubscription };
