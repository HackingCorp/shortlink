// scripts/test-collect-endpoint-updated.ts
import dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { S3PMobileWalletService } from '@/lib/s3p/mobileWalletService';
import { testSignatureExample } from '@/lib/s3p/auth';

// Données de test
const TEST_PHONE = '653287208'; // Numéro Orange Money de test
const TEST_EMAIL = 'cessumaxime1@gmail.com';
const TEST_NAME = 'maxime';

async function testCollectEndpoint() {
  try {
    console.log('=== Test du point de terminaison COLLECT - Version S3P Officielle ===');
    
    // 0. Tester d'abord la signature avec l'exemple de la documentation
    console.log('\n0. Test de validation de la signature...');
    testSignatureExample();
    
    const s3pService = new S3PMobileWalletService();
    
    // 1. Test de base - Récupérer les packages cash-in
    console.log('\n1. Test de connexion API - Récupération des packages cash-in...');
    try {
      const packages = await s3pService.getCashinPackages();
      
      if (packages.length === 0) {
        console.log('⚠️  Aucun package cash-in disponible, mais la connexion API fonctionne');
        return;
      }
      
      console.log(`✅ ${packages.length} packages trouvés:`);
      packages.slice(0, 3).forEach((pkg, index) => {
        console.log(`  [${index + 1}] ${pkg.merchant} - ${pkg.name} (${pkg.payItemId})`);
        console.log(`      Type: ${pkg.amountType}, Montant: ${pkg.amountLocalCur || 'Variable'} ${pkg.localCur}`);
      });
      
      if (packages.length > 3) {
        console.log(`  ... et ${packages.length - 3} autres packages`);
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des packages:');
      if (error instanceof Error) {
        console.error(`   Message: ${error.message}`);
        
        // Si c'est une erreur de signature, on s'arrête ici
        if (error.message.includes('Signature does not pass server validation')) {
          console.error('\n🔧 PROBLÈME DE SIGNATURE DÉTECTÉ');
          console.error('   La signature OAuth ne passe pas la validation serveur.');
          console.error('   Vérifiez que :');
          console.error('   1. S3P_ACCESS_TOKEN et S3P_ACCESS_SECRET sont corrects');
          console.error('   2. L\'URL de base S3P_BASE_URL est correcte');
          console.error('   3. Les credentials ne sont pas expirés');
          return;
        }
      }
      throw error;
    }
    
    // 2. Test de demande de devis
    console.log('\n2. Test de demande de devis...');
    const packages = await s3pService.getCashinPackages();
    const selectedPackage = packages.find(pkg => pkg.amountType === 'VARIABLE') || packages[0];
    
    if (!selectedPackage) {
      console.log('⚠️  Aucun package disponible pour tester le devis');
      return;
    }
    
    console.log(`Package sélectionné: ${selectedPackage.name} (${selectedPackage.payItemId})`);
    
    const amount = 1000; // 1000 FCFA
    let quote;
    
    try {
      quote = await s3pService.requestQuote({
        amount: amount,
        payItemId: selectedPackage.payItemId
      });
      
      console.log('✅ Devis obtenu:');
      console.log(`   ID: ${quote.quoteId}`);
      console.log(`   Montant: ${quote.amountLocalCur} ${quote.localCur}`);
      console.log(`   Prix: ${quote.priceLocalCur} ${quote.localCur}`);
      console.log(`   Expire: ${quote.expiresAt}`);
      
    } catch (error) {
      console.error('❌ Erreur lors de la demande de devis:');
      if (error instanceof Error) {
        console.error(`   Message: ${error.message}`);
        
        if (error.message.includes('400')) {
          console.error('\n💡 SUGGESTIONS:');
          console.error('   - Vérifiez que le payItemId est valide');
          console.error('   - Vérifiez que le montant est dans la fourchette autorisée');
        }
      }
      throw error;
    }
    
    // 3. Confirmation avant le paiement réel
    console.log('\n3. Test de collecte (PAIEMENT RÉEL)...');
    console.log(`⚠️  ATTENTION: Ceci va déclencher un vrai paiement de ${quote.priceLocalCur} ${quote.localCur}!`);
    console.log(`   Numéro: ${TEST_PHONE}`);
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Nom: ${TEST_NAME}`);
    
    console.log('\n🛑 Appuyez sur Ctrl+C pour annuler, ou attendez 15 secondes pour continuer...');
    console.log('   (Réduisez ce délai en modifiant le script si nécessaire)');
    
    // Compte à rebours
    for (let i = 15; i > 0; i--) {
      process.stdout.write(`\r   Démarrage dans ${i} secondes... `);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\n');
    
    // 4. Exécution de la collecte
    const serviceNumber = TEST_PHONE.startsWith('237') ? TEST_PHONE.substring(3) : TEST_PHONE;
    const trid = `test_collect_${Date.now()}`;
    
    const collectRequest = {
      quoteId: quote.quoteId,
      customerPhonenumber: serviceNumber,
      customerEmailaddress: TEST_EMAIL,
      customerName: TEST_NAME,
      serviceNumber: serviceNumber,
      trid: trid,
      tag: 'api_test',
      callback_url: `https://example.com/callback/${trid}` // URL de test
    };
    
    console.log('Données de collecte:');
    console.log(JSON.stringify(collectRequest, null, 2));
    
    let collectResponse;
    try {
      console.log('\n🚀 Exécution de la collecte...');
      collectResponse = await s3pService.executeCollection(collectRequest);
      
      console.log('\n✅ Collecte initiée:');
      console.log(`   PTN: ${collectResponse.ptn}`);
      console.log(`   Statut: ${collectResponse.status}`);
      console.log(`   Reçu: ${collectResponse.receiptNumber}`);
      console.log(`   Montant: ${collectResponse.priceLocalCur} ${collectResponse.localCur}`);
      console.log(`   Code vérification: ${collectResponse.veriCode}`);
      
      if (collectResponse.pin) {
        console.log(`   🔐 Code PIN: ${collectResponse.pin}`);
      }
      
      if (collectResponse.status === 'PENDING') {
        console.log('\n📱 Le paiement est en attente. Vérifiez votre téléphone pour confirmer.');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la collecte:');
      if (error instanceof Error) {
        console.error(`   Message: ${error.message}`);
        
        if (error.message.includes('insufficient')) {
          console.error('   💰 Solde insuffisant sur le compte mobile money');
        } else if (error.message.includes('invalid')) {
          console.error('   📞 Numéro de téléphone invalide ou non activé pour mobile money');
        }
      }
      throw error;
    }
    
    // 5. Vérification du statut (si la collecte a été initiée)
    if (collectResponse) {
      console.log('\n5. Vérification du statut...');
      console.log('Attente de 15 secondes avant vérification...');
      
      for (let i = 15; i > 0; i--) {
        process.stdout.write(`\rVérification dans ${i}s... `);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      console.log('\n');
      
      try {
        const verification = await s3pService.verifyTransaction(collectResponse.ptn);
        
        console.log('📊 Statut de la transaction:');
        console.log(`   PTN: ${verification.ptn}`);
        console.log(`   Statut: ${verification.status}`);
        console.log(`   Montant: ${verification.amount} ${verification.currency}`);
        console.log(`   Horodatage: ${verification.timestamp}`);
        
        if (verification.status === 'SUCCESS') {
          console.log('🎉 PAIEMENT RÉUSSI !');
        } else if (verification.status === 'PENDING') {
          console.log('⏳ Paiement toujours en attente...');
        } else if (verification.status === 'FAILED') {
          console.log('❌ Échec du paiement');
        }
        
      } catch (error) {
        console.log('⚠️  Impossible de vérifier le statut (normal si PTN invalide)');
        console.log(`   Erreur: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    console.log('\n=== Test terminé ===');
    return {
      packages: packages.length,
      quote: quote ? quote.quoteId : null,
      collect: collectResponse ? collectResponse.ptn : null
    };
    
  } catch (error) {
    console.error('\n💥 ERREUR CRITIQUE:');
    if (error instanceof Error) {
      console.error(`Message: ${error.message}`);
      
      // Diagnostics selon le type d'erreur
      if (error.message.includes('fetch')) {
        console.error('\n🌐 PROBLÈME DE RÉSEAU:');
        console.error('   - Vérifiez votre connexion internet');
        console.error('   - Vérifiez que l\'URL S3P_BASE_URL est accessible');
      } else if (error.message.includes('credentials') || error.message.includes('token')) {
        console.error('\n🔑 PROBLÈME D\'AUTHENTIFICATION:');
        console.error('   - Vérifiez S3P_ACCESS_TOKEN dans .env');
        console.error('   - Vérifiez S3P_ACCESS_SECRET dans .env');
        console.error('   - Les credentials ont-ils expiré ?');
      } else if (error.message.includes('signature')) {
        console.error('\n✍️  PROBLÈME DE SIGNATURE:');
        console.error('   - L\'algorithme de signature ne correspond pas');
        console.error('   - Vérifiez l\'implémentation OAuth dans auth.ts');
      }
      
      if (error.stack) {
        console.error('\nStack trace (première ligne):');
        console.error(error.stack.split('\n')[0]);
      }
    } else {
      console.error(error);
    }
    
    process.exit(1);
  }
}

// Fonction utilitaire pour tester uniquement la connectivité
async function testConnectivityOnly() {
  console.log('🔗 Test de connectivité S3P...');
  try {
    const s3pService = new S3PMobileWalletService();
    const packages = await s3pService.getCashinPackages();
    console.log(`✅ Connectivité OK - ${packages.length} packages disponibles`);
    return true;
  } catch (error) {
    console.log(`❌ Échec de connectivité: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

// Exécution selon les arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--connectivity-only') || args.includes('-c')) {
    testConnectivityOnly().then(success => {
      process.exit(success ? 0 : 1);
    });
  } else {
    testCollectEndpoint()
      .then((result) => {
        console.log('\n✅ Test terminé avec succès');
        if (result) {
          console.log(`Résumé: ${result.packages} packages, devis ${result.quote}, collecte ${result.collect}`);
        }
        process.exit(0);
      })
      .catch(() => {
        process.exit(1);
      });
  }
}

export { testCollectEndpoint, testConnectivityOnly };