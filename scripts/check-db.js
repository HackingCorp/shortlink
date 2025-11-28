const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    // Vérifier la connexion à la base de données
    await prisma.$connect();
    console.log('✅ Connecté à la base de données avec succès');
    
    // Vérifier si la table Transaction existe
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Transaction'
      );
    `;
    
    if (tableExists[0].exists) {
      console.log('✅ La table Transaction existe');
      
      // Afficher la structure de la table
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'Transaction';
      `;
      
      console.log('\nStructure de la table Transaction :');
      console.table(columns);
    } else {
      console.log('❌ La table Transaction n\'existe pas');
      
      // Afficher les tables existantes
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
      
      console.log('\nTables existantes :');
      console.table(tables);
    }
    
  } catch (error) {
    console.error('Erreur lors de la vérification de la base de données :');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
