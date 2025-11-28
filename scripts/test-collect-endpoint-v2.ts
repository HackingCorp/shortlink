// scripts/test-collect-endpoint-v3.ts
import dotenv from 'dotenv';
import path from 'path';
import { S3PMobileWalletService } from '@/lib/s3p/mobileWalletService';
import { testSignatureExample } from '@/lib/s3p/auth';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Numéros de test validés pour l'API S3P
const VALID_TEST_NUMBERS = {
  // MTN Mobile Money - Confirmés compatibles avec la regex S3P
  mtn: [
    '677123456',  // 67x - format standard MTN
    '670123456',  // 67x - format standard MTN
    '679876543',  // 67x - format standard MTN
    '650123456',  // 650-654 - MTN confirmé
    '651123456',  // 650-654 - MTN confirmé
    '680123456',  // 680-684 - MTN confirmé (si supporté par API)
  ],
  
  // Orange Money - À tester avec prudence (regex S3P peut être incomplète)
  orange: [
    '685123456',  // 685-689 - Orange confirmé dans regex S3P
    '686123456',  // 685-689 - Orange confirmé dans regex S3P
    '689123456',  // 685-689 - Orange confirmé dans regex S3P
    // Les 69x ne sont PAS dans la regex S3P actuelle
    '699123456',  // 69x - Orange réel mais peut échouer avec S3P
    '695123456',  // 69x - Orange réel mais peut échouer avec S3P
  ],
  
  // Numéros safelist - Garantis de fonctionner avec S3P
  safe: [
    '677123456',  // MTN 67x - le plus sûr
    '670123456',  // MTN 67x - le plus sûr
    '685123456',  // Orange 685-689 - confirmé dans regex
    '689123456',  // Orange 685-689 - confirmé dans regex
  ]
};

// Configuration du test avec sélection intelligente de numéro
const CONFIG = {
  // Sélection automatique d'un numéro sûr si aucun n'est spécifié
  TEST_PHONE: process.env.TEST_PHONE || VALID_TEST_NUMBERS.safe[0], // 677123456 par défaut
  TEST_EMAIL: process.env.TEST_EMAIL || 'test@example.com',
  TEST_NAME: process.env.TEST_NAME || 'Test User',
  
  // Montant du paiement (en FCFA)
  TEST_AMOUNT: parseInt(process.env.TEST_AMOUNT || '100', 10),
  
  // Délais (en millisecondes)
  DELAY_BEFORE_COLLECT: 5000,
  DELAY_BEFORE_VERIFY: 15000,
  
  // Options
  DEBUG: process.env.DEBUG === 'true',
  SKIP_COLLECT: process.env.SKIP_COLLECT === 'true',
  FORCE_OPERATOR: process.env.FORCE_OPERATOR as 'mtn' | 'orange' | undefined,
};

// Logger amélioré
const logger = {
  info: (message: string, data?: any) => {
    console.log(`ℹ️  ${message}`);
    if (data && CONFIG.DEBUG) {
      console.log(JSON.stringify(data, null, 2));
    }
  },
  success: (message: string) => console.log(`✅ ${message}`),
  warn: (message: string) => console.warn(`⚠️  ${message}`),
  error: (message: string, error?: any) => {
    console.error(`❌ ${message}`);
    if (error) {
      console.error(error instanceof Error ? error.message : error);
      if (CONFIG.DEBUG && error.stack) {
        console.error(error.stack);
      }
    }
  },
  debug: (message: string, data?: any) => {
    if (CONFIG.DEBUG) {
      console.log(`🐞 ${message}`);
      if (data) console.log(JSON.stringify(data, null, 2));
    }
  },
};

