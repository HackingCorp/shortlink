// scripts/test-quote-endpoint.ts
import dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { S3PMobileWalletService } from '@/lib/s3p/mobileWalletService';

async function testQuoteEndpoint() {
  try {
    console.log('=== Test du point de terminaison QUOTE ===');
    const s3pService = new S3PMobileWalletService();
    
    // 1. Récupérer un package cash-in valide
    console.log('\n1. Récupération des packages cash-in...');
    const packages = await s3pService.getCashinPackages();
    
    if (packages.length === 0) {
      throw new Error('Aucun package cash-in disponible');
    }
    
    // Prendre le premier package qui supporte un montant personnalisé (CUSTOM)
    const customPackage = packages.find(pkg => pkg.amountType === 'CUSTOM');
    
    if (!customPackage) {
      throw new Error('Aucun package avec montant personnalisé trouvé');
    }
    
    console.log(`\nPackage sélectionné pour le test:`);
    console.log(`- Marchand: ${customPackage.merchant}`);
    console.log(`- Nom: ${customPackage.name}`);
    console.log(`- ID du package: ${customPackage.payItemId}`);
    console.log(`- Type de montant: ${customPackage.amountType}`);
    
    // 2. Demander un devis pour un montant spécifique
    const amount = 1000; // 1000 FCFA pour le test
    console.log(`\n2. Demande de devis pour ${amount} FCFA...`);
    
    const quote = await s3pService.requestQuote({
      amount: amount,
      payItemId: customPackage.payItemId
    });
    
    console.log('\n✅ Devis obtenu avec succès:');
    console.log(`- ID du devis: ${quote.quoteId}`);
    console.log(`- Montant demandé: ${quote.amountLocalCur} ${quote.localCur}`);
    console.log(`- Prix à payer: ${quote.priceLocalCur} ${quote.localCur}`);
    console.log(`- Devise: ${quote.localCur}`);
    console.log(`- Expire le: ${quote.expiresAt}`);
    
    if (quote.promotion) {
      console.log(`- Promotion appliquée: ${quote.promotion}`);
    }
    
    return quote;
    
  } catch (error) {
    console.error('\n❌ Erreur lors du test du point de terminaison QUOTE:');
    if (error instanceof Error) {
      console.error(`Message: ${error.message}`);
      if (error.stack) {
        console.error('Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Exécuter le test
testQuoteEndpoint().then(() => {
  console.log('\n=== Test terminé avec succès ===');
  process.exit(0);
}).catch(error => {
  console.error('\n=== Échec du test ===');
  console.error(error);
  process.exit(1);
});
