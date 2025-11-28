// scripts/test-transaction-flow.ts
// Script de test pour le flux complet de transaction S3P avec gestion des transactions

import { s3pMobileWallet } from '../lib/s3p/mobileWalletService';
import { TransactionService } from '../lib/s3p/transaction.service';

// Configuration de test
const TEST_CONFIG = {
  amount: 10, // Montant en XAF
  operatorId: 'orange' as const, // 'orange' | 'mtn' | 'eu'
  customerPhone: '237699123456', // Numéro de test Orange Money
  customerName: 'Test User',
  customerEmail: 'test@example.com',
  userId: 1, // ID utilisateur de test
  serviceNumber: '123456', // Numéro de service de test
};

async function testTransactionFlow() {
  console.log('=== Début du test de flux de transaction S3P ===');
  
  // Utiliser l'instance globale du service S3P
  const s3pService = s3pMobileWallet;
  
  try {
    // Étape 1: Récupérer les packages disponibles
    console.log('\n1. Récupération des packages disponibles...');
    const packages = await s3pService.getCashinPackages();
    console.log(`Packages disponibles (${packages.length}):`);
    packages.forEach((pkg: any, index: number) => {
      console.log(`  ${index + 1}. ${pkg.merchant} - ${pkg.name}: ${pkg.amountLocalCur} ${pkg.localCur}`);
    });
    
    // Sélectionner le package Orange Money
    const orangePackage = packages.find((pkg: any) => 
      pkg.merchant === 'ORANGE_MONEY' && 
      pkg.amountType === 'VARIABLE'
    );
    
    if (!orangePackage) {
      throw new Error('Aucun package Orange Money variable trouvé');
    }
    
    console.log(`\nPackage sélectionné: ${orangePackage.name} (${orangePackage.payItemId})`);
    
    // Étape 2: Demander un devis
    console.log('\n2. Demande de devis...');
    const quote = await s3pService.requestQuote({
      amount: TEST_CONFIG.amount,
      payItemId: orangePackage.payItemId
    });
    
    console.log('Devis obtenu:', {
      quoteId: quote.quoteId,
      montant: quote.amountLocalCur,
      devise: quote.localCur,
      expire: quote.expiresAt
    });
    
    // Étape 3: Exécuter le paiement
    console.log('\n3. Exécution du paiement...');
    const payment = await s3pService.executeCollection({
      quoteId: quote.quoteId,
      customerPhonenumber: TEST_CONFIG.customerPhone,
      customerEmailaddress: TEST_CONFIG.customerEmail,
      customerName: TEST_CONFIG.customerName,
      serviceNumber: TEST_CONFIG.serviceNumber,
      trid: `TEST-${Date.now()}`,
      tag: `test-user-${TEST_CONFIG.userId}`
    });
    
    console.log('Paiement initié avec succès:', {
      ptn: payment.ptn,
      statut: payment.status,
      montant: payment.priceLocalCur,
      devise: payment.localCur,
      reçu: payment.receiptNumber
    });
    
    // Étape 4: Vérifier la transaction
    console.log('\n4. Vérification de la transaction...');
    
    // Attendre 10 secondes pour laisser le temps au paiement d'être traité
    console.log('Attente de 10 secondes pour le traitement du paiement...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Vérifier la transaction
    const verification = await s3pService.verifyTransaction(payment.ptn);
    
    console.log('Statut de la transaction:', {
      ptn: verification.ptn,
      statut: verification.status,
      montant: verification.amount,
      devise: verification.currency,
      date: verification.timestamp,
      client: verification.customerInfo
    });
    
    // Vérifier la transaction dans la base de données
    console.log('\n5. Vérification dans la base de données...');
    const dbTransaction = await TransactionService.getTransactionByPtn(payment.ptn);
    
    if (dbTransaction) {
      console.log('Transaction trouvée dans la base de données:', {
        id: dbTransaction.id,
        ptn: dbTransaction.ptn,
        statut: dbTransaction.status,
        montant: dbTransaction.amount / 100, // Convertir en unités
        devise: dbTransaction.currency,
        client: {
          nom: dbTransaction.customerName,
          telephone: dbTransaction.customerPhone,
          email: dbTransaction.customerEmail
        },
        dateCreation: dbTransaction.createdAt,
        dateMaj: dbTransaction.updatedAt
      });
    } else {
      console.warn('Transaction non trouvée dans la base de données');
    }
    
    console.log('\n=== Test terminé avec succès ===');
    
  } catch (error) {
    console.error('\n=== ERREUR LORS DU TEST ===');
    console.error(error instanceof Error ? error.message : 'Erreur inconnue');
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Exécuter le test
if (require.main === module) {
  testTransactionFlow()
    .catch(error => {
      console.error('Erreur lors de l\'exécution du test:', error);
      process.exit(1);
    });
}

export default testTransactionFlow;