// Validation et suggestion de numéros
const validateAndSuggestNumber = (phone: string): { 
  isValid: boolean; 
  operator?: string; 
  suggestion?: string; 
  reason?: string 
} => {
  const cleaned = phone.replace(/\D/g, '');
  const localNumber = cleaned.startsWith('237') ? cleaned.substring(3) : cleaned;
  
  if (localNumber.length !== 9) {
    return { 
      isValid: false, 
      reason: 'Le numéro doit contenir 9 chiffres',
      suggestion: VALID_TEST_NUMBERS.safe[0]
    };
  }
  
  const prefix3 = localNumber.substring(0, 3);
  const prefix2 = localNumber.substring(0, 2);
  
  // Vérifier si le numéro est dans nos listes connues
  const allValidNumbers = [...VALID_TEST_NUMBERS.mtn, ...VALID_TEST_NUMBERS.orange];
  if (allValidNumbers.includes(localNumber)) {
    const operator = VALID_TEST_NUMBERS.mtn.includes(localNumber) ? 'MTN' : 'Orange';
    return { isValid: true, operator };
  }
  
  // Vérifier selon la regex S3P connue
  const s3pPattern = /^(650|651|652|653|654|680|681|682|683|684|685|686|687|688|689)[0-9]{6}$|^(67[0-9]{7})$/;
  
  if (s3pPattern.test(localNumber)) {
    const operator = prefix2 === '67' || (prefix3 >= '650' && prefix3 <= '654') || 
                    (prefix3 >= '680' && prefix3 <= '684') ? 'MTN' : 'Orange';
    return { isValid: true, operator };
  }
  
  // Numéro potentiellement valide selon les vrais opérateurs mais pas selon S3P
  if (prefix2 === '69' || (prefix3 >= '655' && prefix3 <= '659')) {
    return { 
      isValid: false, 
      operator: 'Orange',
      reason: `Le numéro ${localNumber} est un numéro Orange valide, mais l'API S3P ne semble pas le supporter`,
      suggestion: VALID_TEST_NUMBERS.orange.find(n => n.startsWith('68')) || VALID_TEST_NUMBERS.safe[2]
    };
  }
  
  return { 
    isValid: false, 
    reason: `Préfixe ${prefix3} non reconnu par l'API S3P`,
    suggestion: CONFIG.FORCE_OPERATOR === 'orange' ? VALID_TEST_NUMBERS.safe[2] : VALID_TEST_NUMBERS.safe[0]
  };
};

// Fonction utilitaire pour attendre
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fonction pour formater le numéro de téléphone
const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('237')) {
    return cleaned;
  } else if (cleaned.startsWith('6') && cleaned.length === 9) {
    return `237${cleaned}`;
  } else if (cleaned.length >= 9) {
    return `237${cleaned.slice(-9)}`;
  }
  
  return cleaned;
};

