// scripts/test-s3p-connection.ts
import { s3pClient } from '@/lib/s3p/auth';
import { S3P_CONFIG } from '@/lib/s3p/config';

async function testS3PConnection() {
  try {
    console.log('=== Test de connexion à l\'API S3P ===');
    
    // 1. Tester la connexion de base
    console.log('\n1. Test de connexion de base...');
    
    // 2. Tester l'endpoint de vérification avec un PTN connu
    const testPtn = '99999175734725900090942752309795'; // Remplacer par un PTN valide
    console.log(`\n2. Test de vérification de transaction (PTN: ${testPtn})...`);
    
    try {
      const response = await s3pClient.get(S3P_CONFIG.ENDPOINTS.VERIFY, { ptn: testPtn });
      console.log('Réponse brute de l\'API S3P:', JSON.stringify(response, null, 2));
      
      // Traitement de la réponse
      const responseData = Array.isArray(response) ? response[0] : (response.data || response);
      console.log('\nDonnées traitées:');
      console.log('PTN:', responseData.ptn);
      console.log('Status:', responseData.status);
      console.log('Montant (priceLocalCur):', responseData.priceLocalCur);
      console.log('Devise:', responseData.localCur || 'XAF');
      console.log('Date:', responseData.timestamp);
      
    } catch (error) {
      console.error('Erreur lors de la vérification de la transaction:', error);
    }
    
  } catch (error) {
    console.error('Erreur lors du test de connexion S3P:', error);
  }
}

// Exécuter le test
testS3PConnection().catch(console.error);
