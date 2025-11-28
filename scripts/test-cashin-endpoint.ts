// scripts/test-cashin-endpoint.ts
import dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { S3PMobileWalletService } from '@/lib/s3p/mobileWalletService';

async function testCashinEndpoint() {
  try {
    console.log('=== Test du point de terminaison CASHIN ===');
    const s3pService = new S3PMobileWalletService();
    
    // 1. Tester sans serviceId (récupère tous les packages)
    console.log('\n1. Récupération de tous les packages cash-in...');
    const allPackages = await s3pService.getCashinPackages();
    console.log(`✅ ${allPackages.length} packages récupérés avec succès`);
    
    // Afficher un aperçu des packages
    allPackages.slice(0, 3).forEach((pkg, index) => {
      console.log(`\nPackage ${index + 1}:`);
      console.log(`- Service ID: ${pkg.serviceid}`);
      console.log(`- Marchand: ${pkg.merchant}`);
      console.log(`- Nom: ${pkg.name}`);
      console.log(`- ID du package: ${pkg.payItemId}`);
      console.log(`- Montant: ${pkg.amountLocalCur} ${pkg.localCur}`);
      console.log(`- Type de montant: ${pkg.amountType}`);
    });
    
    // 2. Tester avec un serviceId spécifique si des packages sont disponibles
    if (allPackages.length > 0) {
      const serviceId = allPackages[0].serviceid;
      console.log(`\n2. Récupération des packages pour le service ID: ${serviceId}...`);
      
      const filteredPackages = await s3pService.getCashinPackages(serviceId);
      console.log(`✅ ${filteredPackages.length} packages trouvés pour le service ID ${serviceId}`);
      
      // Vérifier que tous les packages retournés correspondent au serviceId demandé
      const allMatch = filteredPackages.every(pkg => pkg.serviceid === serviceId);
      console.log(`✅ Vérification des serviceIds: ${allMatch ? 'OK' : 'ERREUR'}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test du point de terminaison CASHIN:');
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
testCashinEndpoint().then(() => {
  console.log('\n=== Test terminé avec succès ===');
  process.exit(0);
}).catch(error => {
  console.error('\n=== Échec du test ===');
  console.error(error);
  process.exit(1);
});