// Fonction principale de test
async function testCollectEndpoint() {
  try {
    logger.info('=== Test du point de terminaison COLLECT S3P ===');
    logger.info(`Environnement: ${process.env.NODE_ENV || 'development'}`);
    
    // Validation du numéro de téléphone
    logger.info('\n🔍 Validation du numéro de téléphone...');
    const phoneValidation = validateAndSuggestNumber(CONFIG.TEST_PHONE);
    
    if (!phoneValidation.isValid) {
      logger.error(`❌ Numéro invalide: ${phoneValidation.reason}`);
      if (phoneValidation.suggestion) {
        logger.info(`💡 Suggestion: Utilisez ${phoneValidation.suggestion} (${phoneValidation.operator || 'compatible S3P'})`);
        
        // Option: utiliser automatiquement le numéro suggéré
        logger.info('\n🔄 Utilisation du numéro suggéré...');
        CONFIG.TEST_PHONE = phoneValidation.suggestion;
      } else {
        throw new Error('Aucun numéro valide disponible pour le test');
      }
    } else {
      logger.success(`✅ Numéro validé: ${CONFIG.TEST_PHONE} (${phoneValidation.operator})`);
    }
    
    // Afficher les numéros de test disponibles
    logger.info('\n📋 Numéros de test disponibles:');
    logger.info('   Numéros sûrs (garantis):');
    VALID_TEST_NUMBERS.safe.forEach(num => logger.info(`     - ${num}`));
    
    if (CONFIG.DEBUG) {
      logger.info('   Numéros MTN:');
      VALID_TEST_NUMBERS.mtn.forEach(num => logger.info(`     - ${num}`));
      logger.info('   Numéros Orange (certains peuvent échouer):');
      VALID_TEST_NUMBERS.orange.forEach(num => logger.info(`     - ${num}`));
    }
    
    // 0. Test de signature
    logger.info('\n🔐 Test de validation de la signature...');
    try {
      testSignatureExample();
      logger.success('Test de signature réussi');
    } catch (error) {
      logger.error('Échec du test de signature', error);
      throw new Error('La validation de la signature a échoué. Vérifiez vos identifiants OAuth.');
    }
    
    const s3pService = new S3PMobileWalletService();
    
    // 1. Récupérer les packages disponibles
    logger.info('\n📦 Récupération des packages cash-in disponibles...');
    let packages;
    try {
      packages = await s3pService.getCashinPackages();
      
      if (!packages || packages.length === 0) {
        throw new Error('Aucun package cash-in disponible');
      }
      
      logger.success(`${packages.length} packages trouvés`);
      packages.slice(0, 3).forEach((pkg, index) => {
        logger.info(`  [${index + 1}] ${pkg.merchant} - ${pkg.name} (${pkg.payItemId})`);
      });
      
      if (packages.length > 3) {
        logger.info(`  ... et ${packages.length - 3} autres packages`);
      }
    } catch (error) {
      logger.error('Erreur lors de la récupération des packages', error);
      throw error;
    }
    
    // Sélectionner un package approprié selon l'opérateur détecté
    let selectedPackage = packages.find(pkg => pkg.amountType === 'VARIABLE') || packages[0];
    
    if (phoneValidation.operator) {
      const operatorPackage = packages.find(pkg => 
        pkg.merchant.toUpperCase().includes(phoneValidation.operator!.toUpperCase()) ||
        pkg.payItemDescr.toUpperCase().includes(phoneValidation.operator!.toUpperCase())
      );
      if (operatorPackage) {
        selectedPackage = operatorPackage;
        logger.info(`📱 Package sélectionné pour ${phoneValidation.operator}: ${selectedPackage.name}`);
      }
    }
    
    logger.info(`\nPackage utilisé: ${selectedPackage.name} (${selectedPackage.payItemId})`);
    
    // 2. Demander un devis
    logger.info(`\n💰 Demande de devis pour ${CONFIG.TEST_AMOUNT} FCFA...`);
    let quote;
    try {
      quote = await s3pService.requestQuote({
        amount: CONFIG.TEST_AMOUNT,
        payItemId: selectedPackage.payItemId
      });
      
      logger.success('Devis obtenu avec succès');
      logger.info(`   ID: ${quote.quoteId}`);
      logger.info(`   Montant: ${quote.amountLocalCur} ${quote.localCur}`);
      logger.info(`   Prix: ${quote.priceLocalCur} ${quote.localCur}`);
      logger.info(`   Expire: ${quote.expiresAt}`);
      
    } catch (error) {
      logger.error('Erreur lors de la demande de devis', error);
      throw error;
    }
    
    // 3. Préparation et exécution de la collecte
    if (CONFIG.SKIP_COLLECT) {
      logger.warn('\n⚠️  La collecte a été ignorée (SKIP_COLLECT=true)');
      return { status: 'skipped', quoteId: quote.quoteId };
    }
    
    const formattedPhone = formatPhoneNumber(CONFIG.TEST_PHONE);
    const serviceNumber = formattedPhone.startsWith('237') ? formattedPhone.substring(3) : formattedPhone;
    
    logger.warn(`\n⚠️  ATTENTION: Paiement réel de ${quote.priceLocalCur} ${quote.localCur} !`);
    logger.info(`   Numéro: ${serviceNumber} (${phoneValidation.operator})`);
    logger.info(`   Package: ${selectedPackage.merchant}`);
    
    logger.info(`\n⏳ Démarrage dans ${CONFIG.DELAY_BEFORE_COLLECT / 1000}s... (Ctrl+C pour annuler)`);
    await wait(CONFIG.DELAY_BEFORE_COLLECT);
    
    // 4. Exécution de la collecte
    const trid = `test_${Date.now()}`;
    const collectRequest = {
      quoteId: quote.quoteId,
      customerPhonenumber: serviceNumber,
      customerEmailaddress: CONFIG.TEST_EMAIL,
      customerName: CONFIG.TEST_NAME,
      serviceNumber: serviceNumber,
      trid: trid,
      tag: 'api_test_v3'
    };
    
    let collectResponse;
    try {
      logger.info('\n🚀 Exécution de la collecte...');
      collectResponse = await s3pService.executeCollection(collectRequest);
      
      logger.success('\n✅ Collecte initiée avec succès');
      logger.info(`   PTN: ${collectResponse.ptn}`);
      logger.info(`   Statut: ${collectResponse.status}`);
      logger.info(`   Montant: ${collectResponse.priceLocalCur} ${collectResponse.localCur}`);
      
      if (collectResponse.pin) {
        logger.info(`   🔐 Code PIN: ${collectResponse.pin}`);
      }
      
    } catch (error) {
      logger.error('\n❌ Erreur lors de la collecte');
      
      // Analyser l'erreur pour donner des conseils spécifiques
      if (error instanceof Error && error.message.includes('does not comply to regex requirement')) {
        logger.error('\n🔍 ANALYSE DE L\'ERREUR:');
        logger.error(`   Le numéro ${serviceNumber} a été rejeté par l'API S3P`);
        logger.error('   Cela indique que la regex de S3P ne correspond pas à tous les numéros valides');
        logger.error('\n💡 SOLUTIONS:');
        logger.error('   1. Essayez avec un numéro de la liste "safe":');
        VALID_TEST_NUMBERS.safe.forEach(num => logger.error(`      - ${num}`));
        logger.error('   2. Contactez S3P pour mettre à jour leur regex de validation');
        logger.error('   3. Utilisez l\'environnement de production qui peut avoir des règles différentes');
      }
      
      throw error;
    }
    
    // 5. Vérification du statut
    logger.info(`\n⏳ Vérification du statut dans ${CONFIG.DELAY_BEFORE_VERIFY / 1000}s...`);
    await wait(CONFIG.DELAY_BEFORE_VERIFY);
    
    try {
      logger.info('🔍 Vérification du statut...');
      const verification = await s3pService.verifyTransaction(collectResponse.ptn);
      
      logger.info('\n📊 Résultat:');
      logger.info(`   PTN: ${verification.ptn}`);
      logger.info(`   Statut: ${verification.status}`);
      logger.info(`   Montant: ${verification.amount} ${verification.currency}`);
      
      return {
        status: verification.status.toLowerCase(),
        ptn: collectResponse.ptn,
        amount: verification.amount,
        currency: verification.currency,
        operator: phoneValidation.operator
      };
      
    } catch (error) {
      logger.warn('⚠️  Impossible de vérifier le statut', error);
      return {
        status: 'unknown',
        ptn: collectResponse.ptn,
        message: 'Impossible de vérifier le statut'
      };
    }
    
  } catch (error) {
    logger.error('\n💥 ERREUR CRITIQUE', error);
    throw error;
  }
}

