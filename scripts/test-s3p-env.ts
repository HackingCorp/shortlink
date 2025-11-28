// scripts/test-s3p-env.ts
import dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement depuis le fichier .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Afficher les variables d'environnement S3P
console.log('=== Vérification des variables d\'environnement S3P ===');
console.log(`S3P_BASE_URL: ${process.env.S3P_BASE_URL}`);
console.log(`S3P_ACCESS_TOKEN: ${process.env.S3P_ACCESS_TOKEN ? '*** (présent)' : 'NON DÉFINI'}`);
console.log(`S3P_ACCESS_SECRET: ${process.env.S3P_ACCESS_SECRET ? '*** (présent)' : 'NON DÉFINI'}`);
console.log(`S3P_SERVICE_ID: ${process.env.S3P_SERVICE_ID}`);

// Vérifier la configuration
const missingVars = [];
if (!process.env.S3P_BASE_URL) missingVars.push('S3P_BASE_URL');
if (!process.env.S3P_ACCESS_TOKEN) missingVars.push('S3P_ACCESS_TOKEN');
if (!process.env.S3P_ACCESS_SECRET) missingVars.push('S3P_ACCESS_SECRET');

if (missingVars.length > 0) {
  console.error('\n❌ Variables d\'environnement manquantes :', missingVars.join(', '));
  console.error('Veuillez les définir dans le fichier .env');
  process.exit(1);
} else {
  console.log('\n✅ Toutes les variables d\'environnement requises sont définies');
}