// Point d'entrée principal
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx scripts/test-collect-endpoint-v3.ts [options]

Options:
  --help, -h              Affiche cette aide
  --debug                 Active le mode débogage détaillé
  --skip-collect          Saute la collecte (test jusqu'au devis)
  --phone=<numéro>        Numéro de test (ex: 677123456)
  --operator=<mtn|orange> Force la sélection d'un opérateur
  --amount=<montant>      Montant en FCFA (défaut: 100)
  --list-numbers          Affiche les numéros de test disponibles

Numéros de test recommandés (compatibles S3P):
  ${VALID_TEST_NUMBERS.safe.join(', ')}

Exemples:
  npx tsx scripts/test-collect-endpoint-v3.ts --phone=677123456 --debug
  npx tsx scripts/test-collect-endpoint-v3.ts --operator=orange --amount=500
    `);
    return;
  }
  
  if (args.includes('--list-numbers')) {
    console.log('\n📋 Numéros de test disponibles:\n');
    console.log('🟢 Numéros SAFE (garantis compatibles S3P):');
    VALID_TEST_NUMBERS.safe.forEach(num => console.log(`   ${num}`));
    console.log('\n🔵 Numéros MTN:');
    VALID_TEST_NUMBERS.mtn.forEach(num => console.log(`   ${num}`));
    console.log('\n🟠 Numéros Orange (certains peuvent échouer avec S3P):');
    VALID_TEST_NUMBERS.orange.forEach(num => console.log(`   ${num}`));
    return;
  }
  
  // Traitement des arguments
  args.forEach(arg => {
    if (arg.startsWith('--phone=')) CONFIG.TEST_PHONE = arg.split('=')[1];
    if (arg.startsWith('--amount=')) CONFIG.TEST_AMOUNT = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--operator=')) CONFIG.FORCE_OPERATOR = arg.split('=')[1] as 'mtn' | 'orange';
    if (arg === '--debug') CONFIG.DEBUG = true;
    if (arg === '--skip-collect') CONFIG.SKIP_COLLECT = true;
  });
  
  // Si un opérateur est forcé, sélectionner un numéro approprié
  if (CONFIG.FORCE_OPERATOR && !args.some(arg => arg.startsWith('--phone='))) {
    CONFIG.TEST_PHONE = CONFIG.FORCE_OPERATOR === 'orange' ? 
      VALID_TEST_NUMBERS.safe.find(n => n.startsWith('68')) || VALID_TEST_NUMBERS.safe[2] :
      VALID_TEST_NUMBERS.safe[0];
  }
  
  console.log('\n⚙️  Configuration:');
  console.log(`   📱 Téléphone: ${CONFIG.TEST_PHONE}`);
  console.log(`   💰 Montant: ${CONFIG.TEST_AMOUNT} FCFA`);
  console.log(`   🏷️  Email: ${CONFIG.TEST_EMAIL}`);
  console.log(`   👤 Nom: ${CONFIG.TEST_NAME}`);
  if (CONFIG.FORCE_OPERATOR) console.log(`   📡 Opérateur forcé: ${CONFIG.FORCE_OPERATOR.toUpperCase()}`);
  
  try {
    const result = await testCollectEndpoint();
    console.log('\n🎉 Test terminé avec succès !');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 ERREUR NON GÉRÉE:', error);
    process.exit(1);
  });
}

export { testCollectEndpoint, VALID_TEST_NUMBERS, validateAndSuggestNumber };